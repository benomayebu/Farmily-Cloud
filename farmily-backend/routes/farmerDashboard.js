/**
 * Farmer Dashboard Routes
 * 
 * This module defines the API routes for the farmer dashboard in the food traceability platform.
 * It handles product management, transfers, and various farmer-specific operations.
 */

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Transfer = require('../models/Transfer');
const User = require('../models/user.js');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');
const Web3Service = require('../services/Web3Service');

/**
 * Middleware to ensure the authenticated user is a farmer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const ensureFarmer = (req, res, next) => {
  if (req.user.userType !== 'farmer') {
    return res.status(403).json({ message: 'Access denied. Farmer only.' });
  }
  next();
};


// Apply authentication and farmer check to all routes
router.use(auth);
router.use(ensureFarmer);

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
 * Route to get all products for the farmer
 * @route GET /api/farmer/products
 */
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ currentOwner: req.user.id });
    const formattedProducts = products.map(product => {
      if (!product.blockchainId) {
        console.warn(`Product with batchNumber: ${product.batchNumber} has undefined blockchainId`);
      }
      return {
        _id: product._id,
        blockchainId: product.blockchainId, // Ensure you're using camelCase consistently
        batchNumber: product.batchNumber,
        type: product.type,
        quantity: product.quantity,
        price: product.price,
        productionDate: product.productionDate,
        status: product.status,
        displayName: `${product.type} - Batch: ${product.batchNumber} - Qty: ${product.quantity} - Price: ${product.price} ETH`
      };
    });
    console.log('Returning products:', formattedProducts);
    res.json(formattedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});


/**
 * Route to get a single product by ID
 * @route GET /api/farmer/products/:id
 */
router.get('/products/:id', [
  auth,
  param('id').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const productId = req.params.id;
    // Populate the currentOwner field with the User document
    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id })
      .populate('currentOwner', 'ethereumAddress');

    if (!product) {
      return res.status(404).json({ error: 'Product not found or you do not own this product' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'An error occurred while fetching the product' });
  }
});

/**
 * Route to update the user's Ethereum address
 * @route PUT /api/farmer/updateEthereumAddress
 */
router.put('/updateEthereumAddress', auth, async (req, res) => {
  try {
    const { ethereumAddress } = req.body;
    if (!ethereumAddress) {
      return res.status(400).json({ error: 'Ethereum address is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { ethereumAddress },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Ethereum address updated successfully', user });
  } catch (error) {
    console.error('Error updating Ethereum address:', error);
    res.status(500).json({ error: 'Failed to update Ethereum address' });
  }
});

/**
 * Route to register a new product in the backend.
 * @route POST /api/farmer/registerProduct
 * @access Private (Farmer only)
 */
router.post('/registerProduct', [
  auth,
  body('type').notEmpty().withMessage('Product type is required'),
  body('origin').notEmpty().withMessage('Origin is required'),
  body('productionDate').isISO8601().toDate().withMessage('Invalid production date'),
  body('batchNumber').notEmpty().withMessage('Batch number is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  body('certifications').isArray().withMessage('Certifications must be an array')
], async (req, res) => {
  console.log('Received request body:', JSON.stringify(req.body, null, 2));

  try {
    // Capture any validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Proceed with product registration if validation passes
    const { type, origin, productionDate, batchNumber, quantity, price, certifications } = req.body;

    // Check for existing product with same batch number
    let existingProduct = await Product.findOne({ batchNumber });
    if (existingProduct) {
      console.log('Existing product with same batch number found:', JSON.stringify(existingProduct, null, 2));
      return res.status(400).json({ message: 'A product with this batch number already exists' });
    }

    // Create a new product object
    const newProduct = new Product({
      type,
      origin,
      productionDate,
      batchNumber,
      quantity,
      price,
      certifications,
      currentOwner: req.user.id,
      originalOwner: req.user.id,
      blockchainStatus: 'Pending',
      status: 'Registered'
    });

    // Save the product to the database
    const savedProduct = await newProduct.save();
    console.log('New product saved successfully:', JSON.stringify(savedProduct, null, 2));

    // Send success response
    res.status(201).json({
      message: 'Product registered successfully',
      product: savedProduct
    });
  } catch (error) {
    console.error('Error in registerProduct route:', error);
    res.status(500).json({
      message: 'Failed to register product',
      error: error.message || 'An unexpected error occurred'
    });
  }
});

/**
 * Route to update a product with blockchain details
 * @route PUT /api/farmer/products/:productId/blockchain
 * @access Private (Farmer only)
 */
router.put('/products/:productId/blockchain', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { blockchainId, txHash } = req.body;

    console.log(`Updating product ${productId} with blockchain details:`, { blockchainId, txHash });

    if (!productId || productId === 'undefined') {
      throw new Error('Invalid product ID');
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        blockchainId: blockchainId,
        blockchainTransactionHash: txHash,
        blockchainStatus: 'Registered'
      },
      { new: true }
    );

    if (!updatedProduct) {
      console.log(`Product ${productId} not found`);
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log(`Product ${productId} updated successfully with blockchain details`);
    res.status(200).json({
      success: true,
      message: 'Product updated with blockchain details',
      product: updatedProduct
    });
  } catch (err) {
    console.error('Error updating product with blockchain details:', err);
    res.status(500).json({ error: 'Failed to update product with blockchain details', details: err.message });
  }
});
/**
 * Route to update product status
 * @route PUT /api/farmer/products/:id/status
 */
router.put('/products/:id/status', [
  auth,
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('status').notEmpty().withMessage('Status is required'),
  body('blockchainTxHash').notEmpty().withMessage('Blockchain transaction hash is required')
], async (req, res) => {
  try {
    console.log('Entering updateProductStatus endpoint');
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
 
    const productId = req.params.id;
    const { status, blockchainTxHash } = req.body;
 
    // Find the product and ensure the current user owns it
    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });
    if (!product) {
      console.log('Product not found or user does not own the product');
      return res.status(404).json({ error: 'Product not found or you do not own this product' });
    }
 
    // Update product status in the database
    product.status = status;
    product.blockchainTxHash = blockchainTxHash;
    
    await product.save();
 
    console.log('Product status updated successfully');
    res.status(200).json({ 
      message: 'Product status updated successfully', 
      product: {
        _id: product._id,
        type: product.type,
        status: product.status,
        blockchainId: product.blockchainId,
        blockchainTxHash: product.blockchainTxHash
      }
    });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({ error: 'An error occurred while updating the product status', details: error.message });
  }
});

/**
 * Route to initiate a product transfer from a farmer to a distributor
 * @route POST /api/farmer/initiateTransfer
 * @access Private (Farmer only)
 */
router.post('/initiateTransfer', [
  auth,
  body('productId').isMongoId().withMessage('Invalid product ID'),
  body('newOwnerUsername').notEmpty().withMessage('New owner username is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('blockchainTx').notEmpty().withMessage('Blockchain transaction hash is required')
], async (req, res) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, newOwnerUsername, quantity, blockchainTx } = req.body;
    console.log('Received transfer request:', req.body);

    // Fetch the product from the database
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Check if the initiator is the current owner
    if (product.currentOwner.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'You are not the current owner of this product.' 
      });
    }

    // Check if the quantity to transfer is available
    if (product.quantity < quantity) {
      return res.status(400).json({ success: false, error: 'Insufficient quantity available for transfer' });
    }

    // Get the new owner
    const newOwner = await User.findOne({ username: newOwnerUsername });
    if (!newOwner) {
      return res.status(404).json({ success: false, error: 'New owner not found' });
    }

    // Update the product quantity in the database
    product.quantity -= quantity;
    await product.save();

    // Create a new transfer record
    const transfer = new Transfer({
      product: product._id,
      fromUser: req.user.id,
      toUser: newOwner._id,
      fromUserType: 'farmer', // Assuming the initiator is always a farmer in this route
      toUserType: 'distributor', // Assuming the recipient is always a distributor in this route
      quantity: quantity,
      status: 'pending',
      blockchainTx: blockchainTx
    });
    await transfer.save();

    res.json({ 
      success: true, 
      message: 'Transfer initiated successfully',
      transfer: transfer,
      transactionHash: blockchainTx
    });

  } catch (error) {
    console.error('Error in initiateTransfer:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Route to sync a product with the blockchain
 * @route PUT /api/farmer/syncProduct/:blockchainId
 */
router.put('/syncProduct/:blockchainId', [
  auth,
  param('blockchainId').notEmpty().withMessage('Blockchain ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { blockchainId } = req.params;
    const { blockchainData } = req.body;

    const product = await Product.findOne({ blockchain_id: blockchainId, currentOwner: req.user.id });
    if (!product) {
      return res.status(404).json({ error: 'Product not found or you do not own this product' });
    }

    // Update product with blockchain data
    product.status = blockchainData.status;
    product.quantity = blockchainData.quantity;
    // Update other fields as necessary

    await product.save();

    res.status(200).json({ message: 'Product synced successfully with blockchain', product });
  } catch (error) {
    console.error('Error in /syncProduct:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Route to get distributor's Ethereum address
 * @route GET /api/farmer/getDistributorAddress/:username
 */
router.get('/getDistributorAddress/:username', [
  param('username').notEmpty().withMessage('Username is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const distributor = await User.findOne({ username: req.params.username, userType: 'distributor' });
    if (!distributor) {
      return res.status(404).json({ message: 'Distributor not found' });
    }
    res.json({ ethereumAddress: distributor.ethereumAddress });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * Route to get pending transfers for the farmer
 * @route GET /api/farmer/pendingTransfers
 */
router.get('/pendingTransfers', async (req, res) => {
  try {
    const pendingTransfers = await Transfer.find({ 
      $or: [{ fromUser: req.user.id }, { toUser: req.user.id }],
      status: 'pending'
    })
    .populate('product', 'type batchNumber')
    .populate('fromUser', 'username')
    .populate('toUser', 'username')
    .sort('-createdAt');

    console.log('Pending transfers found:', pendingTransfers);
    res.json(pendingTransfers);
  } catch (error) {
    console.error('Error fetching pending transfers:', error);
    res.status(500).json({ error: 'An error occurred while fetching pending transfers' });
  }
});

/**
 * Route to cancel a pending transfer
 * @route POST /api/farmer/cancelTransfer/:transferId
 */
router.post('/cancelTransfer/:transferId', auth, async (req, res) => {
  try {
    const transferId = req.params.transferId;
    const { initiatorAddress } = req.body;

    const transfer = await Transfer.findOne({ _id: transferId, fromUser: req.user.id, status: 'pending' });
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer not found or not cancelable' });
    }

    // Here you would typically interact with your blockchain to cancel the transfer
    // For this example, we'll just update the status in the database
    transfer.status = 'cancelled';
    await transfer.save();

    // Update the product quantity back
    const product = await Product.findById(transfer.product);
    if (product) {
      product.quantity += transfer.quantity;
      await product.save();
    }

    res.json({
      success: true,
      message: 'Transfer cancelled successfully',
      transactionHash: 'mocked-transaction-hash' // Replace with actual blockchain transaction hash
    });
  } catch (error) {
    console.error('Error cancelling transfer:', error);
    res.status(500).json({ success: false, error: error.message || 'An unexpected error occurred' });
  }
});

/**
 * Route to get list of distributors
 * @route GET /api/farmer/distributors
 */
router.get('/distributors', async (req, res) => {
  try {
    const distributors = await User.find({ userType: 'distributor' }).select('username firstName lastName ethereumAddress');
    console.log('Distributors found:', distributors); // Add this line for debugging
    res.json(distributors);
  } catch (error) {
    console.error('Error fetching distributors:', error); // Add this line for debugging
    handleError(error, res);
  }
});

/**
 * Route to get transaction history
 * @route GET /api/farmer/transactionHistory
 */
router.get('/transactionHistory', async (req, res) => {
  try {
    const transactions = await Transaction.find({ $or: [{ fromId: req.user.id }, { toId: req.user.id }] })
      .populate('productId')
      .sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * Route to get production insights
 * @route GET /api/farmer/productionInsights
 */
router.get('/productionInsights', async (req, res) => {
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
});

/**
 * Route to get transfer details
 * @route GET /api/farmer/transferDetails/:transferId
 */
router.get('/transferDetails/:transferId', async (req, res) => {
  try {
    const transferId = req.params.transferId;
    const transfer = await Transfer.findById(transferId)
      .populate('productId')
      .populate('fromId')
      .populate('toId');

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    res.status(200).json(transfer);
  } catch (error) {
    console.error('Error fetching transfer details:', error);
    res.status(500).json({ error: 'An error occurred while fetching the transfer details' });
  }
});

// Fetch product by ID including currentOwner's Ethereum address
exports.getProductById = async (req, res) => {
  const productId = req.params.productId;

  try {
    // Fetch the product and populate the currentOwner field with the ethereumAddress
    const product = await Product.findById(productId)
      .populate('currentOwner', 'ethereumAddress')  // Ensure currentOwner's ethereumAddress is included
      .exec();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({ error: 'Error fetching product' });
  }
};


module.exports = router;
