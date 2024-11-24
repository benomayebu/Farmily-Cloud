// updateBlockchainIds.js

const mongoose = require('mongoose');
const Product = require('./models/Product'); // Adjust the path based on your project structure

// Connect to your MongoDB instance
mongoose.connect('mongodb+srv://benjaminomayebu:FZIM2ZG5t6dtjioC@farmily.xax4qxf.mongodb.net/ ', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function updateUndefinedBlockchainIds() {
  try {
    const products = await Product.find({ blockchainId: { $exists: false } });
    console.log(`Found ${products.length} products with undefined blockchainId.`);

    for (let product of products) {
      // Update the blockchainId with valid logic, e.g., fetching from blockchain or generating a new one
      product.blockchainId = `0x${(Math.random() * 1e18).toString(16)}`; // Example logic, replace with real ID fetching
      await product.save();
      console.log(`Updated product with batchNumber: ${product.batchNumber}, new blockchainId: ${product.blockchainId}`);
    }
  } catch (error) {
    console.error('Error updating products:', error);
  } finally {
    mongoose.disconnect(); // Close the connection when done
  }
}

// Run the update function
updateUndefinedBlockchainIds();
