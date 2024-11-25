const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  fromId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantity: { type: Number, required: true, min: 1 },
  transactionType: {
    type: String,
    required: true,
    enum: [
      'Received from Farmer',
      'Transferred to Retailer',
      'Transferred to Distributor',
      'Transfer Initiated',
      'Transfer Accepted',
      'Transfer Cancelled',
      'Sold to Consumer',
      'RetailerToConsumer'
    ]
  },
  transactionDate: { type: Date, default: Date.now },
  status: {
    type: String,
    required: true,
    enum: ['Completed', 'Pending', 'Cancelled'],
    default: 'Completed'
  },
  blockchainTxHash: { type: String },
  price: { type: Number, min: 0 },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transfer' }
}, { timestamps: true });

// Indexes for efficient querying
transactionSchema.index({ productId: 1, fromId: 1, toId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);