const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Product schema definition
 * 
 * Represents a product in the supply chain, including its attributes, ownership, 
 * blockchain-related information, and history of ownership.
 */
const productSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true, 
    trim: true,
    comment: 'Type of the product (e.g., "Apple", "Carrot")'
  },
  origin: { 
    type: String, 
    required: true, 
    trim: true,
    comment: 'Origin of the product (e.g., "USA", "Canada")'
  },
  productionDate: { 
    type: Date, 
    required: true,
    comment: 'Date of production'
  },
  batchNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    comment: 'Unique identifier for the batch'
  },
  certifications: { 
    type: [String], 
    default: [],
    comment: 'Array of certifications (e.g., ["Organic", "Non-GMO"])'
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 0,
    default: 0,
    comment: 'Current quantity of the product'
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
    get: v => v === undefined ? 0 : parseFloat(v.toFixed(18)),
    set: v => v === undefined ? 0 : parseFloat(v.toFixed(18)),
    comment: 'Price of the product in ETH'
  },
  currentOwner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    comment: 'Current owner of the product (reference to User model)'
  },
  originalOwner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    comment: 'Original owner (farmer) of the product (reference to User model)'
  },
  previousOwner: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    comment: 'Previous owner of the product (reference to User model)'
  },
  distributor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    comment: 'Distributor of the product (reference to User model)'
  },
  retailer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    comment: 'Retailer of the product (reference to User model)'
  },

  // field for QR code data
  qrCodeData: {
    type: String,
    comment: 'Encoded QR code data for the product'
  },
  status: {
    type: String,
    enum: [
      'Registered', 'Planted', 'Growing', 'Harvested', 
      'Processed', 'Packaged', 'InTransit', 'Delivered'
    ],
    default: 'Registered',
    required: true,
    comment: 'Current status of the product in the supply chain'
  },
  blockchainId: {
    type: String, 
    unique: true, 
    sparse: true, 
    comment: 'Blockchain identifier for the product'
  },
  blockchainTxHash: { 
    type: String, 
    trim: true,
    comment: 'Blockchain transaction hash of the product registration'
  },
  blockchainStatus: {
    type: String,
    enum: ['Pending', 'Registered', 'Failed'],
    default: 'Pending',
    comment: 'Status of the product registration on the blockchain'
  },
  pendingTransfer: {
    to: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      comment: 'User ID of the recipient in a pending transfer'
    },
    quantity: { 
      type: Number, 
      min: 0,
      comment: 'Quantity involved in the pending transfer'
    },
    initiatedAt: { 
      type: Date,
      comment: 'Date and time when the transfer was initiated'
    }
  },
  storageConditions: { 
    type: String, 
    enum: ['Ambient', 'Refrigerated', 'Frozen', 'ControlledAtmosphere', 'Dry', 'Chilled', 'TemperatureControlled'],
    comment: 'Current storage condition of the product'
  },
  transportationMode: { 
    type: String, 
    enum: ['Truck', 'Train', 'Ship', 'Airplane', 'Intermodal'],
    comment: 'Mode of transportation for the product'
  },
  transportationDetails: { 
    type: String, 
    trim: true,
    comment: 'Additional details about transportation'
  },
  estimatedDeliveryDate: {
    type: Date,
    comment: 'Estimated date of delivery to the next recipient'
  },
  qualityCheckStatus: { 
    type: String, 
    enum: ['Passed', 'Failed', 'Pending'],
    comment: 'Status of the most recent quality check'
  },
  qualityCheckNotes: { 
    type: String, 
    trim: true,
    comment: 'Notes from the most recent quality check'
  },
  transferHistory: [{
    type: Schema.Types.ObjectId,
    ref: 'Transfer',
    comment: 'Array of references to Transfer documents'
  }],
  qualityChecks: [{
    type: Schema.Types.ObjectId,
    ref: 'QualityCheck',
    comment: 'Array of references to QualityCheck documents'
  }],
  
  // New ownershipHistory field to store the previous owners and timestamps
  ownershipHistory: [{
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      comment: 'Reference to the User model for tracking ownership changes'
    },
    timestamp: {
      type: Date,
      default: Date.now,
      comment: 'Timestamp indicating when the ownership change occurred'
    }
  }]

}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Indexes for querying efficiency
productSchema.index({ batchNumber: 1, currentOwner: 1, status: 1 });

/**
 * Pre-save hook to ensure price is always stored with 18 decimal places
 * and originalOwner is set if not present
 */
productSchema.pre('save', function(next) {
  if (this.isModified('price')) {
    this.price = parseFloat(this.price.toFixed(18));
  }
  if (!this.originalOwner) {
    this.originalOwner = this.currentOwner;
  }
  next();
});

/**
 * Virtual for formatted price display (if you need to show fewer decimals)
 */
productSchema.virtual('formattedPrice').get(function() {
  return this.price.toFixed(4);
});

/**
 * Method to initiate a transfer
 * @param {ObjectId} toUserId - ID of the user to transfer the product to
 * @param {Number} quantity - Quantity to transfer
 * @returns {Promise} - Promise resolving to the saved product
 */
productSchema.methods.initiateTransfer = function(toUserId, quantity) {
  if (this.quantity < quantity) {
    throw new Error('Insufficient quantity available for transfer');
  }
  this.pendingTransfer = {
    to: toUserId,
    quantity: quantity,
    initiatedAt: new Date()
  };
  return this.save();
};

/**
 * Method to complete a transfer
 * @returns {Promise} - Promise resolving to the saved product
 * @throws {Error} If no pending transfer exists
 */
productSchema.methods.completeTransfer = function() {
  if (this.pendingTransfer) {
    this.previousOwner = this.currentOwner;
    
    // Update the current owner
    this.currentOwner = this.pendingTransfer.to;
    
    // Update the ownership history
    this.ownershipHistory.push({
      owner: this.previousOwner,
      timestamp: new Date()
    });

    this.quantity -= this.pendingTransfer.quantity;
    this.transferHistory.push(this.pendingTransfer.to);
    this.pendingTransfer = null;
    return this.save();
  }
  throw new Error('No pending transfer to complete');
};

/**
 * Static method to get products for a specific user
 * @param {ObjectId} userId - ID of the user
 * @returns {Promise} - Promise resolving to an array of products
 */
productSchema.statics.getProductsForUser = function(userId) {
  return this.find({ currentOwner: userId });
};

/**
 * Method to update blockchain information
 * @param {String} blockchainId - Blockchain ID for the product
 * @param {String} txHash - Transaction hash for the product registration
 * @returns {Promise} - Promise resolving to the updated product
 */
productSchema.methods.updateBlockchainInfo = function(blockchainId, txHash) {
  this.blockchainId = blockchainId;
  this.blockchainTxHash = txHash;
  this.blockchainStatus = 'Registered';
  return this.save();
};

/**
 * Method to generate QR code data
 * This method creates a JSON string containing essential product information
 */
productSchema.methods.generateQRCodeData = function() {
  const qrData = {
    productId: this._id,
    type: this.type,
    batchNumber: this.batchNumber,
    origin: this.origin,
    productionDate: this.productionDate,
    status: this.status,
    originalOwner: this.originalOwner,
    currentOwner: this.currentOwner,
    distributor: this.distributor,
    retailer: this.retailer
  };
  this.qrCodeData = JSON.stringify(qrData);
};

// Ensure QR code data is generated before saving
productSchema.pre('save', function(next) {
  if (this.isModified('status') || !this.qrCodeData) {
    this.generateQRCodeData();
  }
  next();
});

/**
 * Method to update product status and QR code
 * @param {String} newStatus - New status of the product
 * @returns {Promise} - Promise resolving to the updated product
 */
productSchema.methods.updateStatusAndQR = function(newStatus) {
  this.status = newStatus;
  return this.generateQRCodeData();
};

module.exports = mongoose.model('Product', productSchema);
