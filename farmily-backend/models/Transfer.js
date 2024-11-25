// Transfer.js Schema
const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fromUserType: {
    type: String,
    enum: ['farmer', 'distributor', 'retailer'],
    required: true
  },
  toUserType: {
    type: String,
    enum: ['distributor', 'retailer', 'consumer'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'completed', 'cancelled'],
    default: 'pending'
  },
  blockchainTx: {
    type: String,
    required: true
  },
  acceptedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  // New fields for enhanced traceability
  fromUserType: {
    type: String,
    enum: ['farmer', 'distributor', 'retailer'],
    required: true
  },
  toUserType: {
    type: String,
    enum: ['distributor', 'retailer', 'consumer'],
    required: true
  },
  transferDetails: {
    type: String
  },
  price: {
    type: Number
  },
  // Fields for blockchain synchronization
  blockchainStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending'
  },
  blockchainConfirmationTime: {
    type: Date
  }
}, { timestamps: true });

// Pre-save middleware to set acceptedAt and completedAt dates
transferSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'accepted' && !this.acceptedAt) {
      this.acceptedAt = new Date();
    } else if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    }
  }
  next();
});

/**
 * Static method to create a new transfer
 * @param {Object} transferData - The data for the new transfer
 * @returns {Promise<Transfer>} A promise that resolves with the created transfer
 */
transferSchema.statics.createTransfer = async function(transferData) {
  const transfer = new this(transferData);
  await transfer.save();
  return transfer;
};

// Method to update transfer status
transferSchema.methods.updateStatus = async function(newStatus) {
  this.status = newStatus;
  await this.save();
  return this;
};

// Method to update blockchain status
transferSchema.methods.updateBlockchainStatus = async function(status, txHash) {
  this.blockchainStatus = status;
  if (status === 'confirmed') {
    this.blockchainConfirmationTime = new Date();
  }
  if (txHash) {
    this.blockchainTx = txHash;
  }
  await this.save();
  return this;
};

module.exports = mongoose.model('Transfer', transferSchema);