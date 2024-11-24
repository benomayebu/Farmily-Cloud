// updateBlockchainIds.js

// Connect to MongoDB
const mongoose = require('mongoose');
const Product = require('./models/Product'); // Adjust this path if necessary

mongoose.connect('mongodb+srv://benjaminomayebu:FZIM2ZG5t6dtjioC@farmily.xax4qxf.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Failed to connect to MongoDB:', err));

async function updateUndefinedBlockchainIds() {
  try {
    const products = await Product.find({ blockchainId: { $exists: false } });
    
    console.log(`Found ${products.length} products with undefined blockchainId.`);
    
    if (products.length === 0) {
      console.log('No products found with undefined blockchainId.');
      return;
    }
    
    for (let product of products) {
      // Generate a random blockchainId
      product.blockchainId = `0x${(Math.random() * 1e18).toString(16)}`;
      
      // Fix invalid status
      if (!['Registered', 'Planted', 'Growing', 'Harvested', 'Processed', 'Packaged', 'InTransit', 'Delivered'].includes(product.status)) {
        product.status = 'Registered'; // Set a default status
      }
      
      // Fix missing currentOwner
      if (!product.currentOwner) {
        product.currentOwner = mongoose.Types.ObjectId(); // Set a placeholder ObjectId
      }
      
      // Fix transferHistory issues
      if (typeof product.transferHistory === 'string') {
        try {
          let parsedHistory = JSON.parse(product.transferHistory);
          // Convert string ObjectIds to actual ObjectIds
          parsedHistory = parsedHistory.map(entry => ({
            ...entry,
            fromOwner: mongoose.Types.ObjectId(entry.fromOwner),
            toOwner: mongoose.Types.ObjectId(entry.toOwner),
            _id: mongoose.Types.ObjectId(entry._id)
          }));
          product.transferHistory = parsedHistory;
        } catch (parseError) {
          console.error(`Error parsing transferHistory for product ${product.batchNumber}:`, parseError);
          product.transferHistory = []; // Set to empty array if parsing fails
        }
      } else if (!Array.isArray(product.transferHistory)) {
        product.transferHistory = []; // Ensure it's an array
      }
      
      try {
        await product.save({ validateBeforeSave: false }); // Skip validation for now
        console.log(`Updated product with batchNumber: ${product.batchNumber}, new blockchainId: ${product.blockchainId}`);
      } catch (saveError) {
        console.error(`Error saving product with batchNumber: ${product.batchNumber}`, saveError);
      }
    }
  } catch (error) {
    console.error('Error updating products:', error);
  } finally {
    mongoose.disconnect().then(() => console.log('Disconnected from MongoDB'));
  }
}

updateUndefinedBlockchainIds();

