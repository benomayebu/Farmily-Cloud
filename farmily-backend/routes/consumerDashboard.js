/**
 * Consumer Dashboard Routes
 * 
 * This module defines the API routes for the consumer dashboard in the food traceability platform.
 * It handles product viewing, transfer acceptance, and various consumer-specific operations.
 */

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Transfer = require('../models/Transfer');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');
const Web3Service = require('../services/Web3Service');

/**
 * Middleware to ensure the authenticated user is a consumer
 */
const ensureConsumer = (req, res, next) => {
  if (req.user.userType !== 'consumer') {
    return res.status(403).json({ message: 'Access denied. Consumer only.' });
  }
  next();
};

// Apply authentication and consumer check to all routes
router.use(auth);
router.use(ensureConsumer);

/**
 * Handle errors and send appropriate response
 * @param {Error} error - The error object
 * @param {Object} res - Express response object
 */
const handleError = (error, res) => {
  console.error('Error:', error);
  const statusCode = error.statusCode || 500;
  const message = error.message || 'An unexpected error occurred';
  res.status(statusCode).json({ message });
};

/**
 * Route to get all products owned by the consumer
 * @route GET /api/consumer/products
 */
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ currentOwner: req.user.id });
    console.log('Products fetched for consumer:', products.length);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    handleError(error, res);
  }
});

/**
 * Route to get product details including full traceability information
 * @route GET /api/consumer/products/:productId/details
 */
router.get('/products/:productId/details', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id })
      .populate('originalOwner', 'username location')
      .populate('previousOwner', 'username location userType')
      .populate('currentOwner', 'username location userType');

    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    // Get the latest blockchain data
    const blockchainData = await Web3Service.getProductFromBlockchain(product.blockchainId);
    if (!blockchainData.success) {
      throw new Error(blockchainData.error || 'Failed to get product data from blockchain');
    }

    // Fetch transaction history
    const transactions = await Transaction.find({ product: product._id })
      .populate('fromUser', 'username userType')
      .populate('toUser', 'username userType')
      .sort({ createdAt: 1 });

    const productDetails = {
      product: {
        _id: product._id,
        type: product.type,
        batchNumber: product.batchNumber,
        origin: product.origin,
        productionDate: product.productionDate,
        status: product.status,
        quantity: product.quantity,
        price: product.price,
        blockchainId: product.blockchainId,
        storageConditions: product.storageConditions,
        transportationMode: product.transportationMode,
        transportationDetails: product.transportationDetails,
        estimatedDeliveryDate: product.estimatedDeliveryDate,
        certifications: product.certifications
      },
      farmer: product.originalOwner,
      distributor: product.previousOwner,
      retailer: product.currentOwner,
      blockchainStatus: blockchainData.product.status,
      blockchainQuantity: blockchainData.product.quantity,
      transactionHistory: transactions.map(tx => ({
        date: tx.createdAt,
        from: { username: tx.fromUser.username, type: tx.fromUser.userType },
        to: { username: tx.toUser.username, type: tx.toUser.userType },
        quantity: tx.quantity,
        type: tx.transactionType
      }))
    };

    console.log('Product details fetched:', product._id);
    res.json(productDetails);
  } catch (error) {
    console.error('Error fetching product details:', error);
    handleError(error, res);
  }
});

/**
 * Route to accept a transfer from a retailer
 * @route POST /api/consumer/acceptTransfer/:transferId
 */
router.post('/acceptTransfer/:transferId', [
  param('transferId').isMongoId().withMessage('Invalid transfer ID'),
  body('ethereumAddress').isEthereumAddress().withMessage('Invalid Ethereum address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { transferId } = req.params;
    const { ethereumAddress } = req.body;

    console.log(`Accepting transfer: ${transferId} for address: ${ethereumAddress}`);

    const transfer = await Transfer.findOne({ _id: transferId, toUser: req.user.id, status: 'pending' });
    if (!transfer) {
      return res.status(404).json({ message: 'Transfer not found or already processed' });
    }

    // Check transfer status on blockchain
    const transferStatus = await Web3Service.checkTransferStatus(transfer.blockchainTx);
    console.log(`Blockchain transfer status: ${transferStatus}`);

    if (transferStatus === 'completed') {
      transfer.status = 'completed';
      await transfer.save();
      
      const product = await Product.findById(transfer.product);
      if (product) {
        product.currentOwner = req.user.id;
        product.quantity = transfer.quantity;
        await product.save();
      }
      
      return res.status(200).json({ 
        message: 'Transfer is already completed on the blockchain. Database updated.',
        status: 'completed',
        transfer: transfer
      });
    }

    if (transferStatus === 'failed') {
      transfer.status = 'failed';
      await transfer.save();
      return res.status(400).json({ 
        message: 'Transfer failed on the blockchain.',
        status: 'failed',
        transfer: transfer
      });
    }

    // Proceed with accepting the transfer
    const blockchainResult = await Web3Service.acceptTransferAsConsumer(transfer.blockchainTx, ethereumAddress);
    if (!blockchainResult.success) {
      return res.status(500).json({ message: 'Blockchain transfer acceptance failed', error: blockchainResult.error });
    }

    transfer.status = 'completed';
    await transfer.save();

    const product = await Product.findById(transfer.product);
    if (product) {
      product.currentOwner = req.user.id;
      product.quantity = transfer.quantity;
      await product.save();
    }

    const transaction = new Transaction({
      product: product._id,
      fromUser: transfer.fromUser,
      toUser: req.user.id,
      quantity: transfer.quantity,
      transactionType: 'Received from Retailer',
      status: 'Completed',
      blockchainTxHash: blockchainResult.txHash
    });
    await transaction.save();

    res.json({ 
      message: 'Transfer accepted successfully', 
      transfer, 
      blockchainTx: blockchainResult.txHash 
    });
  } catch (error) {
    console.error('Error in acceptTransfer:', error);
    handleError(error, res);
  }
});

/**
 * Route to get pending transfers for the consumer
 * @route GET /api/consumer/pendingTransfers
 */
router.get('/pendingTransfers', async (req, res) => {
  try {
    const pendingTransfers = await Transfer.find({ 
      toUser: req.user.id,
      status: 'pending'
    }).populate('product').populate('fromUser', 'username');
    console.log('Pending transfers found:', pendingTransfers.length);
    res.json(pendingTransfers);
  } catch (error) {
    console.error('Error fetching pending transfers:', error);
    handleError(error, res);
  }
});

/**
 * Route to get transaction history for the consumer
 * @route GET /api/consumer/transactionHistory
 */
router.get('/transactionHistory', async (req, res) => {
  try {
    const transactions = await Transaction.find({ toUser: req.user.id })
      .populate('product')
      .populate('fromUser', 'username userType')
      .populate('toUser', 'username userType')
      .sort({ createdAt: -1 });
    
    console.log('Fetched transactions:', transactions.length);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    handleError(error, res);
  }
});

/**
 * Route to submit feedback for a product
 * @route POST /api/consumer/submitFeedback/:productId
 */
router.post('/submitFeedback/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const { rating, comment } = req.body;

    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    const feedback = {
      user: req.user.id,
      rating,
      comment,
      date: new Date()
    };

    product.consumerFeedback = product.consumerFeedback || [];
    product.consumerFeedback.push(feedback);
    await product.save();

    console.log('Feedback submitted for product:', productId);
    res.json({ message: 'Feedback submitted successfully', feedback });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    handleError(error, res);
  }
});

/**
 * Route to get full product information including farmer, distributor, and retailer details
 * @route GET /api/consumer/products/:productId/fullInfo
 */
router.get('/products/:productId/fullInfo', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const product = await Product.findOne({ _id: productId })
      .populate('originalOwner', 'username location')
      .populate('currentOwner', 'username location userType')
      .populate({
        path: 'ownershipHistory.owner',
        select: 'username location userType'
      });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get the latest blockchain data
    const blockchainData = await Web3Service.getProductFromBlockchain(product.blockchainId);
    if (!blockchainData.success) {
      throw new Error(blockchainData.error || 'Failed to get product data from blockchain');
    }

    const farmer = product.originalOwner;
    const distributor = product.ownershipHistory.find(h => h.owner.userType === 'distributor');
    const retailer = product.currentOwner.userType === 'retailer' ? product.currentOwner : null;
    const consumer = product.currentOwner.userType === 'consumer' ? product.currentOwner : null;

    const fullProductInfo = {
      product: {
        _id: product._id,
        type: product.type,
        batchNumber: product.batchNumber,
        origin: product.origin,
        productionDate: product.productionDate,
        status: product.status,
        quantity: product.quantity,
        price: product.price,
        blockchainId: product.blockchainId,
        storageConditions: product.storageConditions,
        transportationMode: product.transportationMode,
        transportationDetails: product.transportationDetails,
        estimatedDeliveryDate: product.estimatedDeliveryDate,
        certifications: product.certifications
      },
      farmer: farmer ? {
        username: farmer.username,
        location: farmer.location
      } : null,
      distributor: distributor ? {
        username: distributor.owner.username,
        location: distributor.owner.location
      } : null,
      currentOwner: retailer ? {
        username: retailer.username,
        location: retailer.location
      } : null,
      consumer: consumer ? {
        username: consumer.username,
        location: consumer.location
      } : null,
      blockchainStatus: blockchainData.product.status,
      blockchainQuantity: blockchainData.product.quantity,
      ownershipHistory: product.ownershipHistory.map(entry => ({
        username: entry.owner.username,
        userType: entry.owner.userType,
        timestamp: entry.timestamp
      }))
    };

    console.log('Full product info fetched:', product._id);
    res.json(fullProductInfo);
  } catch (error) {
    console.error('Error fetching full product info:', error);
    res.status(500).json({ message: 'Error fetching product information', error: error.message });
  }
});

/**
 * Route to verify product authenticity on the blockchain
 * @route GET /api/consumer/verifyProduct/:productId
 */
router.get('/verifyProduct/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });

    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    const verificationResult = await Web3Service.verifyProductOnBlockchain(product.blockchainId);

    console.log('Product verification result:', verificationResult);
    res.json(verificationResult);
  } catch (error) {
    console.error('Error verifying product:', error);
    handleError(error, res);
  }
});

/**
 * Route to get product history
 * @route GET /api/consumer/products/:productId/history
 */
router.get('/products/:productId/history', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });

    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    const transactions = await Transaction.find({ product: productId })
      .populate('fromUser', 'username userType')
      .populate('toUser', 'username userType')
      .sort({ createdAt: 1 });

    const history = transactions.map(tx => ({
      date: tx.createdAt,
      from: {
        username: tx.fromUser.username,
        userType: tx.fromUser.userType
      },
      to: {
        username: tx.toUser.username,
        userType: tx.toUser.userType
      },
      quantity: tx.quantity,
      type: tx.transactionType,
      status: tx.status
    }));

    console.log('Product history fetched:', productId);
    res.json(history);
  } catch (error) {
    console.error('Error fetching product history:', error);
    handleError(error, res);
  }
});

/**
 * Route to get product information from a QR code
 * @route POST /api/consumer/getProductFromQR
 */
router.post('/getProductFromQR', async (req, res) => {
  try {
    const { qrData } = req.body;
    const productData = JSON.parse(qrData);

    const product = await Product.findById(productData.productId)
      .populate('originalOwner', 'username location')
      .populate('previousOwner', 'username location userType')
      .populate('currentOwner', 'username location userType');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get blockchain data
    const blockchainData = await Web3Service.getProductFromBlockchain(product.blockchainId);

    const productInfo = {
      product: {
        _id: product._id,
        type: product.type,
        batchNumber: product.batchNumber,
        origin: product.origin,
        productionDate: product.productionDate,
        status: product.status,
        quantity: product.quantity,
        blockchainId: product.blockchainId
      },
      farmer: {
        username: product.originalOwner.username,
        location: product.originalOwner.location
      },
      distributor: product.previousOwner.userType === 'distributor' ? {
        username: product.previousOwner.username,
        location: product.previousOwner.location
      } : null,
      retailer: product.currentOwner.userType === 'retailer' ? {
        username: product.currentOwner.username,
        location: product.currentOwner.location
      } : null,
      blockchainStatus: blockchainData.product.status,
      blockchainQuantity: blockchainData.product.quantity
    };

    res.json(productInfo);
  } catch (error) {
    console.error('Error getting product from QR:', error);
    res.status(500).json({ message: 'Error fetching product information', error: error.message });
  }
});

/**
 * Route to update consumer's Ethereum address
 * @route PUT /api/consumer/updateEthereumAddress
 */
router.put('/updateEthereumAddress', [
  body('ethereumAddress').isEthereumAddress().withMessage('Invalid Ethereum address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ethereumAddress } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { ethereumAddress },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Ethereum address updated for user:', user._id);
    res.json({ message: 'Ethereum address updated successfully', user });
  } catch (error) {
    console.error('Error updating Ethereum address:', error);
    handleError(error, res);
  }
});

/**
 * Route to get consumer's purchase history
 * @route GET /api/consumer/purchaseHistory
 */
router.get('/purchaseHistory', async (req, res) => {
  try {
    const purchases = await Transaction.find({ toUser: req.user.id, transactionType: 'Received from Retailer' })
      .populate('product', 'type batchNumber price')
      .populate('fromUser', 'username')
      .sort({ createdAt: -1 });

    const purchaseHistory = purchases.map(purchase => ({
      date: purchase.createdAt,
      productType: purchase.product.type,
      batchNumber: purchase.product.batchNumber,
      quantity: purchase.quantity,
      price: purchase.product.price,
      totalCost: purchase.quantity * purchase.product.price,
      retailer: purchase.fromUser.username
    }));

    console.log('Purchase history fetched for consumer:', req.user.id);
    res.json(purchaseHistory);
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    handleError(error, res);
  }
});

/**
 * Route to get product certifications
 * @route GET /api/consumer/products/:productId/certifications
 */
router.get('/products/:productId/certifications', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });

    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    console.log('Certifications fetched for product:', productId);
    res.json(product.certifications || []);
  } catch (error) {
    console.error('Error fetching product certifications:', error);
    handleError(error, res);
  }
});

module.exports = router;