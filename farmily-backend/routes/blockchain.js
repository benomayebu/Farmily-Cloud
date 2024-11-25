// routes/blockchain.js

const express = require('express');
const router = express.Router();
const Web3 = require('web3');
const contractABI = require('../config/contractABI.json'); // Load the ABI of the smart contract
const contractAddress = '0x09b116fd1414c95a9264035b9c55af074b9ca587'; // deployed contract address
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545')); // Connect to your Ethereum node

// Create an instance of the smart contract
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Middleware to ensure a valid Ethereum address
const validateAddress = (req, res, next) => {
  const { sender, recipient } = req.body;
  if (!web3.utils.isAddress(sender) || !web3.utils.isAddress(recipient)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }
  next();
};

// Route to get all products (replace with smart contract interaction)
router.get('/products', async (req, res) => {
  try {
    const productCount = await contract.methods.productCount().call();
    const products = [];
    for (let i = 1; i <= productCount; i++) {
      const product = await contract.methods.getProduct(i).call();
      products.push(product);
    }
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Route to create a new product
router.post('/products', async (req, res) => {
  const { batchNumber, productType, origin, productionDate, quantity, price, owner } = req.body;
  try {
    const accounts = await web3.eth.getAccounts();
    const receipt = await contract.methods.createProduct(batchNumber, productType, origin, productionDate, quantity, price)
      .send({ from: owner || accounts[0] }); // If owner is provided, use it; otherwise, default to the first account
    res.json({ message: 'Product created', receipt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Route to transfer ownership of a product
router.post('/transfer', validateAddress, async (req, res) => {
  const { productId, newOwner, quantity, sender } = req.body;
  try {
    const receipt = await contract.methods.transferOwnership(productId, newOwner, quantity)
      .send({ from: sender });
    res.json({ message: 'Ownership transferred', receipt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to transfer ownership' });
  }
});

// Route to update product status
router.post('/updateStatus', async (req, res) => {
  const { productId, newStatus, sender } = req.body;
  try {
    const receipt = await contract.methods.updateProductStatus(productId, newStatus)
      .send({ from: sender });
    res.json({ message: 'Product status updated', receipt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product status' });
  }
});

module.exports = router;
