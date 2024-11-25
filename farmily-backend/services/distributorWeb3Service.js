// backend/services/distributorWeb3Service.js

const Web3 = require('web3');
const BN = Web3.utils.BN;
const contractABI = require('../config/contractABI.json');
require('dotenv').config();

// Initialize Web3 instance
const web3 = new Web3(new Web3.providers.HttpProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`));
const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Set up account with private key
const privateKey = process.env.DISTRIBUTOR_PRIVATE_KEY;
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
web3.eth.accounts.wallet.add(account);

// Status enum for product lifecycle
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

// Handle nonces
let nonce = null;

/**
 * Get the next nonce for transactions.
 * @returns {Promise<number>} The next nonce to use.
 */
async function getNonce() {
  if (nonce === null) {
    nonce = await web3.eth.getTransactionCount(account.address);
  }
  return nonce++;
}

/**
 * Error handler for blockchain operations.
 * @param {Error} error - The error to handle.
 * @returns {Promise<never>} - Rejects with an error message.
 */
function handleError(error) {
  console.error('Blockchain Error:', error);
  return Promise.reject(error.message || 'An unexpected blockchain error occurred');
}

/**
 * Get the Ethereum account address from the private key.
 * @returns {string} - The account address.
 */
function getAccount() {
  return account.address;
}

/**
 * Hash the MongoDB ObjectId to a uint256-compatible value for the blockchain.
 * @param {string} objectId - The original MongoDB ObjectId.
 * @returns {string} - A hex string representing a uint256-compatible hash.
 */
function hashProductId(objectId) {
  const idString = objectId.toString();
  const hashedId = web3.utils.keccak256(idString);
  console.log(`Original ID: ${idString}, Hashed ID: ${hashedId}`);
  return hashedId;
}

/**
 * Check for pending transactions.
 * @returns {Promise<number>} The number of pending transactions.
 */
async function checkPendingTransactions() {
  const pendingNonce = await web3.eth.getTransactionCount(account.address, 'pending');
  const confirmedNonce = await web3.eth.getTransactionCount(account.address, 'latest');
  return pendingNonce - confirmedNonce;
}

/**
 * Accept a transfer from a farmer on the blockchain.
 * @param {string} productId - The ID of the product to receive.
 * @param {number} quantity - The quantity of the product to receive.
 * @returns {Promise<Object>} - Resolves with the transaction result.
 */
async function acceptTransferOnBlockchain(productId, quantity) {
  try {
    const pendingTxCount = await checkPendingTransactions();
    if (pendingTxCount > 0) {
      console.log(`There are ${pendingTxCount} pending transactions. Waiting for them to clear...`);
    }

    const hashedProductId = hashProductId(productId);

    const gasEstimate = await contract.methods.acceptTransfer(hashedProductId, quantity)
      .estimateGas({ from: account.address });

    const result = await contract.methods.acceptTransfer(hashedProductId, quantity)
      .send({
        from: account.address,
        gas: Math.floor(gasEstimate * 1.5),
        nonce: await getNonce()
      });

    console.log('Transfer accepted successfully on blockchain. Transaction hash:', result.transactionHash);
    return { success: true, txHash: result.transactionHash };
  } catch (error) {
    console.error('Error accepting transfer on blockchain:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update product information on the blockchain after receiving it from a farmer.
 * @param {string} productId - The ID of the product to update.
 * @param {Object} updateData - The data to update (e.g., storage conditions, transportation details).
 * @returns {Promise<Object>} - Resolves with the transaction result.
 */
async function updateProductInfoOnBlockchain(productId, updateData) {
  try {
    const pendingTxCount = await checkPendingTransactions();
    if (pendingTxCount > 0) {
      console.log(`There are ${pendingTxCount} pending transactions. Waiting for them to clear...`);
    }

    const hashedProductId = hashProductId(productId);

    const gasEstimate = await contract.methods.updateProductInfo(hashedProductId, JSON.stringify(updateData))
      .estimateGas({ from: account.address });

    const result = await contract.methods.updateProductInfo(hashedProductId, JSON.stringify(updateData))
      .send({
        from: account.address,
        gas: Math.floor(gasEstimate * 1.5),
        nonce: await getNonce()
      });

    console.log('Product info updated successfully on blockchain. Transaction hash:', result.transactionHash);
    return { success: true, txHash: result.transactionHash };
  } catch (error) {
    console.error('Error updating product info on blockchain:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Transfer ownership of a product to a retailer or consumer on the blockchain.
 * @param {string} productId - The ID of the product to transfer.
 * @param {string} recipientUsername - The username of the recipient (retailer or consumer).
 * @param {number} quantity - The quantity of the product to transfer.
 * @returns {Promise<Object>} - Resolves with the transaction result.
 */
async function transferOwnershipOnBlockchain(productId, recipientUsername, quantity) {
  try {
    const pendingTxCount = await checkPendingTransactions();
    if (pendingTxCount > 0) {
      console.log(`There are ${pendingTxCount} pending transactions. Waiting for them to clear...`);
    }

    // Get recipient's Ethereum address based on their username
    const recipient = await User.findOne({ username: recipientUsername });
    if (!recipient) {
      throw new Error('Recipient not found');
    }

    const hashedProductId = hashProductId(productId);
    const recipientAddress = recipient.ethereumAddress;

    const gasEstimate = await contract.methods.transferOwnership(hashedProductId, recipientAddress, quantity)
      .estimateGas({ from: account.address });

    const result = await contract.methods.transferOwnership(hashedProductId, recipientAddress, quantity)
      .send({
        from: account.address,
        gas: Math.floor(gasEstimate * 1.5),
        nonce: await getNonce()
      });

    console.log('Ownership transferred successfully on blockchain. Transaction hash:', result.transactionHash);
    return { success: true, txHash: result.transactionHash };
  } catch (error) {
    console.error('Error transferring ownership on blockchain:', error);
    return { success: false, error: error.message };
  }
}
/**
 * Record a quality check for a product on the blockchain.
 * @param {string} productId - The ID of the product to check.
 * @param {string} status - The status of the quality check.
 * @param {string} notes - Additional notes for the quality check.
 * @returns {Promise<Object>} - Resolves with the transaction result.
 */
async function recordQualityCheckOnBlockchain(productId, status, notes) {
  try {
    const pendingTxCount = await checkPendingTransactions();
    if (pendingTxCount > 0) {
      console.log(`There are ${pendingTxCount} pending transactions. Waiting for them to clear...`);
    }

    const hashedProductId = hashProductId(productId);
    const statusIndex = statusEnum[status.toLowerCase()] || 0;

    const gasEstimate = await contract.methods.recordQualityCheck(hashedProductId, statusIndex, notes)
      .estimateGas({ from: account.address });

    const result = await contract.methods.recordQualityCheck(hashedProductId, statusIndex, notes)
      .send({
        from: account.address,
        gas: Math.floor(gasEstimate * 1.5),
        nonce: await getNonce()
      });

    console.log('Quality check recorded successfully on blockchain. Transaction hash:', result.transactionHash);
    return { success: true, txHash: result.transactionHash };
  } catch (error) {
    console.error('Error recording quality check on blockchain:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the details of a product from the blockchain.
 * @param {string} productId - The ID of the product to retrieve.
 * @returns {Promise<Object>} - Resolves with the product details.
 */
async function getProductFromBlockchain(productId) {
  try {
    const hashedProductId = hashProductId(productId);
    const product = await contract.methods.getProduct(hashedProductId).call();
    return product;
  } catch (error) {
    console.error('Error getting product from blockchain:', error);
    throw error;
  }
}

// Test connection to the blockchain node
web3.eth.net.isListening()
  .then(() => console.log('Connected to blockchain node'))
  .catch(e => console.log('Failed to connect to blockchain node:', e));

module.exports = {
  acceptTransferOnBlockchain,
  updateProductInfoOnBlockchain,
  transferOwnershipOnBlockchain,
  recordQualityCheckOnBlockchain,
  getProductFromBlockchain,
  checkPendingTransactions,
  hashProductId,
  getAccount
};