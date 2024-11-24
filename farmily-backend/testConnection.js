const Web3 = require('web3');

// Replace YOUR_INFURA_PROJECT_ID with your actual Infura project ID
const web3 = new Web3(`https://sepolia.infura.io/v3/4a670768dbc041768196687296ac4375`);

web3.eth.net.isListening()
  .then(() => console.log('Connected to blockchain node'))
  .catch(e => console.log('Failed to connect to blockchain node:', e));
