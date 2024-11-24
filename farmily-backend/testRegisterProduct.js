const { registerProductOnBlockchain } = require('./services/Web3Service');

(async () => {
  const product = {
    batchNumber: '1234',
    type: 'Wheat',
    origin: 'Farm 1',
    productionDate: '2023-09-01',
    quantity: 100,
    price: 0.05
  };

  try {
    const txHash = await registerProductOnBlockchain(product);
    console.log('Transaction Hash:', txHash);
  } catch (error) {
    console.error('Error:', error);
  }
})();