const mongoose = require('mongoose');

/**
 * QualityCheck schema definition
 * 
 * Represents a quality check performed on a product in the supply chain.
 */
const qualityCheckSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true,
    comment: 'Reference to the Product being checked'
  },
  checkerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    comment: 'User ID of the person performing the check'
  },
  status: { 
    type: String, 
    enum: ['Passed', 'Failed', 'Pending'],
    required: true,
    comment: 'Result of the quality check'
  },
  notes: { 
    type: String,
    comment: 'Additional notes about the quality check'
  },
  checkDate: { 
    type: Date, 
    default: Date.now,
    comment: 'Date and time when the check was performed'
  },
  parameters: {
    temperature: { 
      type: Number,
      comment: 'Temperature at the time of check (if applicable)'
    },
    humidity: { 
      type: Number,
      comment: 'Humidity at the time of check (if applicable)'
    },
    // Add other relevant parameters as needed
  },
  blockchainTxHash: { 
    type: String,
    comment: 'Blockchain transaction hash for this quality check'
  }
}, { 
  timestamps: true 
});

// Index for efficient querying
qualityCheckSchema.index({ productId: 1, checkerId: 1, checkDate: -1 });

// Static method to find the latest quality check for a product
qualityCheckSchema.statics.findLatestForProduct = function(productId) {
  return this.findOne({ productId: productId }).sort({ checkDate: -1 });
};

// Method to update the product with the quality check result
qualityCheckSchema.methods.updateProduct = async function() {
  const Product = mongoose.model('Product');
  const product = await Product.findById(this.productId);
  if (product) {
    product.qualityCheckStatus = this.status;
    product.qualityCheckNotes = this.notes;
    product.qualityChecks.push(this._id);
    await product.save();
  }
};

module.exports = mongoose.model('QualityCheck', qualityCheckSchema);