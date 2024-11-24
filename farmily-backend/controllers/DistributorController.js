// controllers/DistributorController.js

const Product = require('../models/Product');
const Transfer = require('../models/Transfer');
const Transaction = require('../models/Transaction');
const Web3Service = require('../services/Web3Service'); // Backend service to interact with the blockchain

/**
 * Get pending transfers for the distributor
 */
exports.getPendingTransfers = async (req, res) => {
  try {
    const pendingTransfers = await Transfer.find({ 
      toId: req.user._id,
      status: 'pending'
    }).populate('productId fromId');
    
    res.status(200).json({ success: true, data: pendingTransfers });
  } catch (error) {
    console.error('Error fetching pending transfers:', error);
    res.status(500).json({ success: false, message: 'Error fetching pending transfers', error: error.message });
  }
};

/**
 * Accept a transfer from a farmer
 */
exports.acceptTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;
    const transfer = await Transfer.findById(transferId).populate('productId');
    
    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    if (transfer.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Transfer is not in pending status' });
    }

    const product = transfer.productId;

    // Update product ownership and quantity
    product.previousOwner = product.currentOwner;
    product.currentOwner = req.user._id;
    product.quantity = transfer.quantity;

    // Update transfer status
    transfer.status = 'completed';
    transfer.completedDate = new Date();

    // Create a new transaction record
    const transaction = new Transaction({
      productId: product._id,
      fromId: transfer.fromId,
      toId: req.user._id,
      quantity: transfer.quantity,
      transactionType: 'Received from Farmer',
      status: 'Completed'
    });

    // Accept transfer on the blockchain
    const blockchainResponse = await Web3Service.acceptTransferOnBlockchain(product._id, transfer.quantity);

    // Save all changes
    await Promise.all([
      product.save(),
      transfer.save(),
      transaction.save()
    ]);

    res.status(200).json({ 
      success: true, 
      message: 'Transfer accepted successfully',
      data: { product, transfer, transaction },
      blockchainResponse 
    });
  } catch (error) {
    console.error('Error accepting transfer:', error);
    res.status(500).json({ success: false, message: 'Error accepting transfer', error: error.message });
  }
};

/**
 * Update product information after receiving from farmer
 */
exports.updateProductInfo = async (req, res) => {
  try {
    const { productId } = req.params;
    const { storageConditions, transportationDetails } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.currentOwner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this product' });
    }

    product.storageConditions = storageConditions;
    product.transportationDetails = transportationDetails;

    await product.save();

    // Update product info on the blockchain
    const blockchainResponse = await Web3Service.updateProductInfoOnBlockchain(productId, { storageConditions, transportationDetails });

    res.status(200).json({ 
      success: true, 
      message: 'Product information updated successfully',
      data: product,
      blockchainResponse 
    });
  } catch (error) {
    console.error('Error updating product information:', error);
    res.status(500).json({ success: false, message: 'Error updating product information', error: error.message });
  }
};

/**
 * Perform a quality check on a product
 */
exports.performQualityCheck = async (req, res) => {
  try {
    const { productId } = req.params;
    const { status, notes } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.currentOwner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to perform quality check on this product' });
    }

    product.qualityCheckStatus = status;
    product.qualityCheckNotes = notes;

    await product.save();

    // Record quality check on the blockchain
    const blockchainResponse = await Web3Service.recordQualityCheckOnBlockchain(productId, status, notes);

    res.status(200).json({ 
      success: true, 
      message: 'Quality check performed successfully',
      data: product,
      blockchainResponse 
    });
  } catch (error) {
    console.error('Error performing quality check:', error);
    res.status(500).json({ success: false, message: 'Error performing quality check', error: error.message });
  }
};

/**
 * Initiate transfer to a retailer
 */
exports.initiateTransferToRetailer = async (req, res) => {
  try {
    const { productId, retailerId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.currentOwner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to transfer this product' });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient quantity available for transfer' });
    }

    // Create a new transfer record
    const transfer = new Transfer({
      productId: product._id,
      fromId: req.user._id,
      toId: retailerId,
      quantity,
      status: 'pending'
    });

    // Initiate transfer on the blockchain
    const blockchainResponse = await Web3Service.initiateTransferOnBlockchain(productId, retailerId, quantity);

    await transfer.save();

    res.status(200).json({ 
      success: true, 
      message: 'Transfer to retailer initiated successfully',
      data: transfer,
      blockchainResponse 
    });
  } catch (error) {
    console.error('Error initiating transfer to retailer:', error);
    res.status(500).json({ success: false, message: 'Error initiating transfer to retailer', error: error.message });
  }
};

/**
 * Get inventory for the distributor
 */
exports.getInventory = async (req, res) => {
  try {
    const inventory = await Product.find({ currentOwner: req.user._id });
    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ success: false, message: 'Error fetching inventory', error: error.message });
  }
};

/**
 * Get transaction history for the distributor
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [{ fromId: req.user._id }, { toId: req.user._id }]
    }).populate('productId fromId toId');
    
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ success: false, message: 'Error fetching transaction history', error: error.message });
  }
};