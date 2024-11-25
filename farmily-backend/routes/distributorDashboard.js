/**
 * Distributor Dashboard Routes
 * 
 * This module defines the API routes for the distributor dashboard in the food traceability platform.
 * It handles product management, transfers, and various distributor-specific operations.
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
 * Middleware to ensure the authenticated user is a distributor
 */
const ensureDistributor = (req, res, next) => {
  if (req.user.userType !== 'distributor') {
    return res.status(403).json({ message: 'Access denied. Distributor only.' });
  }
  next();
};

// Apply authentication and distributor check to all routes
router.use(auth);
router.use(ensureDistributor);

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
 * Route to get all products for the distributor
 * @route GET /api/distributor/products
 */
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ currentOwner: req.user.id });
    console.log('Products fetched for distributor:', products.length);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    handleError(error, res);
  }
});

/**
 * Route to get product details
 * @route GET /api/distributor/products/:productId
 */
router.get('/products/:productId', async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId)
      .populate('currentOwner', 'username')
      .populate('originalOwner', 'username')
      .populate('previousOwner', 'username');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    console.log('Product details fetched:', product._id);
    res.json(product);
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ message: 'Error fetching product details', error: error.message });
  }
});

/**
 * Route to accept a transfer from a farmer
 * @route POST /api/distributor/acceptTransfer/:transferId
 */
router.post('/acceptTransfer/:transferId', [
  param('transferId').isMongoId().withMessage('Invalid transfer ID'),
  body('ethereumAddress').isEthereumAddress().withMessage('Invalid Ethereum address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { transferId } = req.params;
    const { ethereumAddress } = req.body;

    console.log(`Accepting transfer: ${transferId} for address: ${ethereumAddress}`);

    const transfer = await Transfer.findOne({ _id: transferId, toUser: req.user.id });
    if (!transfer) {
      console.log('Transfer not found');
      return res.status(404).json({ message: 'Transfer not found', status: 'not_found' });
    }

    console.log('Transfer found:', transfer);

    // Check if the transfer is still pending on the blockchain
    const transferStatus = await Web3Service.checkTransferStatus(transfer.blockchainTx);
    console.log(`Blockchain transfer status: ${transferStatus}`);

    if (transferStatus === 'completed') {
      // Update the transfer status in the database to match the blockchain
      transfer.status = 'completed';
      await transfer.save();
      
      // Update product ownership if it hasn't been updated yet
      const product = await Product.findById(transfer.product);
      if (product && product.currentOwner.toString() !== req.user.id.toString()) {
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

    if (transferStatus !== 'pending') {
      return res.status(400).json({ 
        message: `Unexpected transfer status on blockchain: ${transferStatus}`,
        status: transferStatus
      });
    }

    // Proceed with accepting the transfer on the blockchain
    const blockchainResult = await Web3Service.acceptTransferOnBlockchain(transfer.blockchainTx, ethereumAddress);
    if (!blockchainResult.success) {
      console.error('Blockchain transfer acceptance failed:', blockchainResult.error);
      return res.status(500).json({ message: 'Blockchain transfer acceptance failed', error: blockchainResult.error });
    }

    console.log('Blockchain transfer accepted:', blockchainResult);

    // Update transfer status in the database
    transfer.status = 'completed';
    await transfer.save();

    // Update product ownership
    const product = await Product.findById(transfer.product);
    if (!product) {
      console.error('Product not found:', transfer.product);
      return res.status(404).json({ message: 'Product not found' });
    }

    product.currentOwner = req.user.id;
    product.quantity = transfer.quantity;
    await product.save();

    console.log('Product updated:', product);

    // Create a new transaction record
    const transaction = new Transaction({
      product: product._id,
      fromUser: transfer.fromUser,
      toUser: req.user.id,
      quantity: transfer.quantity,
      transactionType: 'Received from Farmer',
      status: 'Completed',
      blockchainTxHash: blockchainResult.txHash
    });
    await transaction.save();

    console.log('Transaction created:', transaction);

    res.json({ 
      message: 'Transfer accepted successfully', 
      transfer, 
      blockchainTx: blockchainResult.txHash 
    });
  } catch (error) {
    console.error('Error in acceptTransfer:', error);
    res.status(500).json({ message: 'Failed to accept transfer', error: error.message });
  }
});

/**
 * Route to get full product information including farmer and distributor details
 * @route GET /api/distributor/products/:productId/fullInfo
 */
router.get('/products/:productId/fullInfo', async (req, res) => {
  try {
    console.log(`Fetching full info for product: ${req.params.productId}`);
    
    const product = await Product.findById(req.params.productId)
      .populate('originalOwner', 'username location')
      .populate('currentOwner', 'username location userType')
      .populate({
        path: 'ownershipHistory.owner',
        select: 'username location userType'
      });

    if (!product) {
      console.log(`Product not found: ${req.params.productId}`);
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log('Product found:', product);

    // Get blockchain data
    console.log(`Fetching blockchain data for product: ${product.blockchainId}`);
    const blockchainData = await Web3Service.getProductFromBlockchain(product.blockchainId);
    
    if (!blockchainData.success) {
      console.error(`Error fetching blockchain data: ${blockchainData.error}`);
      return res.status(500).json({ message: 'Error fetching blockchain data', error: blockchainData.error });
    }

    // Construct full product info
    const fullProductInfo = {
      product: {
        _id: product._id,
        type: product.type,
        batchNumber: product.batchNumber,
        origin: product.origin,
        productionDate: product.productionDate,
        quantity: product.quantity,
        status: product.status,
        storageConditions: product.storageConditions,
        transportationMode: product.transportationMode,
        transportationDetails: product.transportationDetails,
        estimatedDeliveryDate: product.estimatedDeliveryDate
      },
      farmer: {
        username: product.originalOwner.username,
        location: product.originalOwner.location
      },
      currentOwner: {
        username: product.currentOwner.username,
        location: product.currentOwner.location,
        userType: product.currentOwner.userType
      },
      ownershipHistory: product.ownershipHistory.map(entry => ({
        username: entry.owner.username,
        location: entry.owner.location,
        userType: entry.owner.userType,
        timestamp: entry.timestamp
      })),
      blockchainData: blockchainData.product
    };

    console.log(`Full product info fetched successfully for: ${req.params.productId}`);
    res.json(fullProductInfo);
  } catch (error) {
    console.error('Error fetching full product info:', error);
    res.status(500).json({ message: 'Error fetching full product info', error: error.message });
  }
});


/**
 * Route to update product information
 * 
 * This route allows a distributor to update certain product fields such as storage conditions,
 * transportation details, estimated delivery date, and transportation mode. The update is also
 * reflected on the blockchain.
 * 
 * @route PUT /api/distributor/updateProduct/:productId
 */
router.put('/updateProduct/:productId', [
  // Validation for the product ID in the request params
  param('productId').isMongoId().withMessage('Invalid product ID'),
  // Optional validation for other fields in the request body
  body('storageConditions').optional().isString(),
  body('transportationDetails').optional().isString(),
  body('estimatedDeliveryDate').optional().isISO8601().toDate(),
  body('transportationMode').optional().isString()
], async (req, res) => {
  try {
    // Check for validation errors from the request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Extract the fields from the request body
    const { storageConditions, transportationDetails, estimatedDeliveryDate, transportationMode } = req.body;

    // Find the product by ID, ensuring the current owner matches the logged-in user
    const product = await Product.findOne({ _id: req.params.productId, currentOwner: req.user.id });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    // Prepare the fields to update
    let updateData = {};
    if (storageConditions !== undefined) updateData.storageConditions = storageConditions;
    if (transportationDetails !== undefined) updateData.transportationDetails = transportationDetails;
    if (estimatedDeliveryDate !== undefined) updateData.estimatedDeliveryDate = estimatedDeliveryDate;
    if (transportationMode !== undefined) updateData.transportationMode = transportationMode;

    // Check if there's any data to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No data provided for update' });
    }

    // Update the product on the blockchain
    const blockchainResult = await Web3Service.updateProductInfoOnBlockchain(product.blockchainId, updateData);
    if (!blockchainResult.success) {
      throw new Error(blockchainResult.error || 'Blockchain product update failed');
    }

    // Update the product in the database
    Object.assign(product, updateData);
    product.blockchainTx = blockchainResult.txHash;

    /**
     * Ownership History Update:
     * Check if the current owner is the same as the last entry in the ownership history.
     * If not, add a new entry with the current owner and the current timestamp.
     */
    const lastEntry = product.ownershipHistory[product.ownershipHistory.length - 1];
    if (!lastEntry || !lastEntry.owner.equals(req.user._id)) {
      product.ownershipHistory.push({
        owner: req.user._id,
        timestamp: new Date()
      });
    }

    // Save the updated product in the database
    await product.save();

    // Log success and return the response with the updated product and blockchain transaction hash
    console.log('Product updated:', product._id);
    res.json({ message: 'Product updated successfully', product, txHash: blockchainResult.txHash });
  } catch (error) {
    // Log and return any errors that occur during the process
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
});

/**
 * Route to sync a product with the blockchain
 * @route POST /api/distributor/syncProduct/:productId
 */
router.post('/syncProduct/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const product = await Product.findOne({ _id: req.params.productId, currentOwner: req.user.id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    console.log('Syncing product:', product._id);

    const blockchainData = await Web3Service.getProductFromBlockchain(product.blockchainId);
    if (!blockchainData.success) {
      console.error('Error getting product from blockchain:', blockchainData.error);
      return res.status(500).json({ message: 'Failed to get product data from blockchain', error: blockchainData.error });
    }

    console.log('Blockchain data:', blockchainData);

    // Update product with blockchain data
    product.status = blockchainData.product.status;
    product.quantity = blockchainData.product.quantity;
    product.storageConditions = blockchainData.product.storageConditions;
    product.transportationDetails = blockchainData.product.transportationDetails;
    // Update other fields as necessary

    await product.save();

    console.log('Product synced with blockchain:', product._id);
    res.json({ message: 'Product synced successfully with blockchain', product });
  } catch (error) {
    console.error('Error in syncProduct:', error);
    res.status(500).json({ message: 'Error syncing product with blockchain', error: error.message });
  }
});

/**
 * Route to search for retailers
 * @route GET /api/distributor/searchRetailers
 */
router.get('/searchRetailers', [
  query('search').optional().isString()
], async (req, res) => {
  try {
    const { search } = req.query;
    let query = { userType: 'retailer' };
    if (search) {
      query.$or = [
        { username: new RegExp(search, 'i') },
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') }
      ];
    }
    const retailers = await User.find(query).select('username firstName lastName');
    console.log('Retailers found:', retailers.length);
    res.json(retailers);
  } catch (error) {
    console.error('Error searching retailers:', error);
    res.status(500).json({ message: 'Failed to search retailers', error: error.message });
  }
});


/**
 * Route to initiate a transfer to a retailer
 * @route POST /api/distributor/initiateTransfer
 */
router.post('/initiateTransfer', [
  body('productId').isMongoId().withMessage('Invalid product ID'),
  body('retailerId').isMongoId().withMessage('Invalid retailer ID'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('blockchainTxHash').isString().notEmpty().withMessage('Blockchain transaction hash is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, retailerId, quantity, blockchainTxHash } = req.body;

    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient quantity available' });
    }

    const retailer = await User.findOne({ _id: retailerId, userType: 'retailer' });
    if (!retailer) {
      return res.status(404).json({ message: 'Retailer not found' });
    }

    // Create new transfer record
    const transfer = new Transfer({
      product: productId,
      fromUser: req.user.id,
      toUser: retailerId,
      quantity,
      status: 'pending',
      blockchainTx: blockchainTxHash,
      fromUserType: 'distributor',
      toUserType: 'retailer',
      transferDetails: `Transfer of ${quantity} units from distributor to retailer`,
      price: product.price * quantity // Assuming product has a price field
    });
    await transfer.save();

    // Update product quantity
    product.quantity -= quantity;
    await product.save();

    console.log('Transfer initiated:', transfer._id);
    res.json({ message: 'Transfer initiated successfully', transfer, blockchainTx: blockchainTxHash });
  } catch (error) {
    console.error('Error initiating transfer:', error);
    res.status(500).json({ message: 'Failed to initiate transfer', error: error.message });
  }
});

/**
 * Route to get pending transfers for the distributor
 * @route GET /api/distributor/pendingTransfers
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
 * Route to get list of retailers
 * @route GET /api/distributor/retailers
 */
router.get('/retailers', async (req, res) => {
  try {
    const retailers = await User.find({ userType: 'retailer' }).select('username firstName lastName');
    console.log('Retailers fetched:', retailers.length);
    res.json(retailers);
  } catch (error) {
    console.error('Error fetching retailers:', error);
    handleError(error, res);
  }
});

/**
 * Route to get transaction history
 * @route GET /api/distributor/transactionHistory
 */
router.get('/transactionHistory', async (req, res) => {
  try {
    const transactions = await Transaction.find({ $or: [{ fromUser: req.user.id }, { toUser: req.user.id }] })
      .populate('product')
      .populate('fromUser', 'username')
      .populate('toUser', 'username')
      .sort({ createdAt: -1 });
    
    console.log('Fetched transactions:', transactions.length);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ message: 'Error fetching transaction history', error: error.message });
  }
});

/**
 * Route to get product information including farmer details
 * @route GET /api/distributor/productWithFarmerInfo/:productId
 */
router.get('/productWithFarmerInfo/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const product = await Product.findOne({ _id: req.params.productId })
      .populate('originalOwner', 'username location')
      .populate('currentOwner', 'username location userType');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get the latest blockchain data
    const blockchainData = await Web3Service.getProductFromBlockchain(product.blockchainId);
    if (!blockchainData.success) {
      throw new Error(blockchainData.error || 'Failed to get product data from blockchain');
    }

    // Merge database and blockchain data
    const productWithFarmerInfo = {
      ...product.toObject(),
      farmer: product.originalOwner,
      currentOwner: product.currentOwner,
      blockchainStatus: blockchainData.product.status,
      blockchainQuantity: blockchainData.product.quantity
    };

    console.log('Product with farmer info fetched:', product._id);
    res.json(productWithFarmerInfo);
  } catch (error) {
    console.error('Error fetching product with farmer info:', error);
    handleError(error, res);
  }
});


/**
 * Route to get product traceability information
 * @route GET /api/distributor/productTraceability/:productId
 */
router.get('/productTraceability/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    console.log(`Fetching traceability for product: ${req.params.productId}`);

    const product = await Product.findOne({ _id: req.params.productId, currentOwner: req.user.id })
      .populate('originalOwner', 'username location')
      .populate('currentOwner', 'username location');

    if (!product) {
      console.log(`Product not found or not owned by user: ${req.params.productId}`);
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    // Fetch blockchain data
    console.log(`Fetching blockchain data for product: ${product.blockchainId}`);
    const blockchainData = await Web3Service.getProductFromBlockchain(product.blockchainId);
    if (!blockchainData.success) {
      console.error(`Error fetching blockchain data: ${blockchainData.error}`);
      throw new Error(blockchainData.error || 'Failed to get product data from blockchain');
    }

    // Fetch transaction history for this product
    const transactions = await Transaction.find({ product: product._id })
      .populate('fromUser', 'username')
      .populate('toUser', 'username')
      .sort({ createdAt: 1 });

    // Construct traceability information
    const traceabilityInfo = {
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
      currentOwner: {
        username: product.currentOwner.username,
        location: product.currentOwner.location
      },
      blockchainStatus: blockchainData.product.status,
      blockchainQuantity: blockchainData.product.quantity,
      journey: transactions.map(tx => ({
        date: tx.createdAt,
        from: tx.fromUser.username,
        to: tx.toUser.username,
        quantity: tx.quantity,
        type: tx.transactionType
      }))
    };

    console.log(`Traceability info fetched successfully for product: ${product._id}`);
    res.json(traceabilityInfo);
  } catch (error) {
    console.error('Error fetching product traceability:', error);
    handleError(error, res);
  }
});
/**
 * Route to update product status
 * @route PUT /api/distributor/updateProductStatus/:productId
 */
router.put('/updateProductStatus/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  body('status').isString().notEmpty().withMessage('Status is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const { status } = req.body;

    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    // Update product status on the blockchain
    const blockchainResult = await Web3Service.updateProductStatusOnBlockchain(product.blockchainId, status);
    if (!blockchainResult.success) {
      throw new Error(blockchainResult.error || 'Blockchain status update failed');
    }

    // Update product status in the database
    product.status = status;
    product.blockchainTx = blockchainResult.txHash;
    await product.save();

    console.log('Product status updated:', product._id, status);
    res.json({ message: 'Product status updated successfully', product, txHash: blockchainResult.txHash });
  } catch (error) {
    console.error('Error updating product status:', error);
    handleError(error, res);
  }
});

/**
 * Route to set Ethereum address for the distributor
 * @route POST /api/distributor/setEthereumAddress
 */
router.post('/setEthereumAddress', [
  body('ethereumAddress').isEthereumAddress().withMessage('Invalid Ethereum address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ethereumAddress } = req.body;

    const user = await User.findByIdAndUpdate(req.user.id, { ethereumAddress }, { new: true });
    console.log('Ethereum address updated for user:', user._id);
    res.json({ message: 'Ethereum address updated successfully', user });
  } catch (error) {
    console.error('Error updating Ethereum address:', error);
    res.status(500).json({ message: 'Error updating Ethereum address', error: error.message });
  }
});

module.exports = router;