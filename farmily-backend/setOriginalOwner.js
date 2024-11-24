// migrations/setOriginalOwner.js

const mongoose = require('mongoose');
require('dotenv').config();

async function migrateProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const productsCollection = db.collection('products');

    const productsToUpdate = await productsCollection.find({ originalOwner: { $exists: false } }).toArray();
    console.log(`Found ${productsToUpdate.length} products without originalOwner`);

    for (const product of productsToUpdate) {
      const updateFields = {
        $set: {
          originalOwner: product.currentOwner
        }
      };

      // Handle transferHistory if it's a string
      if (typeof product.transferHistory === 'string') {
        try {
          const parsedTransferHistory = JSON.parse(product.transferHistory);
          updateFields.$set.transferHistory = parsedTransferHistory;
        } catch (parseError) {
          console.error(`Failed to parse transferHistory for product ${product._id}:`, parseError);
          // If parsing fails, set it to an empty array
          updateFields.$set.transferHistory = [];
        }
      }

      // Ensure required fields are set
      ['currentOwner', 'price', 'quantity'].forEach(field => {
        if (product[field] === undefined) {
          updateFields.$set[field] = field === 'price' || field === 'quantity' ? 0 : null;
        }
      });

      // Handle blockchainId separately
      if (product.blockchainId === undefined || product.blockchainId === null) {
        updateFields.$unset = { blockchainId: "" };
      }

      const result = await productsCollection.updateOne(
        { _id: product._id },
        updateFields
      );

      console.log(`Updated product ${product._id}. ModifiedCount: ${result.modifiedCount}`);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

migrateProducts();