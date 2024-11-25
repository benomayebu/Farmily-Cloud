/**
 * Consumer Dashboard Routes
 * 
 * This module defines the API routes for the consumer dashboard in the food traceability platform.
 * It handles product viewing, QR code scanning, product authentication, and transfer acceptance.
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
 * @route GET /api/consumer/myProducts
 */
router.get('/myProducts', async (req, res) => {
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
 * Route to get product details by scanning QR code
 * @route POST /api/consumer/scanProduct
 */
router.post('/scanProduct', [
  body('qrCodeData').isString().notEmpty().withMessage('QR code data is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { qrCodeData } = req.body;
    // Assuming QR code contains the product ID
    const productId = qrCodeData;

    const product = await Product.findById(productId)
      .populate('currentOwner', 'username')
      .populate('originalOwner', 'username');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    console.log('Product details fetched from QR code:', product._id);
    res.json(product);
  } catch (error) {
    console.error('Error fetching product details from QR code:', error);
    handleError(error, res);
  }
});

/**
 * Route to verify product authenticity
 * @route POST /api/consumer/verifyProduct
 */
router.post('/verifyProduct', [
  body('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.body;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const verificationResult = await Web3Service.verifyProductOnBlockchain(product.blockchainId);
    
    res.json({
      verified: verificationResult.success,
      message: verificationResult.success ? 'Product verified successfully' : 'Product verification failed',
      blockchainData: verificationResult.data
    });
  } catch (error) {
    console.error('Error verifying product:', error);
    handleError(error, res);
  }
});

/**
 * Route to get product journey
 * @route GET /api/consumer/productJourney/:productId
 */
router.get('/productJourney/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const transactions = await Transaction.find({ product: productId })
      .populate('fromUser', 'username userType')
      .populate('toUser', 'username userType')
      .sort({ createdAt: 1 });

    const journey = transactions.map(tx => ({
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
      type: tx.transactionType
    }));

    res.json({
      product: {
        id: product._id,
        type: product.type,
        batchNumber: product.batchNumber
      },
      journey
    });
  } catch (error) {
    console.error('Error fetching product journey:', error);
    handleError(error, res);
  }
});

/**
 * Route to accept a transfer from a retailer
 * @route POST /api/consumer/acceptTransfer/:transferId
 */
router.post('/acceptTransfer/:transferId', [
    param('transferId').isMongoId().withMessage('Invalid transfer ID')
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const { transferId } = req.params;
      const transfer = await Transfer.findOne({ _id: transferId, toUser: req.user.id, status: 'pending' });
  
      if (!transfer) {
        return res.status(404).json({ message: 'Transfer not found or already processed' });
      }
  
      // Update transfer status
      transfer.status = 'completed';
      await transfer.save();
  
      // Update product ownership
      const product = await Product.findById(transfer.product);
      if (product) {
        product.currentOwner = req.user.id;
        product.quantity = transfer.quantity;
        await product.save();
      }
  
      // Create transaction record
      const transaction = new Transaction({
        product: transfer.product,
        fromUser: transfer.fromUser,
        toUser: req.user.id,
        quantity: transfer.quantity,
        transactionType: 'Purchase by Consumer',
        status: 'Completed',
        blockchainTxHash: transfer.blockchainTx
      });
      await transaction.save();
  
      // Update blockchain status
      await Web3Service.updateTransferStatusOnBlockchain(transfer.blockchainTx, 'completed');
  
      console.log('Transfer accepted:', transfer._id);
      res.json({ message: 'Transfer accepted successfully', transfer });
    } catch (error) {
      console.error('Error accepting transfer:', error);
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

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const feedback = {
      consumer: req.user.id,
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
 * Route to get product history for a consumer
 * @route GET /api/consumer/productHistory
 */
router.get('/productHistory', async (req, res) => {
  try {
    const transactions = await Transaction.find({ toUser: req.user.id })
      .populate('product', 'type batchNumber')
      .populate('fromUser', 'username userType')
      .sort({ createdAt: -1 });

    const history = transactions.map(tx => ({
      date: tx.createdAt,
      product: {
        id: tx.product._id,
        type: tx.product.type,
        batchNumber: tx.product.batchNumber
      },
      fromUser: {
        username: tx.fromUser.username,
        userType: tx.fromUser.userType
      },
      quantity: tx.quantity,
      transactionType: tx.transactionType
    }));

    console.log('Product history fetched for consumer:', history.length, 'items');
    res.json(history);
  } catch (error) {
    console.error('Error fetching product history:', error);
    handleError(error, res);
  }
});

/**
 * Route to get detailed product information
 * @route GET /api/consumer/productDetails/:productId
 */
router.get('/productDetails/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const product = await Product.findById(productId)
      .populate('originalOwner', 'username location')
      .populate('currentOwner', 'username userType');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const blockchainData = await Web3Service.getProductFromBlockchain(product.blockchainId);
    
    const productDetails = {
      _id: product._id,
      type: product.type,
      batchNumber: product.batchNumber,
      origin: product.origin,
      productionDate: product.productionDate,
      quantity: product.quantity,
      status: product.status,
      originalOwner: {
        username: product.originalOwner.username,
        location: product.originalOwner.location
      },
      currentOwner: {
        username: product.currentOwner.username,
        userType: product.currentOwner.userType
      },
      blockchainData: blockchainData.success ? blockchainData.data : null
    };

    console.log('Detailed product information fetched:', productId);
    res.json(productDetails);
  } catch (error) {
    console.error('Error fetching detailed product information:', error);
    handleError(error, res);
  }
});

module.exports = router;