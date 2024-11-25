/**
 * Retailer Dashboard Routes
 * 
 * This module defines the API routes for the retailer dashboard in the food traceability platform.
 * It handles product management, transfers to consumers, and various retailer-specific operations.
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
 * Middleware to ensure the authenticated user is a retailer
 */
const ensureRetailer = (req, res, next) => {
  if (req.user.userType !== 'retailer') {
    return res.status(403).json({ message: 'Access denied. Retailer only.' });
  }
  next();
};

// Apply authentication and retailer check to all routes
router.use(auth);
router.use(ensureRetailer);

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
 * Route to get all products for the retailer
 * @route GET /api/retailer/products
 */
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ currentOwner: req.user.id });
    console.log('Products fetched for retailer:', products.length);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    handleError(error, res);
  }
});

/**
 * Route to get product details
 * @route GET /api/retailer/products/:productId
 */
router.get('/products/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
    handleError(error, res);
  }
});

/**
 * Route to accept a transfer from a distributor
 * @route POST /api/retailer/acceptTransfer/:transferId
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

    const transfer = await Transfer.findOne({ _id: transferId, toUser: req.user.id });
    if (!transfer) {
      return res.status(404).json({ message: 'Transfer not found', status: 'not_found' });
    }

    // Check transfer status on blockchain
    const transferStatus = await Web3Service.checkTransferStatus(transfer.blockchainTx);
    console.log(`Blockchain transfer status: ${transferStatus}`);

    if (transferStatus === 'completed') {
      transfer.status = 'completed';
      await transfer.save();
      
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

    // Proceed with accepting the transfer
    const blockchainResult = await Web3Service.acceptTransferAsRetailer(transfer.blockchainTx, ethereumAddress);
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
      transactionType: 'Received from Distributor',
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
 * Route to update product information
 * @route PUT /api/retailer/updateProduct/:productId
 */
router.put('/updateProduct/:productId', [
    // ... (validation middleware)
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const { productId } = req.params;
      const updateData = req.body;
  
      const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });
      if (!product) {
        return res.status(404).json({ message: 'Product not found or not owned by you' });
      }
  
      // Update product fields in the database
      Object.assign(product, updateData);
      await product.save();
  
      console.log('Product updated in database:', product._id);
  
      // Update product on blockchain
      const blockchainResult = await Web3Service.updateProductInfoAsRetailer(product.blockchainId, updateData);
  
      if (blockchainResult.success) {
        console.log('Product updated on blockchain. Transaction hash:', blockchainResult.txHash);
        res.json({ 
          message: 'Product updated successfully in database and on blockchain', 
          product, 
          txHash: blockchainResult.txHash 
        });
      } else {
        // If blockchain update fails, we might want to rollback the database update
        // or implement a retry mechanism. For now, we'll just send an error response.
        res.status(500).json({ 
          message: 'Product updated in database but failed to update on blockchain', 
          error: blockchainResult.error 
        });
      }
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: 'Error updating product', error: error.message });
    }
  });
  
  /**
   * Route to sync a product with the blockchain
   * @route POST /api/retailer/syncProduct/:productId
   */
  router.post('/syncProduct/:productId', [
    param('productId').isMongoId().withMessage('Invalid product ID'),
    body('ethereumAddress').isEthereumAddress().withMessage('Invalid Ethereum address')
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const { productId } = req.params;
      const { ethereumAddress } = req.body;
  
      const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });
      if (!product) {
        return res.status(404).json({ message: 'Product not found or not owned by you' });
      }
  
      console.log('Syncing product:', product._id);
  
      // Get blockchain data
      const blockchainData = await Web3Service.getProductFromBlockchain(product.blockchainId);
      if (!blockchainData.success) {
        throw new Error(blockchainData.error || 'Failed to get product data from blockchain');
      }
  
      // Update product with blockchain data
      product.status = blockchainData.product.status;
      product.quantity = blockchainData.product.quantity;
      // Update other fields as necessary
  
      await product.save();
  
      console.log('Product synced with blockchain:', product._id);
      res.json({ message: 'Product synced successfully with blockchain', product });
    } catch (error) {
      console.error('Error syncing product with blockchain:', error);
      res.status(500).json({ message: 'Error syncing product with blockchain', error: error.message });
    }
  });
  

/**
 * Route to initiate a transfer to a consumer
 * @route POST /api/retailer/initiateTransferToConsumer
 */
router.post('/initiateTransferToConsumer', [
  body('productId').isMongoId().withMessage('Invalid product ID'),
  body('consumerId').isMongoId().withMessage('Invalid consumer ID'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, consumerId, quantity } = req.body;

    const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient quantity available' });
    }

    const consumer = await User.findOne({ _id: consumerId, userType: 'consumer' });
    if (!consumer) {
      return res.status(404).json({ message: 'Consumer not found' });
    }

    // Initiate transfer on blockchain
    const blockchainResult = await Web3Service.initiateRetailerToConsumerTransfer(product.blockchainId, consumer.uniqueIdentifier, quantity);
    if (!blockchainResult.success) {
      throw new Error(blockchainResult.error || 'Blockchain transfer initiation failed');
    }

    // Create transfer record
    const transfer = new Transfer({
      product: productId,
      fromUser: req.user.id,
      toUser: consumerId,
      quantity,
      status: 'completed', // Assuming immediate completion for consumer transfers
      blockchainTx: blockchainResult.txHash,
      fromUserType: 'retailer',
      toUserType: 'consumer',
      transferDetails: `Sale of ${quantity} units to consumer`,
      price: product.price * quantity
    });
    await transfer.save();

    // Update product quantity
    product.quantity -= quantity;
    await product.save();

    // Record the sale
    const saleResult = await Web3Service.recordSaleToConsumer(product.blockchainId, consumer.uniqueIdentifier, quantity, product.price);
    if (!saleResult.success) {
      console.error('Failed to record sale on blockchain:', saleResult.error);
      // Consider how to handle this scenario - maybe add to a queue for retry?
    }

    console.log('Transfer to consumer initiated:', transfer._id);
    res.json({ message: 'Transfer to consumer completed', transfer, blockchainTx: blockchainResult.txHash });
  } catch (error) {
    console.error('Error initiating transfer to consumer:', error);
    handleError(error, res);
  }
});

/**
 * Route to initiate a transfer to a consumer
 * @route POST /api/retailer/initiateTransfer
 */
router.post('/initiateTransfer', [
    // Add validation middleware here if needed
  ], async (req, res) => {
    try {
      const { productId, consumerId, quantity, blockchainTxHash } = req.body;
  
      // Fetch the product to ensure it exists and belongs to the retailer
      const product = await Product.findOne({ _id: productId, currentOwner: req.user.id });
      if (!product) {
        return res.status(404).json({ message: 'Product not found or not owned by you' });
      }
  
      // Check if there's enough quantity to transfer
      if (product.quantity < quantity) {
        return res.status(400).json({ message: 'Insufficient quantity available' });
      }
  
      // Create the transfer record with all required fields
      const transfer = new Transfer({
        product: productId,
        fromUser: req.user.id,
        toUser: consumerId,
        quantity,
        status: 'completed', // Assuming immediate completion for consumer transfers
        blockchainTx: blockchainTxHash,
        fromUserType: 'retailer', // Add this line
        toUserType: 'consumer', // Add this line
        transferDetails: `Sale of ${quantity} units to consumer`,
        price: product.price * quantity // Assuming product has a price field
      });
  
      // Save the transfer
      await transfer.save();
  
      // Update product quantity
      product.quantity -= quantity;
      await product.save();
  
      console.log('Transfer initiated:', transfer._id);
      res.json({ 
        message: 'Transfer initiated successfully', 
        transfer,
        blockchainTx: blockchainTxHash
      });
    } catch (error) {
      console.error('Error initiating transfer:', error);
      res.status(500).json({ message: 'Error initiating transfer', error: error.message });
    }
  });

/**
 * Route to get pending transfers for the retailer
 * @route GET /api/retailer/pendingTransfers
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
 * Route to get list of consumers
 * @route GET /api/retailer/consumers
 */
router.get('/consumers', async (req, res) => {
  try {
    const consumers = await User.find({ userType: 'consumer' }).select('username firstName lastName');
    console.log('Consumers fetched:', consumers.length);
    res.json(consumers);
  } catch (error) {
    console.error('Error fetching consumers:', error);
    handleError(error, res);
  }
});

/**
 * Route to get transaction history
 * @route GET /api/retailer/transactionHistory
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
    handleError(error, res);
  }
});

/**
 * Route to get product traceability information
 * @route GET /api/retailer/productTraceability/:productId
 */
router.get('/productTraceability/:productId', [
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
      .populate('currentOwner', 'username location');

    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    const blockchainData = await Web3Service.getProductFromBlockchain(product.blockchainId);
    if (!blockchainData.success) {
      throw new Error(blockchainData.error || 'Failed to get product data from blockchain');
    }

    const transactions = await Transaction.find({ product: product._id })
      .populate('fromUser', 'username')
      .populate('toUser', 'username')
      .sort({ createdAt: 1 });

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

    console.log(`Traceability info fetched for product: ${product._id}`);
    res.json(traceabilityInfo);
  } catch (error) {
    console.error('Error fetching product traceability:', error);
    handleError(error, res);
  }
});

/**
 * Route to update product status
 * @route PUT /api/retailer/updateProductStatus/:productId
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
 * Route to set Ethereum address for the retailer
 * @route POST /api/retailer/setEthereumAddress
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
    handleError(error, res);
  }
});

/**
 * Route to get retailer's inventory
 * @route GET /api/retailer/inventory
 */
router.get('/inventory', async (req, res) => {
  try {
    const inventory = await Product.find({ currentOwner: req.user.id })
      .select('type batchNumber quantity price status');
    console.log('Inventory fetched for retailer:', inventory.length, 'items');
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    handleError(error, res);
  }
});

/**
 * Route to record consumer feedback
 * @route POST /api/retailer/recordFeedback/:productId
 */
router.post('/recordFeedback/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  body('consumerId').isMongoId().withMessage('Invalid consumer ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const { consumerId, rating, comment } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const consumer = await User.findOne({ _id: consumerId, userType: 'consumer' });
    if (!consumer) {
      return res.status(404).json({ message: 'Consumer not found' });
    }

    // Record feedback in the database
    const feedback = {
      consumer: consumerId,
      rating,
      comment,
      date: new Date()
    };

    product.consumerFeedback = product.consumerFeedback || [];
    product.consumerFeedback.push(feedback);
    await product.save();

    // You might want to add blockchain interaction here to record feedback

    console.log('Consumer feedback recorded for product:', productId);
    res.json({ message: 'Feedback recorded successfully', feedback });
  } catch (error) {
    console.error('Error recording consumer feedback:', error);
    handleError(error, res);
  }
});

/**
 * Route to generate sales report
 * @route GET /api/retailer/salesReport
 */
router.get('/salesReport', [
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate } = req.query;
    let dateFilter = { fromUser: req.user.id };

    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const salesTransactions = await Transaction.find(dateFilter)
      .populate('product', 'type price')
      .populate('toUser', 'username');

    const report = salesTransactions.map(transaction => ({
      date: transaction.createdAt,
      product: transaction.product.type,
      quantity: transaction.quantity,
      price: transaction.product.price,
      total: transaction.quantity * transaction.product.price,
      consumer: transaction.toUser.username
    }));

    const totalSales = report.reduce((sum, sale) => sum + sale.total, 0);

    console.log('Sales report generated:', report.length, 'transactions');
    res.json({ report, totalSales });
  } catch (error) {
    console.error('Error generating sales report:', error);
    handleError(error, res);
  }
});



module.exports = router;