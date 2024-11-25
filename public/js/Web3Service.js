// frontend/js/Web3Service.js
/**
 * Frontend Web3 Service
 * 
 * This service provides an interface for interacting with the Ethereum blockchain
 * from the frontend of the food traceability platform. It handles wallet connections,
 * contract interactions, and blockchain transactions.
 */

angular.module('foodTraceabilityApp')
  .factory('Web3Service', ['$q', '$window', '$rootScope', '$timeout', function($q, $window, $rootScope, $timeout) {
    let web3;
    let contract;
    let currentAccount;
    
    
    const contractAddress = '0x09b116fd1414c95a9264035b9c55af074b9ca587'; // Update as needed
    const contractABI = [{
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "productId",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "previousOwner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "quantity",
          "type": "uint256"
        }
      ],
      "name": "OwnershipTransferred",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "productId",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "payer",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "receiver",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "PaymentTriggered",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "productId",
          "type": "bytes32"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "batchNumber",
          "type": "string"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "ProductCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "productId",
          "type": "bytes32"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "details",
          "type": "string"
        }
      ],
      "name": "ProductInfoUpdated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "productId",
          "type": "bytes32"
        },
        {
          "indexed": false,
          "internalType": "enum ProductManagement.Status",
          "name": "oldStatus",
          "type": "uint8"
        },
        {
          "indexed": false,
          "internalType": "enum ProductManagement.Status",
          "name": "newStatus",
          "type": "uint8"
        }
      ],
      "name": "StatusUpdated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "productId",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "quantity",
          "type": "uint256"
        }
      ],
      "name": "TransferAccepted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "productId",
          "type": "bytes32"
        }
      ],
      "name": "TransferCancelled",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "productId",
          "type": "bytes32"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "reason",
          "type": "string"
        }
      ],
      "name": "TransferError",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "productId",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "quantity",
          "type": "uint256"
        }
      ],
      "name": "TransferInitiated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "string",
          "name": "identifier",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "userAddress",
          "type": "address"
        }
      ],
      "name": "UserRegistered",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_transferId",
          "type": "bytes32"
        }
      ],
      "name": "acceptTransfer",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "addressToIdentifier",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_productId",
          "type": "bytes32"
        }
      ],
      "name": "cancelTransfer",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_batchNumber",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_productType",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_origin",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "_productionDate",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_quantity",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_price",
          "type": "uint256"
        }
      ],
      "name": "createProduct",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_identifier",
          "type": "string"
        }
      ],
      "name": "getAddressFromIdentifier",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_address",
          "type": "address"
        }
      ],
      "name": "getIdentifierFromAddress",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_productId",
          "type": "bytes32"
        }
      ],
      "name": "getProduct",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "enum ProductManagement.Status",
          "name": "",
          "type": "uint8"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_blockchainId",
          "type": "bytes32"
        }
      ],
      "name": "getProductByBlockchainId",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "enum ProductManagement.Status",
          "name": "",
          "type": "uint8"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getProductCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_index",
          "type": "uint256"
        }
      ],
      "name": "getProductIdByIndex",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_productId",
          "type": "bytes32"
        }
      ],
      "name": "getProductState",
      "outputs": [
        {
          "internalType": "string",
          "name": "batchNumber",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "productType",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "origin",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "productionDate",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "quantity",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "currentOwner",
          "type": "address"
        },
        {
          "internalType": "enum ProductManagement.Status",
          "name": "status",
          "type": "uint8"
        },
        {
          "internalType": "uint256",
          "name": "price",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "hasPendingTransfer",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "name": "identifierToAddress",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_productId",
          "type": "bytes32"
        },
        {
          "internalType": "string",
          "name": "_toIdentifier",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "_quantity",
          "type": "uint256"
        }
      ],
      "name": "initiateTransfer",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "name": "pendingTransfers",
      "outputs": [
        {
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "quantity",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_productId",
          "type": "bytes32"
        }
      ],
      "name": "productExists",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "name": "products",
      "outputs": [
        {
          "internalType": "string",
          "name": "batchNumber",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "productType",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "origin",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "productionDate",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "quantity",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "currentOwner",
          "type": "address"
        },
        {
          "internalType": "enum ProductManagement.Status",
          "name": "status",
          "type": "uint8"
        },
        {
          "internalType": "uint256",
          "name": "price",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_identifier",
          "type": "string"
        }
      ],
      "name": "registerUser",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_productId",
          "type": "bytes32"
        }
      ],
      "name": "triggerPayment",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_productId",
          "type": "bytes32"
        },
        {
          "internalType": "string",
          "name": "_details",
          "type": "string"
        }
      ],
      "name": "updateProductInfo",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_productId",
          "type": "bytes32"
        }
      ],
      "name": "updateProductOwnerAddress",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "_productId",
          "type": "bytes32"
        },
        {
          "internalType": "enum ProductManagement.Status",
          "name": "_newStatus",
          "type": "uint8"
        }
      ],
      "name": "updateProductStatus",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

 /**
     * Enum mapping for product statuses
     * Ensure this matches the enum in the smart contract
     */
 const statusEnum = {
  "registered": 0,
  "planted": 1,
  "growing": 2,
  "harvested": 3,
  "processed": 4,
  "packaged": 5,
  "intransit": 6,
  "delivered": 7
};

let connectionPromise = null;
let connectionTimeout = null;

/**
 * Error handler for blockchain operations
 * Provides more detailed logging and user-friendly error messages.
 * 
 * @param {Error} error - The error object
 * @returns {Promise} - A rejected promise with the error message
 */
function handleError(error) {
  console.error('Blockchain Error:', error);
  // Check if the error is due to MetaMask or wallet connection issues
  if (error.message.includes('User denied transaction signature')) {
    return $q.reject('Transaction was rejected by the user.');
  }
  if (error.message.includes('MetaMask is not installed')) {
    return $q.reject('MetaMask is required to interact with the blockchain.');
  }
  return $q.reject(error.message || 'An unexpected blockchain error occurred');
}

/**
     * Initialize Web3 and connect to Ethereum
     * @returns {Promise} - A promise that resolves with the current account
     */
function initWeb3() {
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    if (typeof $window.ethereum !== 'undefined') {
      web3 = new Web3($window.ethereum);
      $window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accounts => {
          if (accounts.length === 0) {
            reject('No Ethereum accounts available');
          } else {
            currentAccount = accounts[0];
            contract = new web3.eth.Contract(contractABI, contractAddress);
            console.log('Connected to Ethereum account:', currentAccount);
            
            // Start listening to blockchain events
            listenToBlockchainEvents();
            
            resolve(currentAccount);
          }
        })
        .catch(error => reject('Failed to connect Ethereum wallet: ' + error.message))
        .finally(() => {
          connectionPromise = null;
        });
    } else {
      reject('MetaMask or another Ethereum wallet extension is required.');
    }
  });

  return connectionPromise;
}

/**
 * Listen to relevant blockchain events
 */
function listenToBlockchainEvents() {
  // Listen to TransferAccepted events
  contract.events.TransferAccepted({
    fromBlock: 'latest'
  })
  .on('data', function(event) {
    console.log('TransferAccepted event:', event);
    // Emit an event to update the frontend
    $rootScope.$emit('TransferAccepted', event.returnValues);
  })
  .on('error', function(error) {
    console.error('Error on TransferAccepted event:', error);
  });

  // Listen to TransferInitiated events
  contract.events.TransferInitiated({
    fromBlock: 'latest'
  })
  .on('data', function(event) {
    console.log('TransferInitiated event:', event);
    // Emit an event to update the frontend
    $rootScope.$emit('TransferInitiated', event.returnValues);
  })
  .on('error', function(error) {
    console.error('Error on TransferInitiated event:', error);
  });
}

/**
     * Connect to the Ethereum wallet
     * @returns {Promise} - A promise that resolves with the user's current account
     */
function connectWallet() {
  return initWeb3()
    .then(account => {
      if (!account) {
        throw new Error('No Ethereum account connected');
      }
      console.log('Connected to Ethereum account:', account);
      return account;
    })
    .catch(error => {
      console.error('Error connecting wallet:', error);
      return $q.reject(error.message || 'Failed to connect to Ethereum wallet');
    });
}

/**
 * Disconnect the Ethereum wallet
 */
function disconnectWallet() {
  currentAccount = null;
  contract = null;
  web3 = null;
  console.log('Ethereum wallet disconnected.');
}

/**
 * Check if the wallet is currently connected
 * @returns {Promise<boolean>} - A promise that resolves with the connection status
 */
function isWalletConnected() {
  return $q(function(resolve) {
    if (web3 && currentAccount) {
      resolve(true);
    } else {
      resolve(false);
    }

    web3.eth.getAccounts()
      .then(function(accounts) {
        resolve(accounts.length > 0);
      })
      .catch(function(error) {
        console.error('Error checking wallet connection:', error);
        resolve(false);
      });
  });
}


/**
 * Get the balance of the connected account in Ether
 * @returns {Promise<string>} - A promise that resolves with the balance in Ether
 */
function getBalance() {
  return $q(function(resolve, reject) {
    if (!web3 || !currentAccount) {
      reject('Web3 not initialized or no account connected');
      return;
    }

    web3.eth.getBalance(currentAccount)
      .then(balanceWei => {
        const balanceEther = web3.utils.fromWei(balanceWei, 'ether');
        resolve(balanceEther);
      })
      .catch(reject);
  }).catch(handleError);
}
/**
 * Get the current Ethereum account address
 * @returns {Promise<string>} - A promise that resolves with the current Ethereum account address
 */
function getCurrentAddress() {
  return $q(function(resolve, reject) {
    if (web3 && currentAccount) {
      resolve(currentAccount);
    } else {
      web3.eth.getAccounts()
        .then(function(accounts) {
          if (accounts.length > 0) {
            resolve(accounts[0]);
          } else {
            reject('No Ethereum accounts found');
          }
        })
        .catch(reject);
    }
  });
}

/**
     * Register a product on the blockchain
     * @param {Object} product - The product details
     * @returns {Promise<Object>} - A promise that resolves with the transaction result
     */
function registerProductOnBlockchain(product) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log('Preparing product data for blockchain');
    console.log('Raw product data:', JSON.stringify(product, null, 2));
    
    // Ensure all required fields are present and in the correct format
    if (!product.batchNumber || !product.type || !product.origin || 
        !product.productionDate || product.quantity == null || product.price == null) {
      reject({ success: false, error: 'Missing or invalid product fields' });
      return;
    }

    // Ensure price is a valid number and convert to wei
    let priceWei;
    try {
      const priceNumber = parseFloat(product.price);
      if (isNaN(priceNumber) || priceNumber < 0) {
        throw new Error('Invalid product price. It must be a non-negative number.');
      }
      priceWei = web3.utils.toWei(priceNumber.toString(), 'ether');
    } catch (error) {
      console.error('Price conversion error:', error);
      reject({ success: false, error: 'Invalid product price. It must be a valid number.' });
      return;
    }

    const productionDateTimestamp = Math.floor(new Date(product.productionDate).getTime() / 1000);

    console.log('Product data prepared:', {
      batchNumber: product.batchNumber,
      type: product.type,
      origin: product.origin,
      productionDateTimestamp,
      quantity: product.quantity,
      priceWei
    });

    console.log('Sending createProduct transaction');
    contract.methods.createProduct(
      product.batchNumber,
      product.type,
      product.origin,
      productionDateTimestamp,
      product.quantity,
      priceWei
    ).send({ from: currentAccount })
      .on('transactionHash', function(hash) {
        console.log('Transaction hash:', hash);
      })
      .on('receipt', function(receipt) {
        console.log('Transaction receipt:', receipt);
        if (receipt.status) {
          const blockchainId = receipt.events.ProductCreated.returnValues.productId;
          console.log('Product created with blockchain ID:', blockchainId);
          resolve({ 
            success: true, 
            txHash: receipt.transactionHash, 
            blockchainId: blockchainId,
            productId: product._id, // Include the MongoDB _id
            message: 'Product successfully registered on the blockchain.' 
          });
        } else {
          reject({ success: false, error: 'Transaction failed. Please check the blockchain explorer for more details.' });
        }
      })
      .on('error', function(error) {
        console.error('Transaction error:', error);
        reject({ success: false, error: error.message || 'An error occurred during the blockchain transaction' });
      });
  });
}

/**
 * Check if a product exists on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @returns {Promise<boolean>} - A promise that resolves with true if the product exists, false otherwise
 */
function checkProductExistsOnBlockchain(productId) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject('Web3 not initialized or no account connected');
      return;
    }

    const formattedProductId = convertToBytes32(productId);
    console.log(`Checking if product exists on blockchain. Product ID: ${formattedProductId}`);

    contract.methods.getProduct(formattedProductId).call({ from: currentAccount })
      .then(product => {
        // If the product exists, the batchNumber (first element) should not be empty
        const exists = product[0] !== '';
        console.log(`Product exists on blockchain: ${exists}`);
        resolve(exists);
      })
      .catch(error => {
        console.error('Error checking product existence:', error);
        // If there's an error, we assume the product doesn't exist
        resolve(false);
      });
  });
}

/**
 * Update product status on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @param {number} newStatus - The new status as a number
 * @returns {Promise<Object>} - A promise that resolves with the transaction result
 */
function updateProductStatusOnBlockchain(productId, newStatus) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log(`Updating product status on blockchain. Product ID: ${productId}, New Status: ${newStatus}`);

    const formattedProductId = convertToBytes32(productId);

    contract.methods.productExists(formattedProductId).call({ from: currentAccount })
      .then(exists => {
        if (!exists) {
          throw new Error('Product does not exist on the blockchain');
        }
        return contract.methods.updateProductStatus(formattedProductId, newStatus).estimateGas({ from: currentAccount });
      })
      .then(gasEstimate => {
        console.log('Estimated gas:', gasEstimate);
        const gasLimit = Math.round(gasEstimate * 1.2); // Add 20% buffer
        
        return contract.methods.updateProductStatus(formattedProductId, newStatus).send({ 
          from: currentAccount, 
          gas: gasLimit 
        });
      })
      .then(receipt => {
        console.log('Transaction receipt:', receipt);
        if (receipt.status) {
          resolve({ 
            success: true, 
            txHash: receipt.transactionHash,
            message: 'Product status updated successfully on the blockchain.'
          });
        } else {
          reject({ success: false, error: 'Transaction failed' });
        }
      })
      .catch(error => {
        console.error('Error updating product status on blockchain:', error);
        reject({ success: false, error: error.message || 'An error occurred during the blockchain transaction' });
      });
  });
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

// Add this utility function to check if a string is a valid hex
function isValidHex(hex) {
  return typeof hex === 'string' && hex.match(/^0x[0-9A-Fa-f]*$/);
}
/**
 * Transfer ownership of a product on the blockchain
 * @param {string} productId - The blockchain ID of the product to transfer
 * @param {string} newOwner - The address of the new owner
 * @param {number} quantity - The quantity of the product to transfer
 * @returns {Promise<Object>} - A promise that resolves with the transaction result
 */
function transferOwnershipOnBlockchain(productId, newOwner, quantity) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject('Web3 not initialized or no account connected');
      return;
    }

    console.log(`Initiating transfer. Product ID: ${productId}, New Owner: ${newOwner}, Quantity: ${quantity}`);
    
    contract.methods.initiateTransfer(productId, newOwner, quantity)
      .send({ from: currentAccount })
      .on('transactionHash', function(hash) {
        console.log('Transfer initiated. Transaction hash:', hash);
        resolve({ 
          success: true, 
          txHash: hash, 
          message: 'Transfer initiated successfully. Awaiting distributor acceptance.' 
        });
      })
      .on('receipt', function(receipt) {
        console.log('Transfer initiation receipt:', receipt);
        if (receipt.status) {
          resolve({ 
            success: true, 
            txHash: receipt.transactionHash, 
            message: 'Transfer initiated successfully. Pending distributor acceptance.',
            status: 'PENDING_ACCEPTANCE'
          });
        } else {
          reject('Transaction failed. Please check the blockchain explorer for more details.');
        }
      })
      .on('error', function(error) {
        console.error('Transaction error:', error);
        reject({
          message: error.message || 'An error occurred during the blockchain transaction',
          details: error
        });
      });
  });
}


/**
     * Initiate a transfer of ownership on the blockchain
     * @param {string} productId - The blockchain ID of the product to transfer
     * @param {string} newOwnerUsername - The unique identifier of the new owner (distributor)
     * @param {number} quantity - The quantity of the product to transfer
     * @returns {Promise<Object>} - A promise that resolves with the transaction result
     */
function initiateTransferOnBlockchain(productId, newOwnerUsername, quantity) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log('Initiating blockchain transfer for product:', productId);

    const formattedProductId = convertToBytes32(productId);

    contract.methods.initiateTransfer(formattedProductId, newOwnerUsername, quantity)
      .send({ from: currentAccount })
      .on('transactionHash', function(hash) {
        console.log('Transaction hash:', hash);
        resolve({ 
          success: true, 
          txHash: hash, 
          message: 'Transfer initiated successfully on the blockchain.' 
        });
      })
      .on('error', function(error) {
        console.error('Blockchain transaction error:', error);
        reject({ success: false, error: error.message || 'An error occurred during the blockchain transaction' });
      });
  });
}

/**
     * Get the details of a product from the blockchain
     * @param {string} productId - The blockchain ID of the product to retrieve
     * @returns {Promise<Object>} - A promise that resolves with the product details
     */
function getProductFromBlockchain(productId) {
  return $q(function(resolve, reject) {
    if (!contract) {
      reject({ success: false, error: 'Web3 not initialized' });
      return;
    }

    console.log(`Attempting to get product with ID: ${productId}`);

    // Try to format the productId if it's not already in the correct format
    let formattedProductId = productId;
    if (!web3.utils.isHexStrict(productId)) {
      try {
        formattedProductId = web3.utils.padLeft(web3.utils.numberToHex(productId), 64);
      } catch (error) {
        console.error('Error formatting product ID:', error);
        reject({ success: false, error: 'Invalid product ID format' });
        return;
      }
    }

    if (formattedProductId.length !== 66) {
      reject({ success: false, error: 'Invalid product ID length' });
      return;
    }

    console.log(`Formatted product ID: ${formattedProductId}`);

    contract.methods.getProduct(formattedProductId).call()
      .then(function(product) {
        // Format the product data
        const formattedProduct = {
          batchNumber: product[0],
          type: product[1],
          origin: product[2],
          productionDate: new Date(parseInt(product[3]) * 1000).toISOString(),
          quantity: parseInt(product[4]),
          currentOwner: product[5],
          status: Object.keys(statusEnum)[parseInt(product[6])],
          price: web3.utils.fromWei(product[7], 'ether')
        };
        resolve({ success: true, product: formattedProduct });
      })
      .catch(function(error) {
        console.error('Error getting product from blockchain:', error);
        reject({ success: false, error: error.message || 'Failed to get product from blockchain' });
      });
  });
}

/**
 * Retrieves a transaction receipt from the Ethereum blockchain.
 *
 * @param {string} txHash - The transaction hash to retrieve the receipt for.
 * @returns {Promise} A promise that resolves with the transaction receipt or rejects with an error.
 *
 * @example
 * getTransactionReceipt('0x1234567890abcdef').then(receipt => {
 *   console.log(receipt);
 * }).catch(error => {
 *   console.error(error);
 * });
 */
function getTransactionReceipt(txHash) {
  return $q(function(resolve, reject) {
    if (!web3) {
      reject('Web3 not initialized');
      return;
    }

    web3.eth.getTransactionReceipt(txHash)
      .then(resolve)
      .catch(reject);
  });
}

/**
 * Cancel a transfer on the blockchain
 * @param {string} productId - The blockchain ID of the product to cancel transfer
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
function cancelTransferOnBlockchain(productId) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      return reject('Web3 not initialized or no account connected');
    }

    console.log(`Attempting to cancel transfer for product ID: ${productId}`);

    const formattedProductId = convertToBytes32(productId);

    contract.methods.cancelTransfer(formattedProductId)
      .send({ from: currentAccount })
      .on('transactionHash', (hash) => {
        console.log('Cancel transfer transaction initiated. Transaction hash:', hash);
      })
      .on('receipt', (receipt) => {
        if (receipt.status) {
          resolve({
            success: true,
            txHash: receipt.transactionHash,
            message: 'Transfer cancelled successfully on the blockchain.',
          });
        } else {
          reject({ success: false, error: 'Transaction failed' });
        }
      })
      .on('error', (error) => {
        console.error('Cancel transfer transaction error:', error);
        reject({ success: false, error: error.message });
      });
  });
}

/**
 * Trigger a payment for a product on the blockchain
 * @param {string} productId - The blockchain ID of the product to pay for
 * @param {string} amount - The amount to pay in wei
 * @returns {Promise<Object>} - A promise that resolves with the transaction hash
 */
function triggerPaymentOnBlockchain(productId, amount) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject('Web3 not initialized or no account connected');
      return;
    }

    contract.methods.triggerPayment(productId)
      .send({ from: currentAccount, value: amount })
      .on('transactionHash', resolve)
      .on('error', reject);
  }).catch(handleError);
}

function getCurrentAccount() {
  return $q(function(resolve, reject) {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.request({ method: 'eth_accounts' })
        .then(function(accounts) {
          if (accounts.length > 0) {
            resolve(accounts[0]);
          } else {
            reject(new Error('No accounts found. User might not be connected.'));
          }
        })
        .catch(reject);
    } else {
      reject(new Error('Ethereum provider not found. Make sure MetaMask is installed.'));
    }
  });
}


/**
 * Web3 Service - Distributor Functions
 * 
 * This section focuses on functions related to distributor operations
 * in the food traceability platform.
 */

function convertToBytes32(value) {
  // If the value is already 66 characters long (0x + 64 hex characters), return it as is
  if (value.startsWith('0x') && value.length === 66) {
    return value;
  }
  // Otherwise, remove '0x' if present, pad to 32 bytes, and add '0x' prefix
  return '0x' + value.replace('0x', '').padStart(64, '0');
}

/**
     * Accept a transfer on the blockchain (Distributor operation)
     * @param {string} transferId - The blockchain transaction hash of the transfer to accept
     * @param {string} distributorAddress - The Ethereum address of the distributor accepting the transfer
     * @returns {Promise<Object>} - Resolves with the transaction result
     */
function acceptTransferOnBlockchain(transferId, distributorAddress) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log(`Accepting transfer on blockchain. Transfer ID: ${transferId}, Distributor Address: ${distributorAddress}`);

    const formattedTransferId = convertToBytes32(transferId);

    // Estimate gas first
    contract.methods.acceptTransfer(formattedTransferId).estimateGas({ from: distributorAddress })
      .then(function(gasEstimate) {
        console.log('Estimated gas for acceptTransfer:', gasEstimate);
        
        // Add 20% buffer to gas estimate
        const gas = Math.round(gasEstimate * 1.2);

        // Send the transaction
        return contract.methods.acceptTransfer(formattedTransferId).send({ 
          from: distributorAddress,
          gas: gas
        });
      })
      .then(function(receipt) {
        console.log('Transaction receipt:', receipt);
        if (receipt.status) {
          resolve({ 
            success: true, 
            txHash: receipt.transactionHash,
            message: 'Transfer accepted successfully on the blockchain.'
          });
        } else {
          reject({ success: false, error: 'Transaction failed' });
        }
      })
      .catch(function(error) {
        console.error('Error accepting transfer:', error);
        reject({ success: false, error: error.message || 'An error occurred during the blockchain transaction' });
      });
  });
}

/**
 * Update product information on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @param {Object} updatedInfo - The updated product information
 * @returns {Promise<Object>} A promise that resolves with the update result
 */
function updateProductInfoOnBlockchain(productId, updatedInfo) {
  return $q(function(resolve, reject) {
    if (!web3 || !contract || !currentAccount) {
      reject({ success: false, error: 'Web3 or contract not initialized or no account connected' });
      return;
    }

    console.log('Updating product info on blockchain:', productId, updatedInfo);

    const formattedProductId = convertToBytes32(productId);
    const details = JSON.stringify(updatedInfo);

    contract.methods.updateProductInfo(formattedProductId, details).estimateGas({ from: currentAccount })
      .then(function(gasEstimate) {
        console.log('Estimated gas:', gasEstimate);
        return contract.methods.updateProductInfo(formattedProductId, details).send({
          from: currentAccount,
          gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
        });
      })
      .then(function(receipt) {
        console.log('Update transaction receipt:', receipt);
        resolve({
          success: true,
          txHash: receipt.transactionHash,
          message: 'Product information updated successfully on the blockchain.'
        });
      })
      .catch(function(error) {
        console.error('Error updating product on blockchain:', error);
        reject({
          success: false,
          error: error.message || 'An error occurred during the blockchain transaction'
        });
      });
  });
}
/**
     * Initiate a transfer from distributor to retailer
     * @param {string} productId - The blockchain ID of the product
     * @param {string} retailerIdentifier - The retailer's unique identifier
     * @param {number} quantity - The quantity to transfer
     * @returns {Promise<Object>} A promise that resolves with the transaction result
     */
function initiateDistributorTransferOnBlockchain(productId, retailerIdentifier, quantity) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    const formattedProductId = convertToBytes32(productId);

    contract.methods.initiateTransfer(formattedProductId, retailerIdentifier, quantity).estimateGas({ from: currentAccount })
      .then(function(gasEstimate) {
        const gas = Math.round(gasEstimate * 1.2); // Add 20% buffer
        return contract.methods.initiateTransfer(formattedProductId, retailerIdentifier, quantity).send({ 
          from: currentAccount,
          gas: gas
        });
      })
      .then(function(receipt) {
        resolve({ 
          success: true, 
          txHash: receipt.transactionHash,
          message: 'Transfer initiated successfully on the blockchain.'
        });
      })
      .catch(function(error) {
        console.error('Error initiating transfer:', error);
        reject({ success: false, error: error.message || 'An error occurred during the blockchain transaction' });
      });
  });
}

/**
 * Get pending transfers for a user (distributor)
 * @param {string} userAddress - The Ethereum address of the user
 * @returns {Promise<Array>} - Resolves with an array of pending transfers
 */
function getPendingTransfersFromBlockchain(userAddress) {
  return $q(function(resolve, reject) {
    if (!contract) {
      reject({ success: false, error: 'Web3 not initialized' });
      return;
    }

    console.log(`Getting pending transfers for user: ${userAddress}`);

    // Get all TransferInitiated events where the 'to' address matches the user's address
    contract.getPastEvents('TransferInitiated', {
      filter: { to: userAddress },
      fromBlock: 0,
      toBlock: 'latest'
    })
    .then(function(events) {
      const pendingTransfers = events.map(event => ({
        transferId: event.returnValues.transferId,
        productId: event.returnValues.productId,
        from: event.returnValues.from,
        quantity: event.returnValues.quantity,
        timestamp: event.returnValues.timestamp
      }));
      console.log('Pending transfers:', pendingTransfers);
      resolve({ success: true, transfers: pendingTransfers });
    })
    .catch(function(error) {
      console.error('Error getting pending transfers:', error);
      reject({ success: false, error: error.message || 'Failed to get pending transfers from blockchain' });
    });
  });
}

 /**
     * Initiate a transfer from distributor to retailer
     * @param {string} productId - The blockchain ID of the product
     * @param {string} retailerId - The ID of the retailer receiving the product
     * @param {number} quantity - The quantity of the product to transfer
     * @returns {Promise<Object>} A promise that resolves with the transaction result
     */
 function initiateTransferToRetailer(productId, retailerId, quantity) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log(`Initiating transfer to retailer. Product ID: ${productId}, Retailer ID: ${retailerId}, Quantity: ${quantity}`);

    const formattedProductId = convertToBytes32(productId);

    contract.methods.initiateTransfer(formattedProductId, retailerId, quantity)
      .send({ from: currentAccount })
      .on('transactionHash', function(hash) {
        console.log('Transaction hash:', hash);
        resolve({ 
          success: true, 
          txHash: hash, 
          message: 'Transfer initiated successfully on the blockchain.' 
        });
      })
      .on('error', function(error) {
        console.error('Blockchain transaction error:', error);
        reject({ success: false, error: error.message || 'An error occurred during the blockchain transaction' });
      });
  });
}

/**
 * Web3 Service - Retailer Functions
 * 
 * This section contains functions specifically for retailer operations
 * in the food traceability platform.
 */

/**
     * Accept a transfer from a distributor (Retailer operation)
     * @param {string} transferId - The blockchain transaction hash of the transfer to accept
     * @returns {Promise<Object>} - Resolves with the transaction result
     */
function acceptTransferAsRetailer(transferId) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log(`Retailer accepting transfer: ${transferId}`);
    const formattedTransferId = convertToBytes32(transferId);

    contract.methods.acceptTransfer(formattedTransferId).send({ from: currentAccount })
      .then(function(receipt) {
        console.log('Transfer accepted by retailer:', receipt);
        resolve({ success: true, txHash: receipt.transactionHash });
      })
      .catch(function(error) {
        console.error('Error accepting transfer as retailer:', error);
        reject({ success: false, error: error.message });
      });
  });
}

/**
 * Update product information by retailer on the blockchain
 * @param {string} productId - The blockchain ID of the product
 * @param {Object} updatedInfo - The updated product information
 * @returns {Promise<Object>} A promise that resolves with the update result
 */
function updateProductInfoAsRetailer(productId, updatedInfo) {
  return $q(function(resolve, reject) {
    if (!web3 || !contract || !window.ethereum) {
      reject({ success: false, error: 'Web3 or MetaMask not initialized' });
      return;
    }

    console.log(`Retailer updating product info: ${productId}`, updatedInfo);
    
    const formattedProductId = convertToBytes32(productId);
    const details = JSON.stringify(updatedInfo);

    // Prepare the transaction object
    const txObject = contract.methods.updateProductInfo(formattedProductId, details);

    // Estimate gas
    txObject.estimateGas({ from: window.ethereum.selectedAddress })
      .then(function(gasEstimate) {
        console.log('Estimated gas:', gasEstimate);
        
        // Prepare transaction parameters
        const txParams = {
          from: window.ethereum.selectedAddress,
          to: contract._address,
          data: txObject.encodeABI(),
          gas: web3.utils.toHex(Math.floor(gasEstimate * 1.5)) // 50% buffer
        };

        // Send transaction - this will trigger MetaMask popup
        return window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [txParams],
        });
      })
      .then(function(txHash) {
        console.log('Transaction sent:', txHash);
        // Wait for transaction confirmation
        return waitForTransactionReceipt(txHash);
      })
      .then(function(receipt) {
        console.log('Transaction confirmed:', receipt);
        resolve({ 
          success: true, 
          txHash: receipt.transactionHash,
          message: 'Product updated successfully on the blockchain.'
        });
      })
      .catch(function(error) {
        console.error('MetaMask error:', error);
        reject({ 
          success: false, 
          error: error.message || 'Transaction rejected or failed'
        });
      });
  });
}

// Helper function to wait for transaction receipt
function waitForTransactionReceipt(txHash, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const checkReceipt = () => {
      web3.eth.getTransactionReceipt(txHash)
        .then(receipt => {
          if (receipt) {
            resolve(receipt);
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(checkReceipt, 2000); // Check every 2 seconds
          } else {
            reject(new Error('Transaction not mined within the expected time'));
          }
        })
        .catch(reject);
    };
    checkReceipt();
  });
}


 /**
     * Initiate a transfer from retailer to consumer
     * @param {string} productId - The blockchain ID of the product
     * @param {string} consumerId - The consumer's unique identifier
     * @param {number} quantity - The quantity to transfer
     * @returns {Promise<Object>} A promise that resolves with the transaction result
     */
 function initiateRetailerToConsumerTransfer(productId, consumerId, quantity) {
  return $q(function(resolve, reject) {
    if (!web3 || !contract || !$window.ethereum) {
      reject({ success: false, error: 'Web3 or MetaMask not initialized' });
      return;
    }

    console.log(`Initiating transfer on blockchain. Product ID: ${productId}, Consumer ID: ${consumerId}, Quantity: ${quantity}`);

    const formattedProductId = convertToBytes32(productId);
    let currentAccount;

    // Set a timeout for the entire process
    const timeout = $timeout(function() {
      reject({ success: false, error: 'Transaction timed out. It may still be pending, please check your MetaMask for status.' });
    }, 90000); // 90 seconds timeout

    // Request account access if needed
    $window.ethereum.request({ method: 'eth_requestAccounts' })
      .then(function(accounts) {
        if (accounts.length === 0) {
          throw new Error('No Ethereum accounts found');
        }
        currentAccount = accounts[0];

        // Prepare the transaction
        return contract.methods.initiateTransfer(formattedProductId, consumerId, quantity).estimateGas({ from: currentAccount });
      })
      .then(function(gasEstimate) {
        console.log('Estimated gas:', gasEstimate);
        
        // Prompt the user to sign the transaction using MetaMask
        return $window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: currentAccount,
            to: contract._address,
            data: contract.methods.initiateTransfer(formattedProductId, consumerId, quantity).encodeABI(),
            gas: web3.utils.toHex(Math.floor(gasEstimate * 2)) // Double the gas estimate
          }]
        });
      })
      .then(function(txHash) {
        console.log('Transaction hash:', txHash);
        // Emit an event to notify the controller
        $rootScope.$emit('transferInitiated', { txHash, productId, consumerId, quantity });
        
        // Clear the timeout as the transaction was sent successfully
        $timeout.cancel(timeout);
        
        resolve({ 
          success: true, 
          txHash: txHash, 
          message: 'Transfer initiated successfully on the blockchain. Please wait for confirmation.' 
        });
      })
      .catch(function(error) {
        console.error('Blockchain transaction error:', error);
        // Clear the timeout as we're handling the error
        $timeout.cancel(timeout);
        
        // Handle different types of errors
        if (error.code === 4001) {
          reject({ success: false, error: 'Transaction rejected by user' });
        } else if (error.code === -32603) {
          reject({ success: false, error: 'Internal JSON-RPC error. Please check your Ethereum node connection and try again.' });
        } else if (error.message.includes('Transaction was not mined within')) {
          reject({ success: false, error: 'Transaction was sent but not mined within the timeout period. It may still be pending, please check your MetaMask for status.' });
        } else {
          reject({ success: false, error: error.message || 'An error occurred during the blockchain transaction' });
        }
      });
  });
}

/**
 * Get pending transfers for the retailer
 * @returns {Promise<Object>} - Resolves with an array of pending transfers
 */
function getRetailerPendingTransfers() {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log('Fetching pending transfers for retailer');
    contract.getPastEvents('TransferInitiated', {
      filter: { to: currentAccount },
      fromBlock: 0,
      toBlock: 'latest'
    })
    .then(function(events) {
      const pendingTransfers = events.map(event => ({
        transferId: event.returnValues.transferId,
        productId: event.returnValues.productId,
        from: event.returnValues.from,
        quantity: event.returnValues.quantity,
        timestamp: event.returnValues.timestamp
      }));
      console.log('Pending transfers for retailer:', pendingTransfers);
      resolve({ success: true, transfers: pendingTransfers });
    })
    .catch(function(error) {
      console.error('Error getting pending transfers for retailer:', error);
      reject({ success: false, error: error.message });
    });
  });
}

/**
 * Record a sale to a consumer
 * @param {string} productId - The blockchain ID of the product
 * @param {string} consumerId - The consumer's unique identifier
 * @param {number} quantity - The quantity sold
 * @param {number} price - The price of the sale in Ether
 * @returns {Promise<Object>} A promise that resolves with the transaction result
 */
function recordSaleToConsumer(productId, consumerId, quantity, price) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log(`Recording sale to consumer: ${productId}, ${consumerId}, ${quantity}, ${price}`);
    const formattedProductId = convertToBytes32(productId);
    const priceWei = web3.utils.toWei(price.toString(), 'ether');

    contract.methods.recordSale(formattedProductId, consumerId, quantity, priceWei).send({ from: currentAccount })
      .then(function(receipt) {
        console.log('Sale recorded:', receipt);
        resolve({ success: true, txHash: receipt.transactionHash });
      })
      .catch(function(error) {
        console.error('Error recording sale to consumer:', error);
        reject({ success: false, error: error.message });
      });
  });
}


/**
 * Check the status of a transfer on the blockchain
 * @param {string} txHash - The transaction hash of the transfer
 * @returns {Promise<string>} The status of the transfer
 */
function checkTransferStatus(txHash) {
  return $q(function(resolve, reject) {
    if (!web3) {
      reject('Web3 not initialized');
      return;
    }

    web3.eth.getTransactionReceipt(txHash)
      .then(function(receipt) {
        if (!receipt) {
          resolve('pending');
        } else if (receipt.status) {
          resolve('completed');
        } else {
          resolve('failed');
        }
      })
      .catch(function(error) {
        console.error('Error checking transfer status:', error);
        reject(error);
      });
  });
}

/**
 * Consumer Functions
 * 
 * The following functions are specifically designed for consumer interactions
 * with the blockchain in the food traceability platform.
 */

/**
     * Verify a product's authenticity
     * @param {string} productId - The blockchain ID of the product to verify
     * @returns {Promise<Object>} The verification result
     */
function verifyProduct(productId) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log(`Verifying product: ${productId}`);
    const formattedProductId = convertToBytes32(productId);

    contract.methods.getProductState(formattedProductId).call({ from: currentAccount })
      .then(function(productState) {
        const isAuthentic = productState.currentOwner !== '0x0000000000000000000000000000000000000000';
        resolve({
          success: true,
          isAuthentic: isAuthentic,
          product: isAuthentic ? {
            batchNumber: productState.batchNumber,
            productType: productState.productType,
            origin: productState.origin,
            productionDate: new Date(parseInt(productState.productionDate) * 1000),
            quantity: parseInt(productState.quantity),
            currentOwner: productState.currentOwner,
            status: getStatusString(parseInt(productState.status)),
            price: web3.utils.fromWei(productState.price, 'ether'),
            hasPendingTransfer: productState.hasPendingTransfer
          } : null
        });
      })
      .catch(function(error) {
        console.error('Error verifying product:', error);
        reject({ success: false, error: error.message });
      });
  });
}

/**
 * Get the string representation of a status code
 * @param {number} statusCode - The status code
 * @returns {string} The status string
 */
function getStatusString(statusCode) {
  const statuses = ['Registered', 'Planted', 'Growing', 'Harvested', 'Processed', 'Packaged', 'InTransit', 'Delivered'];
  return statuses[statusCode] || 'Unknown';
}

/**
 * Check if a transfer exists on the blockchain
 * @param {string} transferId - The blockchain transaction hash of the transfer
 * @returns {Promise<boolean>} - Resolves with true if the transfer exists, false otherwise
 */
function checkTransferExistsOnBlockchain(transferId) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject('Web3 not initialized or no account connected');
      return;
    }

    console.log('Checking transfer existence on blockchain:', transferId);
    contract.methods.pendingTransfers(transferId).call({ from: currentAccount })
      .then(function(transferData) {
        const exists = transferData.quantity !== '0';
        console.log('Transfer exists on blockchain:', exists);
        resolve({ exists: exists });
      })
      .catch(function(error) {
        console.error('Error checking transfer on blockchain:', error);
        resolve({ exists: false });
      });
  });
}

/**
 * Estimate gas price
 * @returns {Promise<string>} - Resolves with the estimated gas price in wei
 */
function estimateGasPrice() {
  return web3.eth.getGasPrice()
    .then(function(price) {
      // Add a 20% buffer to the gas price
      return (parseFloat(price) * 1.2).toString();
    });
}

/**
 * Convert a value to bytes32 format
 * @param {string} value - The value to convert
 * @returns {string} The value in bytes32 format
 */
function convertToBytes32(value) {
  // If the value is already 66 characters long (0x + 64 hex characters), return it as is
  if (value.startsWith('0x') && value.length === 66) {
    return value;
  }
  // Otherwise, remove '0x' if present, pad to 32 bytes, and add '0x' prefix
  return '0x' + value.replace('0x', '').padStart(64, '0');
}

/**
 * Accept a transfer as a consumer on the blockchain
 * @param {string} transferId - The blockchain transaction hash of the transfer to accept
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
function acceptTransferAsConsumer(transferId) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log(`Consumer accepting transfer: ${transferId}`);

    contract.methods.acceptTransfer(transferId).send({ from: currentAccount })
      .then(function(receipt) {
        console.log('Transfer accepted by consumer:', receipt);
        resolve({ success: true, txHash: receipt.transactionHash });
      })
      .catch(function(error) {
        console.error('Error accepting transfer as consumer:', error);
        reject({ success: false, error: error.message });
      });
  });
}

/**
 * Cancel a transfer on the blockchain
 * @param {string} transferId - The blockchain transaction hash of the transfer to cancel
 * @returns {Promise<Object>} - Resolves with the transaction result
 */
function cancelTransferOnBlockchain(transferId) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject('Web3 not initialized or no account connected');
      return;
    }

    const formattedTransferId = web3.utils.padLeft(web3.utils.toHex(transferId), 64);
    contract.methods.cancelTransfer(formattedTransferId).send({ from: currentAccount })
      .then(function(receipt) {
        resolve({
          success: true,
          txHash: receipt.transactionHash,
          message: 'Transfer cancelled successfully on the blockchain.'
        });
      })
      .catch(function(error) {
        reject({
          success: false,
          error: error.message || 'An error occurred during the blockchain transaction'
        });
      });
  });
}


 /**
     * Submit feedback for a product
     * @param {string} productId - The blockchain ID of the product
     * @param {number} rating - The rating (1-5)
     * @param {string} comment - The feedback comment
     * @returns {Promise<Object>} The transaction receipt
     */
 function submitProductFeedback(productId, rating, comment) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log(`Submitting feedback for product: ${productId}`);
    const formattedProductId = convertToBytes32(productId);
    const feedbackData = web3.utils.utf8ToHex(JSON.stringify({ rating, comment }));

    contract.methods.submitFeedback(formattedProductId, feedbackData).send({ from: currentAccount })
      .then(function(receipt) {
        console.log('Feedback submitted:', receipt);
        resolve({ success: true, txHash: receipt.transactionHash });
      })
      .catch(function(error) {
        console.error('Error submitting feedback:', error);
        reject({ success: false, error: error.message });
      });
  });
}

/**
     * Get the product journey from blockchain events
     * @param {string} productId - The blockchain ID of the product
     * @returns {Promise<Array>} A promise that resolves with the product's journey
     */
function getProductJourney(productId) {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log(`Getting journey for product: ${productId}`);
    const formattedProductId = convertToBytes32(productId);

    // Get all relevant events for this product
    const eventPromises = [
      contract.getPastEvents('ProductCreated', { filter: { productId: formattedProductId }, fromBlock: 0 }),
      contract.getPastEvents('StatusUpdated', { filter: { productId: formattedProductId }, fromBlock: 0 }),
      contract.getPastEvents('OwnershipTransferred', { filter: { productId: formattedProductId }, fromBlock: 0 }),
      contract.getPastEvents('ProductInfoUpdated', { filter: { productId: formattedProductId }, fromBlock: 0 })
    ];

    Promise.all(eventPromises)
      .then(function([createdEvents, statusEvents, transferEvents, infoUpdateEvents]) {
        const journey = [];

        // Add creation event
        if (createdEvents.length > 0) {
          const createEvent = createdEvents[0];
          journey.push({
            action: 'Created',
            timestamp: new Date(createEvent.returnValues.timestamp * 1000),
            actor: createEvent.returnValues.owner,
            details: `Batch Number: ${createEvent.returnValues.batchNumber}`
          });
        }

        // Add status updates
        statusEvents.forEach(event => {
          journey.push({
            action: 'Status Updated',
            timestamp: new Date(event.blockNumber * 1000), // Using block number as a timestamp approximation
            actor: event.returnValues.updatedBy,
            oldStatus: getStatusString(event.returnValues.oldStatus),
            newStatus: getStatusString(event.returnValues.newStatus)
          });
        });

        // Add ownership transfers
        transferEvents.forEach(event => {
          journey.push({
            action: 'Ownership Transferred',
            timestamp: new Date(event.blockNumber * 1000),
            from: event.returnValues.previousOwner,
            to: event.returnValues.newOwner,
            quantity: event.returnValues.quantity
          });
        });

        // Add info updates
        infoUpdateEvents.forEach(event => {
          journey.push({
            action: 'Info Updated',
            timestamp: new Date(event.blockNumber * 1000),
            details: event.returnValues.details
          });
        });

        // Sort journey by timestamp
        journey.sort((a, b) => a.timestamp - b.timestamp);

        resolve({
          success: true,
          journey: journey
        });
      })
      .catch(function(error) {
        console.error('Error getting product journey:', error);
        reject({ success: false, error: error.message });
      });
  });
}

/**
 * Get the consumer's product history
 * @returns {Promise<Array>} The consumer's product history
 */
function getConsumerProductHistory() {
  return $q(function(resolve, reject) {
    if (!contract || !currentAccount) {
      reject({ success: false, error: 'Web3 not initialized or no account connected' });
      return;
    }

    console.log('Getting consumer product history');

    // Assuming there's a method to get the consumer's product history in the smart contract
    contract.methods.getConsumerProductHistory().call({ from: currentAccount })
      .then(function(history) {
        resolve({
          success: true,
          history: history.map(item => ({
            productId: item.productId,
            purchaseDate: new Date(parseInt(item.purchaseDate) * 1000),
            quantity: parseInt(item.quantity),
            price: web3.utils.fromWei(item.price, 'ether')
          }))
        });
      })
      .catch(function(error) {
        console.error('Error getting consumer product history:', error);
        reject({ success: false, error: error.message });
      });
  });
}

/**
 * Scan a product QR code
 * @param {string} qrData - The data from the scanned QR code
 * @returns {Promise<Object>} The product details
 */
function scanProductQR(qrData) {
  return $q(function(resolve, reject) {
    try {
      const productId = JSON.parse(qrData).productId;
      verifyProduct(productId)
        .then(function(result) {
          if (result.success && result.isAuthentic) {
            resolve({ success: true, product: result.product });
          } else {
            reject({ success: false, error: 'Product not found or not authentic' });
          }
        })
        .catch(function(error) {
          console.error('Error scanning product QR:', error);
          reject({ success: false, error: error.message });
        });
    } catch (error) {
      console.error('Error parsing QR data:', error);
      reject({ success: false, error: 'Invalid QR code data' });
    }
  });
}


return {
  connectWallet,
  disconnectWallet,
  isWalletConnected,
  getBalance,
  getCurrentAddress,
  registerProductOnBlockchain,
  checkProductExistsOnBlockchain,
  convertToBytes32,
  updateProductStatusOnBlockchain,
  isValidHex,
  transferOwnershipOnBlockchain,
  initiateTransferOnBlockchain,
  getProductFromBlockchain,
  getTransactionReceipt,
  cancelTransferOnBlockchain,
  triggerPaymentOnBlockchain,
  getCurrentAccount,
  // New functions for distributor integration
  acceptTransferOnBlockchain,
  initiateDistributorTransferOnBlockchain,
  updateProductInfoOnBlockchain,
  getPendingTransfersFromBlockchain,
  initiateTransferToRetailer,
  checkTransferStatus,
  // Retailer specific functions
  acceptTransferAsRetailer,
  updateProductInfoAsRetailer,
  initiateRetailerToConsumerTransfer,
  getRetailerPendingTransfers,
  recordSaleToConsumer,
  // consumer specific functions
  verifyProduct,
  getStatusString,
  getProductJourney,
  checkTransferExistsOnBlockchain,
  estimateGasPrice,
  acceptTransferAsConsumer,
  cancelTransferOnBlockchain, // duplicate function but for consumer
  submitProductFeedback,
  getConsumerProductHistory,
  scanProductQR
};
}]);
