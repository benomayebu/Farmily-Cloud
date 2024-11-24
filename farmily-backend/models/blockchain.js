// models/blockchain.js
const crypto = require('crypto');

class Blockchain {
  constructor() {
    this.chain = [];
    this.pendingTransactions = [];
    this.createBlock('0'); // Genesis block
  }

  createBlock(previousHash) {
    const block = {
      index: this.chain.length + 1,
      timestamp: Date.now(),
      transactions: this.pendingTransactions,
      previousHash: previousHash,
      hash: this.hashBlock(this.chain.length + 1, this.pendingTransactions, previousHash)
    };

    this.pendingTransactions = [];
    this.chain.push(block);
    return block;
  }

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  hashBlock(index, transactions, previousHash) {
    const dataAsString = `${index}${JSON.stringify(transactions)}${previousHash}`;
    return crypto.createHash('sha256').update(dataAsString).digest('hex');
  }

  addTransaction(sender, recipient, amount) {
    this.pendingTransactions.push({ sender, recipient, amount });
    return this.getLastBlock().index + 1;
  }
}

module.exports = Blockchain;