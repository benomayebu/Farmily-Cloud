/**
 * Farmer Controller
 * 
 * This controller handles the server-side logic for farmer-related operations in the food traceability platform.
 * It manages product registration, status updates, transfers, and interactions with both the database and blockchain.
 */

const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Transfer = require('../models/Transfer');
const User = require('../models/User');
const Web3Service = require('../services/Web3Service');

/**
 * Generic error handler for controller functions
 * @param {Error} error - The error object
 * @param {Object} res - Express response object
 */
const handleError = (error, res) => {
  console.error('Error:', error);
  res.status(500).json({ message: error.message || 'An unexpected error occurred' });
};

/**
 * Get all products for the authenticated farmer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({ currentOwner: req.user.id });
    const formattedProducts = products.map(product => ({
      _id: product._id,
      blockchain_id: product.blockchain_id,
      batchNumber: product.batchNumber,
      type: product.type,
      quantity: product.quantity,
      price: product.price,
      productionDate: product.productionDate,
      status: product.status,
      displayName: `${product.type} - Batch: ${product.batchNumber} - Qty: ${product.quantity} - Price: ${product.price} ETH`
    }));
    res.json(formattedProducts);
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Register a new product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.registerProduct = async (req, res) => {
  try {
    const { type, origin, productionDate, batchNumber, quantity, price, blockchainTx, blockchain_id } = req.body;

    // Create a new product instance
    const product = new Product({
      type,
      origin,
      productionDate,
      batchNumber,
      quantity,
      price,
      currentOwner: req.user.id,
      blockchainTxHash: blockchainTx,
      blockchain_id
    });

    // Save the product to the database
    const savedProduct = await product.save();
    res.status(201).json({ message: 'Product registered successfully', product: savedProduct });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A product with this batch number or blockchain ID already exists' });
    }
    handleError(error, res);
  }
};

/**
 * Update the status of a product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateProductStatus = async (req, res) => {
  try {
    const productId = req.params.id;
    const { status, blockchainTx } = req.body;

    // Find the product and ensure the current user is the owner
    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });
    if (!product) {
      return res.status(404).json({ error: 'Product not found or you do not own this product' });
    }

    // Verify the blockchain transaction
    const txReceipt = await Web3Service.getTransactionReceipt(blockchainTx);
    if (!txReceipt || !txReceipt.status) {
      return res.status(400).json({ error: 'Blockchain transaction failed or not found' });
    }

    // Update the product status
    product.status = status;
    product.blockchainTxHash = blockchainTx;
    await product.save();

    res.status(200).json({ message: 'Product status updated successfully', product });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Initiate a transfer of product ownership
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.initiateTransfer = async (req, res) => {
  try {
    const { productId, newOwner, quantity, blockchainTx } = req.body;

    // Find the product and ensure the current user is the owner
    const product = await Product.findOne({ blockchain_id: productId, currentOwner: req.user.id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found or you do not own this product' });
    }

    // Check if there's enough quantity to transfer
    if (product.quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient quantity available for transfer' });
    }

    // Find the new owner (distributor)
    const newOwnerUser = await User.findOne({ username: newOwner, userType: 'distributor' });
    if (!newOwnerUser) {
      return res.status(404).json({ message: 'Distributor not found' });
    }

    // Verify the blockchain transaction
    const txReceipt = await Web3Service.getTransactionReceipt(blockchainTx);
    if (!txReceipt || !txReceipt.status) {
      return res.status(400).json({ error: 'Blockchain transaction failed or not found' });
    }

    // Create a new transfer record
    const transfer = new Transfer({
      productId: product._id,
      fromId: req.user.id,
      toId: newOwnerUser._id,
      quantity,
      status: 'pending',
      blockchainTxHash: blockchainTx
    });
    await transfer.save();

    // Update the product quantity
    product.quantity -= quantity;
    await product.save();

    res.json({ message: 'Transfer initiated successfully', transfer, transactionHash: blockchainTx });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Cancel a pending transfer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.cancelTransfer = async (req, res) => {
  try {
    const transfer = await Transfer.findOne({ _id: req.params.transferId, fromId: req.user.id, status: 'pending' });
    if (!transfer) {
      return res.status(404).json({ message: 'Transfer not found or you do not have permission to cancel it' });
    }

    const txHash = req.body.blockchainTx;
    const txReceipt = await Web3Service.getTransactionReceipt(txHash);
    if (!txReceipt || !txReceipt.status) {
      return res.status(400).json({ error: 'Blockchain transaction failed or not found' });
    }

    // Update the transfer status
    transfer.status = 'cancelled';
    transfer.blockchainTxHash = txHash;
    await transfer.save();

    // Restore the product quantity
    const product = await Product.findById(transfer.productId);
    if (product) {
      product.quantity += transfer.quantity;
      await product.save();
    }

    res.json({ message: 'Transfer cancelled successfully', transfer, transactionHash: txHash });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Get the list of distributors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDistributors = async (req, res) => {
  try {
    const distributors = await User.find({ userType: 'distributor' }).select('username firstName lastName ethereumAddress');
    res.json(distributors);
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Get the transaction history for the farmer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({ $or: [{ fromId: req.user.id }, { toId: req.user.id }] })
      .populate('productId')
      .sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Get production insights for the farmer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProductionInsights = async (req, res) => {
  try {
    const products = await Product.find({ currentOwner: req.user.id });
    const insights = {
      totalProducts: products.length,
      totalQuantity: products.reduce((sum, product) => sum + product.quantity, 0),
      totalRevenue: products.reduce((sum, product) => sum + (product.price * product.quantity), 0),
      productTypes: {}
    };

    products.forEach(product => {
      if (!insights.productTypes[product.type]) {
        insights.productTypes[product.type] = 0;
      }
      insights.productTypes[product.type] += product.quantity;
    });

    res.json(insights);
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Sync products with the blockchain
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.syncProducts = async (req, res) => {
  try {
    const products = await Product.find({ currentOwner: req.user.id });
    const syncResults = await Promise.all(products.map(async (product) => {
      try {
        const blockchainProduct = await Web3Service.getProductFromBlockchain(product.blockchain_id);
        if (blockchainProduct.success) {
          product.status = blockchainProduct.product.status;
          product.quantity = blockchainProduct.product.quantity;
          product.currentOwner = blockchainProduct.product.currentOwner;
          await product.save();
          return { productId: product._id, synced: true };
        } else {
          return { productId: product._id, synced: false, error: 'Product not found on blockchain' };
        }
      } catch (error) {
        return { productId: product._id, synced: false, error: error.message };
      }
    }));

    res.json({ message: 'Products synced with blockchain', results: syncResults });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Get a distributor's Ethereum address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDistributorAddress = async (req, res) => {
  try {
    const distributor = await User.findOne({ username: req.params.username, userType: 'distributor' });
    if (!distributor) {
      return res.status(404).json({ message: 'Distributor not found' });
    }
    res.json({ ethereumAddress: distributor.ethereumAddress });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Get pending transfers for the farmer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getPendingTransfers = async (req, res) => {
  try {
    const pendingTransfers = await Transfer.find({ 
      $or: [{ fromId: req.user.id }, { toId: req.user.id }],
      status: 'pending'
    }).populate('productId');
    res.json(pendingTransfers);
  } catch (error) {
    handleError(error, res);
  }
};