/**
 * Web3 Service
 * 
 * This service provides an interface for interacting with the Ethereum blockchain
 * and the smart contract for the food traceability platform.
 */

// Import required modules
const Web3 = require('web3');
const contractABI = require('../config/contractABI.json');
require('dotenv').config();
const logger = require('../utils/logger');

// Initialize Web3 instance
const web3 = new Web3(new Web3.providers.HttpProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`));
const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Set up account with private key
const privateKey = process.env.PRIVATE_KEY;
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
web3.eth.accounts.wallet.add(account);

/**
 * Enum mapping for product statuses
 * Ensure this matches the enum in the smart contract
 */
const statusEnum = {
  registered: 0,
  planted: 1,
  growing: 2,
  harvested: 3,
  processed: 4,
  packaged: 5,
  intransit: 6,
  delivered: 7,
};

/**
 * Nonce manager to handle transaction nonce
 */
// Nonce manager to handle transaction nonce
const nonceManager = {
  nonce: null,
  async getNonce() {
    if (this.nonce === null) {
      this.nonce = await web3.eth.getTransactionCount(account.address);
    }
    return this.nonce++;
  },
  reset() {
    this.nonce = null;
  },
};

async function initWeb3() {
  try {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);

      // Request account access if needed
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // Listen for accounts and network changes
      window.ethereum.on('accountsChanged', function (accounts) {
        console.log('Account changed:', accounts);
        // Handle the account change
      });

      window.ethereum.on('chainChanged', function (chainId) {
        console.log('Chain changed:', chainId);
        // Handle the chain change
      });

      // Handle the disconnect event to replace the deprecated 'close' event
      window.ethereum.on('disconnect', (error) => {
        console.log('Wallet disconnected', error);
        disconnectWallet();  // Handle wallet disconnection
      });
      
      console.log('Web3 initialized and wallet connected');
    } else {
      throw new Error('MetaMask not detected. Please install MetaMask.');
    }
  } catch (error) {
    console.error('Error initializing Web3:', error);
    throw error;
  }
}

/**
 * Estimate gas for a transaction
 * @param {Object} txObject - The transaction object
 * @returns {Promise<number>} The estimated gas
 */
async function estimateGas(txObject) {
  try {
    const gasEstimate = await txObject.estimateGas({ from: account.address });
    return Math.floor(gasEstimate * 1.2); // Add 20% buffer
  } catch (error) {
    logger.error('Error estimating gas:', error);
    throw error;
  }
}

/**
 * Send a transaction to the blockchain
 * @param {Object} txObject - The transaction object
 * @param {number} value - The value to send with the transaction (in wei)
 * @returns {Promise<Object>} The transaction receipt
 */
async function sendTransaction(txObject, value = 0) {
  try {
    const gas = await estimateGas(txObject);
    const nonce = await nonceManager.getNonce();
    const signedTx = await account.signTransaction({
      to: contractAddress,
      data: txObject.encodeABI(),
      gas,
      value,
      nonce,
    });
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logger.info('Transaction sent. Receipt:', receipt);
    return receipt;
  } catch (error) {
    nonceManager.reset(); // Reset nonce on error
    throw error; // Rethrow the error to be handled in the calling function
  }
}

/**
 * Register a product on the blockchain
 * @param {Object} product - The product details
 * @returns {Promise<Object>} A promise that resolves with the transaction result
 */
async function registerProductOnBlockchain(product) {
  try {
    console.log('Preparing product data for blockchain registration', product);
    
    const priceWei = web3.utils.toWei(product.price.toString(), 'ether');
    const productionDateTimestamp = Math.floor(new Date(product.productionDate).getTime() / 1000);

    console.log('Sending createProduct transaction');
    const txObject = contract.methods.createProduct(
      product.batchNumber,
      product.type,
      product.origin,
      productionDateTimestamp,
      product.quantity,
      priceWei
    );

    const receipt = await sendTransaction(txObject);

    console.log('Product registered on blockchain. Transaction receipt:', receipt);
    
    if (!receipt.events || !receipt.events.ProductCreated) {
      throw new Error('ProductCreated event not found in transaction receipt');
    }

    const blockchainId = receipt.events.ProductCreated.returnValues.productId;

    return { 
      success: true, 
      txHash: receipt.transactionHash, 
      blockchainId: blockchainId,
      message: 'Product successfully registered on the blockchain.' 
    };
  } catch (error) {
    console.error('Error registering product on blockchain:', error);
    return { 
      success: false, 
      error: error.message || 'An error occurred during the blockchain transaction' 
    };
  }
}

/**
 * Update product status on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @param {number} newStatus - The new status as a number
 * @returns {Promise<Object>} A promise that resolves with the transaction result
 */
async function updateProductStatusOnBlockchain(productId, newStatus) {
  try {
    console.log(`Updating product status on blockchain. Product ID: ${productId}, New Status: ${newStatus}`);

    const txObject = contract.methods.updateProductStatus(productId, newStatus);
    const receipt = await sendTransaction(txObject);

    console.log('Product status updated successfully. Transaction receipt:', receipt);
    return { 
      success: true, 
      txHash: receipt.transactionHash,
      message: 'Product status updated successfully on the blockchain.'
    };
  } catch (error) {
    console.error('Error updating product status on blockchain:', error);
    return { 
      success: false, 
      error: error.message || 'An error occurred during the blockchain transaction'
    };
  }
}

// Add this utility function to check if a string is a valid hex
function isValidHex(hex) {
  return typeof hex === 'string' && hex.match(/^0x[0-9A-Fa-f]*$/);
}

/**
 * Convert a product ID to bytes32 format
 * @param {string} productId - The product ID to convert
 * @returns {string} The product ID in bytes32 format
 */
function convertToBytes32(productId) {
  if (isValidHex(productId) && productId.length === 66) {
    return productId; // Already in correct format
  }
  return web3.utils.padLeft(web3.utils.toHex(productId), 64);
}

/**
 * Initiate a transfer of ownership from farmer to distributor
 * @param {string} productId - The blockchain ID of the product to transfer
 * @param {string} recipientIdentifier - The recipient (new owner) identifier
 * @param {number} quantity - The quantity of the product to transfer
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
async function initiateTransferOnBlockchain(productId, newOwnerUsername, quantity) {
  try {
    console.log('Initiating blockchain transfer for product:', productId);
    
    // Ensure contract is properly initialized
    if (!contract || !contract.methods) {
      throw new Error('Contract not properly initialized');
    }

    // Convert productId to bytes32
    const productIdBytes32 = web3.utils.padLeft(web3.utils.toHex(productId), 64);
    
    // Log parameters for debugging
    console.log('Transfer parameters:', { productIdBytes32, newOwnerUsername, quantity });

    // Check if the product exists
    const productExists = await contract.methods.productExists(productIdBytes32).call();
    if (!productExists) {
      throw new Error('Product does not exist');
    }

    // Check if the user is registered
    const isRegistered = await isUserRegistered(newOwnerUsername);
    if (!isRegistered) {
      throw new Error('Recipient is not registered');
    }

    // Estimate gas with a higher limit
    const gasEstimate = await contract.methods.initiateTransfer(productIdBytes32, newOwnerUsername, quantity).estimateGas({
      from: process.env.ETHEREUM_ADDRESS,
      gas: 5000000 // Set a high gas limit for estimation
    });
    
    console.log('Estimated gas:', gasEstimate);

    // Send the transaction
    const result = await contract.methods.initiateTransfer(productIdBytes32, newOwnerUsername, quantity).send({
      from: process.env.ETHEREUM_ADDRESS,
      gas: Math.floor(gasEstimate * 1.5) // Increase gas limit by 50%
    });

    console.log('Transaction hash:', result.transactionHash);
    return { success: true, txHash: result.transactionHash };
  } catch (error) {
    console.error('Blockchain transaction error:', error);
    // Improved error handling
    if (error.message.includes('revert')) {
      const revertReason = error.message.match(/revert\s(.*)"/);
      if (revertReason && revertReason[1]) {
        return { success: false, error: `Transaction reverted: ${revertReason[1]}` };
      }
    }
    return { success: false, error: error.message };
  }
}


/**
 * Cancel a transfer on the blockchain
 * @param {string} txHash - The blockchain transaction hash of the transfer to cancel
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
async function cancelTransferOnBlockchain(txHash, initiatorAddress) {
  try {
    console.log(`Cancelling transfer on blockchain. Transaction Hash: ${txHash}`);

    // Ensure web3 is initialized
    if (!web3) {
      throw new Error('Web3 is not initialized');
    }

    // Ensure contract is initialized
    if (!contract) {
      throw new Error('Smart contract is not initialized');
    }

    // Ensure account is set
    if (!initiatorAddress) {
      throw new Error('No Ethereum account is set');
    }

    if (!txHash) {
      throw new Error('Invalid transaction hash provided');
    }

    // Convert transaction hash to bytes32 if necessary
    const bytes32TxHash = web3.utils.padLeft(web3.utils.toHex(txHash), 64);

    // Prepare the transaction
    const txObject = contract.methods.cancelTransfer(bytes32TxHash);

    // Estimate gas
    const gas = await estimateGas(txObject, { from: initiatorAddress });
    console.log(`Estimated gas for cancelTransfer: ${gas}`);

    // Send the transaction from the initiator's address
    const receipt = await sendTransaction(txObject, initiatorAddress, gas);
    console.log('Cancel transfer transaction receipt:', receipt);

    if (!receipt.status) {
      throw new Error('Transaction failed on the blockchain');
    }

    return {
      success: true,
      txHash: receipt.transactionHash,
      message: 'Transfer cancelled successfully on the blockchain.',
    };
  } catch (error) {
    console.error('Error in cancelTransferOnBlockchain:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during blockchain interaction',
    };
  }
}


/**
 * Get the details of a product from the blockchain
 * @param {string} productId - The blockchain ID of the product to retrieve
 * @returns {Promise<Object>} - The product details
 */
async function getProductFromBlockchain(productId) {
  try {
    const formattedProductId = web3.utils.padLeft(web3.utils.toHex(productId), 64);
    const product = await contract.methods.getProduct(formattedProductId).call();
    
    return {
      success: true,
      product: {
        batchNumber: product[0],
        type: product[1],
        origin: product[2],
        productionDate: new Date(parseInt(product[3]) * 1000).toISOString(),
        quantity: parseInt(product[4]),
        currentOwner: product[5],
        status: Object.keys(statusEnum)[parseInt(product[6])],
        price: web3.utils.fromWei(product[7], 'ether')
      }
    };
  } catch (error) {
    console.error('Error getting product from blockchain:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the transaction receipt from the blockchain
 * 
 * @param {string} txHash - The transaction hash to verify
 * @returns {Promise<Object>} - The transaction receipt or an error if not found
 */
async function getTransactionReceipt(txHash) {
  try {
    // Retrieve the transaction receipt from the blockchain
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }
    logger.info('Transaction receipt retrieved:', receipt); // Log the receipt details
    return receipt;
  } catch (error) {
    logger.error('Error getting transaction receipt:', { error, txHash }); // Log any errors encountered
    throw error; // Re-throw the error to handle it in the calling function
  }
}

/**
 * Get the current Ethereum balance of the account
 * @returns {Promise<string>} - The balance in Ether
 */
async function getBalance() {
  try {
    const balanceWei = await web3.eth.getBalance(account.address);
    return web3.utils.fromWei(balanceWei, 'ether');
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error;
  }
}

/**
 * Register a user on the blockchain
 * @param {string} userIdentifier - The unique identifier for the user
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
async function registerUserOnBlockchain(userIdentifier) {
  try {
    logger.info(`Registering user on blockchain. User Identifier: ${userIdentifier}`);

    const txObject = contract.methods.registerUser(userIdentifier);
    
    const gas = await estimateGas(txObject);
    const receipt = await sendTransaction(txObject, 0, gas);

    logger.info('User registered successfully on blockchain. Transaction receipt:', receipt);
    return { 
      success: true, 
      txHash: receipt.transactionHash,
      message: 'User registered successfully on the blockchain.'
    };
  } catch (error) {
    logger.error('Error registering user on blockchain:', error);
    return { 
      success: false, 
      error: error.message || 'An error occurred during the blockchain transaction'
    };
  }
}

/**
 * Check if a user is registered on the blockchain
 * @param {string} userIdentifier - The unique identifier for the user
 * @returns {Promise<boolean>} - Whether the user is registered
 */
async function isUserRegistered(userIdentifier) {
  try {
    const address = await contract.methods.getAddressFromIdentifier(userIdentifier).call();
    return address !== '0x0000000000000000000000000000000000000000';
  } catch (error) {
    console.error('Error checking user registration:', error);
    return false;
  }
}

/**
 * Check if a product exists on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @returns {Promise<boolean>} - Whether the product exists
 */
async function productExists(productId) {
  try {
    const bytes32ProductId = web3.utils.padLeft(web3.utils.toHex(productId), 64);
    return await contract.methods.productExists(bytes32ProductId).call();
  } catch (error) {
    console.error('Error checking product existence:', error);
    return false;
  }
}


/**
 * Accept a transfer on the blockchain (Distributor operation)
 * @param {string} transferId - The blockchain transaction hash of the transfer to accept
 * @param {string} distributorAddress - The Ethereum address of the distributor accepting the transfer
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
async function acceptTransferOnBlockchain(transferId, distributorAddress) {
  try {
    logger.info(`Accepting transfer on blockchain. Transfer ID: ${transferId}, Distributor Address: ${distributorAddress}`);

    // Ensure the transferId is in the correct format (it should be the blockchain transaction hash)
    const formattedTransferId = web3.utils.isHexStrict(transferId) ? transferId : web3.utils.sha3(transferId);
    logger.info(`Formatted Transfer ID: ${formattedTransferId}`);

    // Get the contract instance
    const contract = new web3.eth.Contract(contractABI, contractAddress);

    // Check if the transfer exists and is pending
    const transferExists = await contract.methods.pendingTransfers(formattedTransferId).call();
    if (!transferExists || transferExists.quantity === '0') {
      logger.warn(`No pending transfer found for ID: ${formattedTransferId}`);
      return {
        success: false,
        error: 'No pending transfer found on the blockchain'
      };
    }

    // Estimate gas
    const gasEstimate = await contract.methods.acceptTransfer(formattedTransferId).estimateGas({ from: distributorAddress });
    logger.info(`Estimated gas: ${gasEstimate}`);

    // Send the transaction
    const result = await contract.methods.acceptTransfer(formattedTransferId).send({
      from: distributorAddress,
      gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
    });

    logger.info('Transfer accepted successfully. Transaction receipt:', result);
    return {
      success: true,
      txHash: result.transactionHash,
      message: 'Transfer accepted successfully on the blockchain.'
    };
  } catch (error) {
    logger.error('Error accepting transfer on blockchain:', error);
    return {
      success: false,
      error: error.message || 'An error occurred during the blockchain transaction'
    };
  }
}

/**
 * Web3 Service - Distributor Functions
 * 
 * This section focuses on functions related to distributor operations
 * in the food traceability platform.
 */

/**
 * Check the status of a transfer on the blockchain
 * @param {string} txHash - The transaction hash of the transfer
 * @returns {Promise<string>} The status of the transfer
 */
async function checkTransferStatus(txHash) {
  try {
    logger.info(`Checking transfer status for transaction: ${txHash}`);
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    if (!receipt) {
      return 'pending';
    }
    // Check if the transaction was successful
    if (receipt.status) {
      // You might want to emit an event in your smart contract for transfers and check for that event here
      const transferEvent = receipt.logs.find(log => 
        log.topics[0] === web3.utils.sha3("TransferInitiated(bytes32,address,address,uint256)") ||
        log.topics[0] === web3.utils.sha3("TransferAccepted(bytes32,address,address,uint256)")
      );
      if (transferEvent) {
        const eventName = web3.utils.sha3("TransferAccepted(bytes32,address,address,uint256)");
        return transferEvent.topics[0] === eventName ? 'completed' : 'pending_acceptance';
      }
      return 'completed'; // The transaction was successful, but no transfer event was found
    }
    return 'failed'; // The transaction failed
  } catch (error) {
    logger.error('Error checking transfer status on blockchain:', error);
    throw error;
  }
}

/**
 * Accept a transfer on the blockchain (Distributor operation)
 * @param {string} transferId - The blockchain transaction hash of the transfer to accept
 * @param {string} distributorAddress - The Ethereum address of the distributor accepting the transfer
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
async function acceptTransferOnBlockchain(transferId, distributorAddress) {
  try {
    logger.info(`Accepting transfer on blockchain. Transfer ID: ${transferId}, Distributor Address: ${distributorAddress}`);

    const transferExists = await contract.methods.pendingTransfers(transferId).call();
    if (!transferExists || transferExists.quantity === '0') {
      logger.warn(`No pending transfer found for ID: ${transferId}`);
      return {
        success: false,
        error: 'No pending transfer found on the blockchain'
      };
    }

    const gasEstimate = await contract.methods.acceptTransfer(transferId).estimateGas({ from: distributorAddress });
    logger.info(`Estimated gas: ${gasEstimate}`);

    const result = await contract.methods.acceptTransfer(transferId).send({
      from: distributorAddress,
      gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
    });

    logger.info('Transfer accepted successfully. Transaction receipt:', result);
    return {
      success: true,
      txHash: result.transactionHash,
      message: 'Transfer accepted successfully on the blockchain.'
    };
  } catch (error) {
    logger.error('Error accepting transfer on blockchain:', error);
    return {
      success: false,
      error: error.message || 'An error occurred during the blockchain transaction'
    };
  }
}


/**
 * Accept a transfer (wrapper function for acceptTransferOnBlockchain)
 * @param {string} transferId - The ID of the transfer to accept
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
async function acceptTransfer(transferId) {
  try {
    const distributorAddress = await getCurrentEthereumAddress();
    const result = await acceptTransferOnBlockchain(transferId, distributorAddress);
    
    if (result.success) {
      logger.info('Transfer accepted successfully:', result.message);
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    logger.error('Error accepting transfer:', error);
    throw error;
  }
}

/**
 * Accept a transfer on the blockchain (Distributor operation)
 * @param {string} transferId - The blockchain transaction hash of the transfer to accept
 * @param {string} distributorAddress - The Ethereum address of the distributor accepting the transfer
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
async function acceptTransferOnBlockchain(transferId, distributorAddress) {
  try {
    logger.info(`Accepting transfer on blockchain. Transfer ID: ${transferId}, Distributor Address: ${distributorAddress}`);

    const formattedTransferId = web3.utils.isHexStrict(transferId) ? transferId : web3.utils.sha3(transferId);
    logger.info(`Formatted Transfer ID: ${formattedTransferId}`);

    const transferExists = await contract.methods.pendingTransfers(formattedTransferId).call();
    if (!transferExists || transferExists.quantity === '0') {
      logger.warn(`No pending transfer found for ID: ${formattedTransferId}`);
      return {
        success: false,
        error: 'No pending transfer found on the blockchain'
      };
    }

    logger.info('Transfer exists on blockchain:', transferExists);

    const gasEstimate = await contract.methods.acceptTransfer(formattedTransferId).estimateGas({ from: distributorAddress });
    logger.info(`Estimated gas: ${gasEstimate}`);

    const result = await contract.methods.acceptTransfer(formattedTransferId).send({
      from: distributorAddress,
      gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
    });

    logger.info('Transfer accepted successfully. Transaction receipt:', result);
    return {
      success: true,
      txHash: result.transactionHash,
      message: 'Transfer accepted successfully on the blockchain.'
    };
  } catch (error) {
    logger.error('Error accepting transfer on blockchain:', error);
    return {
      success: false,
      error: error.message || 'An error occurred during the blockchain transaction'
    };
  }
}

/**
 * Sync a product with the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @returns {Promise<Object>} A promise that resolves with the sync result
 */
async function syncProductWithBlockchain(productId) {
  try {
    logger.info(`Syncing product with blockchain: ${productId}`);

    const formattedProductId = convertToBytes32(productId);
    
    // Fetch the product data from the blockchain
    const blockchainProduct = await contract.methods.getProduct(formattedProductId).call();
    
    if (!blockchainProduct) {
      throw new Error('Product not found on blockchain');
    }

    // Format the blockchain data
    const syncedProduct = {
      batchNumber: blockchainProduct[0],
      type: blockchainProduct[1],
      origin: blockchainProduct[2],
      productionDate: new Date(parseInt(blockchainProduct[3]) * 1000).toISOString(),
      quantity: parseInt(blockchainProduct[4]),
      currentOwner: blockchainProduct[5],
      status: Object.keys(statusEnum)[parseInt(blockchainProduct[6])],
      price: web3.utils.fromWei(blockchainProduct[7], 'ether')
    };

    logger.info('Product synced successfully with blockchain:', syncedProduct);

    return { 
      success: true,
      product: syncedProduct,
      message: 'Product synced successfully with blockchain.'
    };
  } catch (error) {
    logger.error('Error syncing product with blockchain:', error);
    return { 
      success: false, 
      error: error.message || 'An error occurred while syncing with blockchain'
    };
  }
}

/**
 * Update product information on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @param {Object} updatedInfo - The updated product information
 * @returns {Promise<Object>} A promise that resolves with the update result
 */
async function updateProductInfoOnBlockchain(productId, updatedInfo) {
  try {
    logger.info(`Updating product info on blockchain. Product ID: ${productId}`, updatedInfo);

    const formattedProductId = convertToBytes32(productId);
    const details = JSON.stringify(updatedInfo);

    const txObject = contract.methods.updateProductInfo(formattedProductId, details);
    
    const gasEstimate = await txObject.estimateGas({ from: account.address });
    logger.info(`Estimated gas: ${gasEstimate}`);

    const receipt = await sendTransaction(txObject, 0, Math.floor(gasEstimate * 1.2));

    logger.info('Product info updated successfully on blockchain. Transaction receipt:', receipt);
    return { 
      success: true, 
      txHash: receipt.transactionHash,
      message: 'Product information updated successfully on the blockchain.'
    };
  } catch (error) {
    logger.error('Error updating product info on blockchain:', error);
    return { 
      success: false, 
      error: error.message || 'An error occurred during the blockchain transaction'
    };
  }
}

/**
 * Get the transaction history for a user (farmer or distributor)
 * @param {string} userAddress - The Ethereum address of the user
 * @returns {Promise<Object>} - Resolves with the transaction history
 */
async function getTransactionHistory(userAddress) {
  try {
    logger.info(`Getting transaction history for user: ${userAddress}`);

    // Implement pagination to handle large amounts of data
    const pageSize = 100; // Adjust based on your needs
    let fromBlock = 0;
    let allEvents = [];

    while (true) {
      const events = await contract.getPastEvents('allEvents', {
        filter: { user: userAddress },
        fromBlock: fromBlock,
        toBlock: fromBlock + pageSize
      });

      allEvents = allEvents.concat(events);

      if (events.length < pageSize) {
        break; // We've reached the end of the events
      }

      fromBlock += pageSize + 1;
    }

    const history = allEvents.map(event => ({
      eventName: event.event,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      returnValues: event.returnValues
    }));

    logger.info(`Retrieved ${history.length} transactions for user`);
    return { success: true, history };
  } catch (error) {
    logger.error('Error getting transaction history:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to get the current Ethereum address
 * @returns {Promise<string>} - The current Ethereum address
 */
async function getCurrentEthereumAddress() {
  try {
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No Ethereum accounts found. Please make sure your wallet is connected.');
    }
    return accounts[0];
  } catch (error) {
    logger.error('Error getting current Ethereum address:', error);
    throw error;
  }
}

/**
 * Get pending transfers for a user (distributor)
 * @param {string} userAddress - The Ethereum address of the user
 * @returns {Promise<Array>} - Resolves with an array of pending transfers
 */
async function getPendingTransfersFromBlockchain(userAddress) {
  try {
    console.log(`Getting pending transfers for user: ${userAddress}`);
    
    // Get all TransferInitiated events where the 'to' address matches the user's address
    const events = await contract.getPastEvents('TransferInitiated', {
      filter: { to: userAddress },
      fromBlock: 0,
      toBlock: 'latest'
    });

    // Process the events to get pending transfers
    const pendingTransfers = events.map(event => ({
      transferId: event.returnValues.transferId,
      productId: event.returnValues.productId,
      from: event.returnValues.from,
      quantity: event.returnValues.quantity,
      timestamp: event.returnValues.timestamp
    }));

    console.log('Pending transfers:', pendingTransfers);
    return { success: true, transfers: pendingTransfers };
  } catch (error) {
    console.error('Error getting pending transfers:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if an Ethereum address is valid
 * @param {string} address - The Ethereum address to validate
 * @returns {boolean} - True if the address is valid, false otherwise
 */
function isValidAddress(address) {
  return web3.utils.isAddress(address);
}

/**
 * Initiate a transfer of ownership from distributor to retailer
 * @param {string} productId - The blockchain ID of the product to transfer
 * @param {string} retailerId - The ID of the retailer receiving the product
 * @param {number} quantity - The quantity of the product to transfer
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
async function initiateTransferToRetailer(productId, retailerId, quantity) {
  try {
    logger.info(`Initiating transfer to retailer. Product ID: ${productId}, Retailer ID: ${retailerId}, Quantity: ${quantity}`);

    const accounts = await web3.eth.getAccounts();
    const fromAddress = accounts[0];

    // Convert productId to bytes32
    const productIdBytes32 = web3.utils.padLeft(web3.utils.toHex(productId), 64);

    // Get retailer's Ethereum address from their ID
    const retailerAddress = await contract.methods.getAddressFromIdentifier(retailerId).call();

    if (retailerAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Retailer not found or not registered on the blockchain');
    }

    // Prepare the transaction
    const txObject = contract.methods.initiateTransfer(productIdBytes32, retailerAddress, quantity);

    // Estimate gas
    const gasEstimate = await txObject.estimateGas({ from: fromAddress });
    logger.info(`Estimated gas for initiateTransfer: ${gasEstimate}`);

    // Send the transaction
    const receipt = await txObject.send({
      from: fromAddress,
      gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
    });

    logger.info('Transfer initiated successfully. Transaction receipt:', receipt);
    return {
      success: true,
      txHash: receipt.transactionHash,
      message: 'Transfer initiated successfully on the blockchain.'
    };
  } catch (error) {
    logger.error('Error initiating transfer on blockchain:', error);
    return {
      success: false,
      error: error.message || 'An error occurred during the blockchain transaction'
    };
  }
}

/**
 * Initiate a transfer from distributor to retailer on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @param {string} retailerIdentifier - The unique identifier of the retailer
 * @param {number} quantity - The quantity to transfer
 * @returns {Promise<Object>} A promise that resolves with the transaction result
 */
async function initiateDistributorTransferOnBlockchain(productId, retailerIdentifier, quantity) {
  try {
    console.log(`Initiating distributor transfer on blockchain. Product ID: ${productId}, Retailer: ${retailerIdentifier}, Quantity: ${quantity}`);
    
    // Ensure contract is properly initialized
    if (!contract || !contract.methods) {
      throw new Error('Contract not properly initialized');
    }

    // Convert productId to bytes32 if necessary
    const productIdBytes32 = web3.utils.padLeft(web3.utils.toHex(productId), 64);

    // Estimate gas
    const gasEstimate = await contract.methods.initiateTransfer(productIdBytes32, retailerIdentifier, quantity).estimateGas({
      from: account.address,
    });

    console.log('Estimated gas:', gasEstimate);

    // Send the transaction
    const result = await contract.methods.initiateTransfer(productIdBytes32, retailerIdentifier, quantity).send({
      from: account.address,
      gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
    });

    console.log('Transaction hash:', result.transactionHash);
    return { success: true, txHash: result.transactionHash };
  } catch (error) {
    console.error('Blockchain transaction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Web3 Service - Retailer Functions
 * 
 * This section contains functions specifically for retailer operations
 * in the food traceability platform, implemented for the backend.
 */

/**
 * Accept a transfer from a distributor (Retailer operation)
 * @param {string} transferId - The blockchain transaction hash of the transfer to accept
 * @param {string} retailerAddress - The Ethereum address of the retailer accepting the transfer
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
async function acceptTransferAsRetailer(transferId, retailerAddress) {
  try {
    logger.info(`Retailer accepting transfer on blockchain. Transfer ID: ${transferId}, Retailer Address: ${retailerAddress}`);

    const formattedTransferId = web3.utils.isHexStrict(transferId) ? transferId : web3.utils.sha3(transferId);
    logger.info(`Formatted Transfer ID: ${formattedTransferId}`);

    const transferExists = await contract.methods.pendingTransfers(formattedTransferId).call();
    if (!transferExists || transferExists.quantity === '0') {
      logger.warn(`No pending transfer found for ID: ${formattedTransferId}`);
      return {
        success: false,
        error: 'No pending transfer found on the blockchain'
      };
    }

    const gasEstimate = await contract.methods.acceptTransfer(formattedTransferId).estimateGas({ from: retailerAddress });
    logger.info(`Estimated gas for retailer transfer acceptance: ${gasEstimate}`);

    const result = await contract.methods.acceptTransfer(formattedTransferId).send({
      from: retailerAddress,
      gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
    });

    logger.info('Transfer accepted successfully by retailer. Transaction receipt:', result);
    return {
      success: true,
      txHash: result.transactionHash,
      message: 'Transfer accepted successfully by retailer on the blockchain.'
    };
  } catch (error) {
    logger.error('Error in retailer accepting transfer on blockchain:', error);
    return {
      success: false,
      error: error.message || 'An error occurred during the retailer blockchain transaction'
    };
  }
}

/**
 * Update product information by retailer on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @param {Object} updatedInfo - The updated product information
 * @returns {Promise<Object>} A promise that resolves with the update result
 */
async function updateProductInfoAsRetailer(productId, updatedInfo) {
  // Use the account set up for the backend instead of currentAccount
  const fromAddress = account.address;

  try {
    logger.info(`Retailer updating product info: ${productId}`, updatedInfo);
    
    // Ensure contract is initialized
    if (!contract || !contract.methods) {
      throw new Error('Smart contract not properly initialized');
    }

    const formattedProductId = convertToBytes32(productId);
    const details = JSON.stringify(updatedInfo);

    // Estimate gas with a higher limit
    const gasEstimate = await contract.methods.updateProductInfo(formattedProductId, details).estimateGas({
      from: fromAddress,
      gas: 5000000 // Set a high gas limit for estimation
    });
    
    logger.info('Estimated gas:', gasEstimate);

    // Prepare the transaction object
    const txObject = contract.methods.updateProductInfo(formattedProductId, details);

    // Send the transaction using the sendTransaction helper function
    const receipt = await sendTransaction(txObject, 0, Math.floor(gasEstimate * 1.5));

    logger.info('Product info updated by retailer. Transaction receipt:', receipt);
    return { 
      success: true, 
      txHash: receipt.transactionHash,
      message: 'Product information updated successfully on the blockchain.'
    };
  } catch (error) {
    logger.error('Error updating product info as retailer:', error);
    
    let errorMessage = 'An error occurred during the blockchain transaction';
    if (error.message.includes('gas required exceeds allowance')) {
      errorMessage = 'Transaction failed due to insufficient gas. Please try again with a higher gas limit.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { 
      success: false, 
      error: errorMessage
    };
  }
}

/**
 * Initiate a transfer from retailer to consumer
 * @param {string} productId - The blockchain ID of the product
 * @param {string} consumerId - The consumer's unique identifier
 * @param {number} quantity - The quantity to transfer
 * @returns {Promise<Object>} A promise that resolves with the transaction result
 */
async function initiateRetailerToConsumerTransfer(productId, consumerId, quantity) {
  try {
    logger.info(`Retailer initiating transfer to consumer. Product ID: ${productId}, Consumer ID: ${consumerId}, Quantity: ${quantity}`);

    const formattedProductId = convertToBytes32(productId);

    const txObject = contract.methods.initiateTransfer(formattedProductId, consumerId, quantity);
    
    const gasEstimate = await txObject.estimateGas({ from: account.address });
    logger.info(`Estimated gas for retailer-to-consumer transfer: ${gasEstimate}`);

    const receipt = await sendTransaction(txObject, 0, Math.floor(gasEstimate * 1.2));

    logger.info('Transfer to consumer initiated successfully by retailer. Transaction receipt:', receipt);
    return { 
      success: true, 
      txHash: receipt.transactionHash,
      message: 'Transfer to consumer initiated successfully by retailer on the blockchain.'
    };
  } catch (error) {
    logger.error('Error in retailer initiating transfer to consumer:', error);
    return { 
      success: false, 
      error: error.message || 'An error occurred during the retailer-to-consumer blockchain transaction'
    };
  }
}

/**
 * Get pending transfers for a retailer
 * @param {string} retailerAddress - The Ethereum address of the retailer
 * @returns {Promise<Object>} - Resolves with an array of pending transfers
 */
async function getRetailerPendingTransfers(retailerAddress) {
  try {
    logger.info(`Getting pending transfers for retailer: ${retailerAddress}`);

    const events = await contract.getPastEvents('TransferInitiated', {
      filter: { to: retailerAddress },
      fromBlock: 0,
      toBlock: 'latest'
    });

    const pendingTransfers = events.map(event => ({
      transferId: event.returnValues.transferId,
      productId: event.returnValues.productId,
      from: event.returnValues.from,
      quantity: event.returnValues.quantity,
      timestamp: event.returnValues.timestamp
    }));

    logger.info(`Retrieved ${pendingTransfers.length} pending transfers for retailer`);
    return { success: true, transfers: pendingTransfers };
  } catch (error) {
    logger.error('Error getting pending transfers for retailer:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Record a sale to a consumer on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @param {string} consumerId - The consumer's unique identifier
 * @param {number} quantity - The quantity sold
 * @param {number} price - The price of the sale
 * @returns {Promise<Object>} A promise that resolves with the transaction result
 */
async function recordSaleToConsumer(productId, consumerId, quantity, price) {
  try {
    logger.info(`Recording sale to consumer. Product ID: ${productId}, Consumer ID: ${consumerId}, Quantity: ${quantity}, Price: ${price}`);

    const formattedProductId = convertToBytes32(productId);
    const priceWei = web3.utils.toWei(price.toString(), 'ether');

    const txObject = contract.methods.recordSale(formattedProductId, consumerId, quantity, priceWei);
    
    const gasEstimate = await txObject.estimateGas({ from: account.address });
    logger.info(`Estimated gas for recording sale to consumer: ${gasEstimate}`);

    const receipt = await sendTransaction(txObject, 0, Math.floor(gasEstimate * 1.2));

    logger.info('Sale to consumer recorded successfully. Transaction receipt:', receipt);
    return { 
      success: true, 
      txHash: receipt.transactionHash,
      message: 'Sale to consumer recorded successfully on the blockchain.'
    };
  } catch (error) {
    logger.error('Error recording sale to consumer:', error);
    return { 
      success: false, 
      error: error.message || 'An error occurred while recording the sale on the blockchain'
    };
  }
}

/**
 * Get retailer's product inventory from the blockchain
 * @param {string} retailerAddress - The Ethereum address of the retailer
 * @returns {Promise<Object>} - Resolves with the retailer's product inventory
 */
async function getRetailerInventory(retailerAddress) {
  try {
    logger.info(`Getting inventory for retailer: ${retailerAddress}`);

    const inventory = await contract.methods.getRetailerInventory(retailerAddress).call();

    const formattedInventory = inventory.map(item => ({
      productId: item.productId,
      quantity: parseInt(item.quantity),
      productType: item.productType,
      batchNumber: item.batchNumber
    }));

    logger.info(`Retrieved ${formattedInventory.length} items in retailer's inventory`);
    return { success: true, inventory: formattedInventory };
  } catch (error) {
    logger.error('Error getting retailer inventory:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get product quality metrics for a retailer
 * @param {string} productId - The blockchain ID of the product
 * @returns {Promise<Object>} - Resolves with the product quality metrics
 */
async function getRetailerProductQualityMetrics(productId) {
  try {
    logger.info(`Getting quality metrics for product: ${productId}`);

    const formattedProductId = convertToBytes32(productId);
    const qualityData = await contract.methods.getProductQualityData(formattedProductId).call();

    const metrics = {
      averageRating: parseFloat(qualityData.averageRating),
      totalRatings: parseInt(qualityData.totalRatings),
      qualityChecks: qualityData.qualityChecks.map(check => ({
        date: new Date(parseInt(check.date) * 1000),
        passed: check.passed,
        details: check.details
      }))
    };

    logger.info(`Retrieved quality metrics for product ${productId}`);
    return { success: true, metrics: metrics };
  } catch (error) {
    logger.error(`Error getting quality metrics for product ${productId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Web3 Service - Consumer Functions
 * 
 * This section contains blockchain interaction functions specifically for consumer operations
 * in the food traceability platform. These functions are designed to be used in the backend
 * to support consumer-related routes and operations.
 */

/**
 * Verify a product's authenticity on the blockchain
 * @param {string} productId - The blockchain ID of the product to verify
 * @returns {Promise<Object>} A promise that resolves with the verification result
 */
async function verifyProductOnBlockchain(productId) {
  try {
    logger.info(`Verifying product authenticity on blockchain. Product ID: ${productId}`);

    const formattedProductId = convertToBytes32(productId);
    
    // Call the smart contract method to verify the product
    const result = await contract.methods.verifyProduct(formattedProductId).call();

    logger.info(`Product verification result for ${productId}:`, result);
    return {
      success: true,
      data: {
        isAuthentic: result.isAuthentic,
        origin: result.origin,
        productionDate: new Date(parseInt(result.productionDate) * 1000).toISOString(),
        currentOwner: result.currentOwner
      },
      message: 'Product verification completed.'
    };
  } catch (error) {
    logger.error('Error verifying product on blockchain:', error);
    return {
      success: false,
      error: error.message || 'An error occurred during product verification on the blockchain'
    };
  }
}

/**
 * Get the full journey of a product from the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @returns {Promise<Object>} A promise that resolves with the product's journey
 */
async function getProductJourneyFromBlockchain(productId) {
  try {
    logger.info(`Fetching product journey from blockchain. Product ID: ${productId}`);

    const formattedProductId = convertToBytes32(productId);
    
    // Call the smart contract method to get the product journey
    const journey = await contract.methods.getProductJourney(formattedProductId).call();

    const formattedJourney = journey.map(step => ({
      timestamp: new Date(parseInt(step.timestamp) * 1000).toISOString(),
      actor: step.actor,
      action: step.action,
      details: step.details
    }));

    logger.info(`Product journey fetched for ${productId}. Steps: ${formattedJourney.length}`);
    return {
      success: true,
      journey: formattedJourney,
      message: 'Product journey retrieved successfully.'
    };
  } catch (error) {
    logger.error('Error fetching product journey from blockchain:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while retrieving the product journey from the blockchain'
    };
  }
}

/**
 * Accept a transfer of ownership for a product (consumer operation)
 * @param {string} transferId - The ID of the transfer to accept
 * @param {string} consumerAddress - The Ethereum address of the consumer
 * @returns {Promise<Object>} A promise that resolves with the acceptance result
 */
async function acceptTransferAsConsumer(transferId, consumerAddress) {
  try {
    logger.info(`Consumer accepting transfer. Transfer ID: ${transferId}, Consumer Address: ${consumerAddress}`);

    const formattedTransferId = web3.utils.isHexStrict(transferId) ? transferId : web3.utils.sha3(transferId);

    // Check if the transfer exists and is pending
    const transferExists = await contract.methods.pendingTransfers(formattedTransferId).call();
    if (!transferExists || transferExists.quantity === '0') {
      logger.warn(`No pending transfer found for ID: ${formattedTransferId}`);
      return {
        success: false,
        error: 'No pending transfer found on the blockchain'
      };
    }

    // Estimate gas for the transaction
    const gasEstimate = await contract.methods.acceptTransfer(formattedTransferId).estimateGas({ from: consumerAddress });
    logger.info(`Estimated gas for consumer transfer acceptance: ${gasEstimate}`);

    // Send the transaction
    const result = await contract.methods.acceptTransfer(formattedTransferId).send({
      from: consumerAddress,
      gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
    });

    logger.info('Transfer accepted successfully by consumer. Transaction receipt:', result);
    return {
      success: true,
      txHash: result.transactionHash,
      message: 'Transfer accepted successfully by consumer on the blockchain.'
    };
  } catch (error) {
    logger.error('Error in consumer accepting transfer on blockchain:', error);
    return {
      success: false,
      error: error.message || 'An error occurred during the consumer blockchain transaction'
    };
  }
}

/**
 * Submit feedback for a product on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @param {string} consumerAddress - The Ethereum address of the consumer
 * @param {number} rating - The rating given by the consumer (1-5)
 * @param {string} comment - The comment given by the consumer
 * @returns {Promise<Object>} A promise that resolves with the feedback submission result
 */
async function submitProductFeedbackOnBlockchain(productId, consumerAddress, rating, comment) {
  try {
    logger.info(`Submitting product feedback on blockchain. Product ID: ${productId}, Consumer: ${consumerAddress}`);

    const formattedProductId = convertToBytes32(productId);
    
    // Prepare the feedback data
    const feedbackData = web3.utils.asciiToHex(JSON.stringify({ rating, comment }));

    // Estimate gas for the transaction
    const gasEstimate = await contract.methods.submitFeedback(formattedProductId, feedbackData).estimateGas({ from: consumerAddress });
    logger.info(`Estimated gas for submitting feedback: ${gasEstimate}`);

    // Send the transaction
    const result = await contract.methods.submitFeedback(formattedProductId, feedbackData).send({
      from: consumerAddress,
      gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
    });

    logger.info('Feedback submitted successfully on blockchain. Transaction receipt:', result);
    return {
      success: true,
      txHash: result.transactionHash,
      message: 'Product feedback submitted successfully on the blockchain.'
    };
  } catch (error) {
    logger.error('Error submitting product feedback on blockchain:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while submitting feedback on the blockchain'
    };
  }
}

/**
 * Get consumer's product ownership history from the blockchain
 * @param {string} consumerAddress - The Ethereum address of the consumer
 * @returns {Promise<Object>} A promise that resolves with the consumer's product history
 */
async function getConsumerProductHistoryFromBlockchain(consumerAddress) {
  try {
    logger.info(`Fetching consumer product history from blockchain. Consumer: ${consumerAddress}`);

    // Call the smart contract method to get the consumer's product history
    const history = await contract.methods.getConsumerProductHistory(consumerAddress).call();

    const formattedHistory = history.map(item => ({
      productId: web3.utils.hexToUtf8(item.productId),
      purchaseDate: new Date(parseInt(item.purchaseDate) * 1000).toISOString(),
      quantity: parseInt(item.quantity),
      price: web3.utils.fromWei(item.price, 'ether')
    }));

    logger.info(`Consumer product history fetched. Items: ${formattedHistory.length}`);
    return {
      success: true,
      history: formattedHistory,
      message: 'Consumer product history retrieved successfully.'
    };
  } catch (error) {
    logger.error('Error fetching consumer product history from blockchain:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while retrieving the consumer product history from the blockchain'
    };
  }
}

/**
 * Handle errors in the Web3 service
 * @param {string} functionName - The name of the function where the error occurred
 * @param {Error} error - The error object
 */
function handleError(functionName, error) {
  logger.error(`Error in ${functionName}:`, { error });
  throw error;
}


// Test connection to the blockchain node
web3.eth.net.isListening()
  .then(() => logger.info('Connected to blockchain node'))
  .catch(e => logger.error('Failed to connect to blockchain node:', { error: e }));

  module.exports = {
    registerProductOnBlockchain,
    updateProductStatusOnBlockchain,
    convertToBytes32,
    initWeb3,
    initiateTransferOnBlockchain,
    cancelTransferOnBlockchain,
    getProductFromBlockchain,
    getTransactionReceipt,
    getBalance,
    registerUserOnBlockchain,
    isUserRegistered,
    productExists,
    // Distributors functions
    checkTransferStatus,
    acceptTransferOnBlockchain,          // New function for distributors
    syncProductWithBlockchain,
    updateProductInfoOnBlockchain,       // New function for distributors
    acceptTransfer,
    getTransactionHistory,
    getPendingTransfersFromBlockchain,
    isValidAddress,
    initiateTransferToRetailer,
    initiateDistributorTransferOnBlockchain,
    getCurrentEthereumAddress,
    // Retailer specific functions
    acceptTransferAsRetailer,
    updateProductInfoAsRetailer,
    initiateRetailerToConsumerTransfer,
    getRetailerPendingTransfers,
    recordSaleToConsumer,
    getRetailerInventory,
    getRetailerProductQualityMetrics,
    // consumer functions
    verifyProductOnBlockchain,
    getProductJourneyFromBlockchain,
    acceptTransferAsConsumer,
    submitProductFeedbackOnBlockchain,
    getConsumerProductHistoryFromBlockchain
  };