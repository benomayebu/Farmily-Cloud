/**
 * Consumer Service
 * 
 * This service provides functions for consumers to interact with the food traceability platform.
 * It handles operations such as viewing owned products, accepting transfers from retailers,
 * viewing product history, and interacting with the blockchain through the Web3Service.
 */

angular.module('foodTraceabilityApp')
  .factory('ConsumerService', ['$http', 'Web3Service', '$q', '$timeout', '$window', '$rootScope',
  function($http, Web3Service, $q, $timeout, $window, $rootScope) {
    // Base API URL for backend communication
    const API_URL = 'http://localhost:3000/api/consumer';
    
    /**
     * Helper function to get authorization headers with the JWT token
     * @returns {Object} Headers object with Authorization and Content-Type
     */
    function getAuthHeaders() {
      const token = localStorage.getItem('token');
      return {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      };
    }

    /**
     * Generic error handler for HTTP requests
     * @param {Error} error - The error object
     * @returns {Promise} Rejected promise with error message
     */
    function handleError(error) {
      console.error('Error:', error);
      return $q.reject(error.data || error.message || 'An unexpected error occurred');
    }

    /**
     * Fetch all products owned by the consumer from the backend
     * @returns {Promise<Array>} A promise that resolves with the list of products
     */
    function getProducts() {
      console.log('Fetching products for consumer');
      return $http.get(API_URL + '/products', getAuthHeaders())
        .then(response => {
          console.log('Products fetched successfully:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Get pending transfers for the consumer
     * @returns {Promise<Array>} A promise that resolves with an array of pending transfers
     */
    function getPendingTransfers() {
      console.log('Fetching pending transfers for consumer');
      return $http.get(API_URL + '/pendingTransfers', getAuthHeaders())
        .then(response => {
          console.log('Pending transfers fetched:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Accept a transfer from a retailer
     * @param {string} transferId - The ID of the transfer to accept
     * @returns {Promise<Object>} A promise that resolves with the acceptance result
     */
    function acceptTransfer(transferId) {
      console.log(`Accepting transfer: ${transferId}`);
      return Web3Service.getCurrentAccount()
        .then(function(currentAccount) {
          if (!currentAccount) {
            throw new Error('No Ethereum account connected. Please connect your wallet.');
          }
          console.log(`Current Ethereum account: ${currentAccount}`);
          
          return $http.post(`${API_URL}/acceptTransfer/${transferId}`, 
            { ethereumAddress: currentAccount }, 
            getAuthHeaders()
          );
        })
        .then(function(response) {
          console.log('Backend response:', response.data);
          return {
            success: true,
            message: response.data.message,
            transfer: response.data.transfer,
            blockchainTx: response.data.blockchainTx
          };
        })
        .catch(function(error) {
          console.error('Error in acceptTransfer:', error);
          return {
            success: false,
            error: error.data?.message || error.message || 'Unknown error occurred while accepting transfer'
          };
        });
    }

    /**
     * Get product details including full traceability information
     * @param {string} productId - The ID of the product
     * @returns {Promise<Object>} A promise that resolves with the full product details
     */
    function getProductDetails(productId) {
      console.log(`Fetching full product details for product ID: ${productId}`);
      return $http.get(`${API_URL}/products/${productId}/details`, getAuthHeaders())
        .then(response => {
          console.log('Full product details fetched:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Get product history
     * @param {string} productId - The ID of the product
     * @returns {Promise<Array>} A promise that resolves with the product's history
     */
    function getProductHistory(productId) {
      console.log(`Fetching history for product: ${productId}`);
      return $http.get(`${API_URL}/products/${productId}/history`, getAuthHeaders())
        .then(response => {
          console.log('Product history fetched:', response.data);
          return response.data;
        })
        .catch(handleError);
    }
     /**
     * Get product from QR code data
     * @param {string} qrData - The data from the scanned QR code
     * @returns {Promise<Object>} A promise that resolves with the product information
     */
     function getProductFromQR(qrData) {
      return $http.post(`${API_URL}/getProductFromQR`, { qrData: qrData }, getAuthHeaders())
        .then(function(response) {
          console.log('Product fetched from QR:', response.data);
          return response.data;
        })
        .catch(function(error) {
          console.error('Error fetching product from QR:', error);
          return $q.reject(error.data || error.message || 'An unexpected error occurred');
        });
    }

    /**
     * Get product info manually by ID
     * @param {string} productId - The ID of the product
     * @returns {Promise<Object>} A promise that resolves with the product information
     */
    function getProductInfoManually(productId) {
      return $http.get(`${API_URL}/products/${productId}/details`, getAuthHeaders())
        .then(function(response) {
          console.log('Product info fetched manually:', response.data);
          return response.data;
        })
        .catch(function(error) {
          console.error('Error fetching product info manually:', error);
          return $q.reject(error.data || error.message || 'An unexpected error occurred');
        });
    }

/**
 * Get full product information including farmer, distributor, and retailer details
 * @param {string} productId - The ID of the product
 * @returns {Promise<Object>} A promise that resolves with the full product information
 */
function getProductWithFullInfo(productId) {
  console.log('Fetching full product info for product ID:', productId);
  return $http.get(`${API_URL}/products/${productId}/fullInfo`, getAuthHeaders())
    .then(function(response) {
      console.log('Full product info fetched:', response.data);
      // Process the data to ensure correct stakeholder information
      return processProductInfo(response.data);
    })
    .catch(function(error) {
      console.error('Error fetching full product info:', error);
      return $q.reject({
        message: 'Failed to fetch full product info', 
        details: error.data || error.statusText
      });
    });
}

/**
 * Process product information to ensure correct stakeholder details
 * @param {Object} data - The raw product data
 * @returns {Object} Processed product data
 */
function processProductInfo(data) {
  // Ensure the data structure matches what's expected in the frontend
  return {
    product: data.product,
    farmer: data.farmer,
    distributor: data.distributor,
    currentOwner: data.currentOwner, 
    consumer: data.consumer,
    blockchainStatus: data.blockchainStatus,
    blockchainQuantity: data.blockchainQuantity,
    ownershipHistory: data.ownershipHistory
  };
}


     /**
     * Submit feedback for a product
     * @param {string} productId - The ID of the product
     * @param {Object} feedback - The feedback object containing rating and comments
     * @returns {Promise<Object>} A promise that resolves with the feedback submission result
     */
     function submitFeedback(productId, feedback) {
      console.log(`Submitting feedback for product: ${productId}`, feedback);
      return $http.post(`${API_URL}/submitFeedback/${productId}`, feedback, getAuthHeaders())
        .then(response => {
          console.log('Feedback submitted successfully:', response.data);
          return response.data;
        })
        .catch(error => {
          console.error('Error submitting feedback:', error);
          return $q.reject(error.data || error.message || 'An unexpected error occurred while submitting feedback');
        });
    }

    /**
     * Generate a QR code for a product
     * @param {Object} product - The product object to generate QR code for
     * @returns {Promise<string>} A promise that resolves with the QR code data URL
     */
    function generateQRCode(product) {
      return $q(function(resolve, reject) {
        if (typeof QRCode === 'undefined') {
          console.error('QRCode library not found');
          reject('QRCode library not found');
          return;
        }
    
        var qrData = {
          productId: product._id,
          type: product.type,
          batchNumber: product.batchNumber,
          origin: product.origin,
          productionDate: product.productionDate,
          status: product.status
        };
    
        var qr = new QRCode(document.createElement('div'), {
          text: JSON.stringify(qrData),
          width: 256,
          height: 256,
          correctLevel: QRCode.CorrectLevel.H
        });
    
        var dataURL = qr._el.querySelector('canvas').toDataURL();
        resolve(dataURL);
      });
    }
    /**
     * Update the Ethereum address for the consumer
     * @param {string} address - The new Ethereum address
     * @returns {Promise<Object>} A promise that resolves with the update result
     */
    function updateEthereumAddress(address) {
      console.log(`Updating Ethereum address to: ${address}`);
      return $http.put(`${API_URL}/updateEthereumAddress`, { ethereumAddress: address }, getAuthHeaders())
        .then(response => {
          console.log('Ethereum address updated successfully:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Get transaction history for the consumer
     * @returns {Promise<Array>} A promise that resolves with the transaction history
     */
    function getTransactionHistory() {
      console.log('Fetching transaction history');
      return $http.get(API_URL + '/transactionHistory', getAuthHeaders())
        .then(response => {
          console.log('Transaction history fetched:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Verify product authenticity on the blockchain
     * @param {string} productId - The ID of the product to verify
     * @returns {Promise<Object>} A promise that resolves with the verification result
     */
    function verifyProductAuthenticity(productId) {
      console.log(`Verifying authenticity for product: ${productId}`);
      return Web3Service.verifyProductOnBlockchain(productId)
        .then(result => {
          console.log('Product authenticity verification result:', result);
          return result;
        })
        .catch(error => {
          console.error('Error verifying product authenticity:', error);
          return { verified: false, error: error.message };
        });
    }

    // Expose service methods
    return {
      getProducts: getProducts,
      getPendingTransfers: getPendingTransfers,
      acceptTransfer: acceptTransfer,
      getProductDetails: getProductDetails,
      getProductHistory: getProductHistory,
      getProductFromQR: getProductFromQR,
      getProductInfoManually:getProductInfoManually,
      submitFeedback: submitFeedback,
      getProductWithFullInfo: getProductWithFullInfo,
      generateQRCode: generateQRCode,
      updateEthereumAddress: updateEthereumAddress,
      getTransactionHistory: getTransactionHistory,
      verifyProductAuthenticity: verifyProductAuthenticity
    };
  }]);