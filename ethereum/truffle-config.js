require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,            // Match the port with Ganache's default
      network_id: "5777",    // Match the network id with Ganache's default
    },
    goerli: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [process.env.PRIVATE_KEY],
          providerOrUrl: `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
          numberOfAddresses: 1
        }),
      network_id: 5,          // Goerli's id
      gas: 5500000,           // Gas limit, make sure it's enough for your contract
      confirmations: 2,       // # of confirmations to wait between deployments
      timeoutBlocks: 200,     // # of blocks before a deployment times out
      skipDryRun: true        // Skip dry run before migrations? (default: false for public nets)
    },
    sepolia: {
      provider: () =>
        new HDWalletProvider({
          privateKeys: [process.env.PRIVATE_KEY],
          providerOrUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
          numberOfAddresses: 1
        }),
      network_id: 11155111,    // Sepolia's id
      gas: 5500000,            // Gas limit, make sure it's enough for your contract
      confirmations: 2,        // # of confirmations to wait between deployments
      timeoutBlocks: 200,      // # of blocks before a deployment times out
      skipDryRun: true         // Skip dry run before migrations? (default: false for public nets)
    }
  },

  mocha: {
    // timeout: 100000
  },

  compilers: {
    solc: {
      version: "0.8.0", // Match your contract's Solidity version
    }
  },

  db: {
    enabled: false
  }
};
