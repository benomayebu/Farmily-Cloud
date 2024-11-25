/**
 * Retailer Service
 * 
 * This service provides functions for retailers to interact with the food traceability platform.
 * It handles operations such as receiving products, updating product information, initiating transfers to consumers,
 * and interacting with the blockchain through the Web3Service.
 */

angular.module('foodTraceabilityApp')
  .factory('RetailerService', ['$http', 'Web3Service', '$q', '$timeout', '$window', 
  function($http, Web3Service, $q, $timeout, $window) {
    // Base API URL for backend communication
    const API_URL = 'http://localhost:3000/api/retailer';
    
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
     * Fetch all products available to the retailer from the backend
     * @returns {Promise} A promise that resolves with the list of products
     */
    function getProducts() {
      console.log('Fetching products for retailer');
      return $http.get(API_URL + '/products', getAuthHeaders())
        .then(response => {
          console.log('Products fetched successfully:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Get pending transfers for the retailer
     * @returns {Promise<Object>} - Resolves with an array of pending transfers
     */
    function getPendingTransfers() {
      console.log('Fetching pending transfers for retailer');
      return $http.get(API_URL + '/pendingTransfers', getAuthHeaders())
        .then(response => {
          console.log('Pending transfers fetched:', response.data);
          return response.data;
        })
        .catch(error => {
          console.error('Error fetching pending transfers:', error);
          return $q.reject(error.data || error.message || 'An unexpected error occurred');
        });
    }

    /**
     * Accept a transfer from a distributor
     * @param {string} transferId - The ID of the transfer to accept
     * @returns {Promise<Object>} - Resolves with the acceptance result
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
     * Receive a product from a distributor
     * @param {string} transferId - The ID of the transfer to receive
     * @returns {Promise} A promise that resolves with the reception result
     */
    function receiveProduct(transferId) {
      console.log(`Attempting to receive product transfer: ${transferId}`);
      
      return Web3Service.getCurrentAccount()
        .then(function(currentAccount) {
          if (!currentAccount) {
            throw new Error('No Ethereum account connected. Please connect your wallet.');
          }
          console.log(`Current Ethereum account: ${currentAccount}`);
          
          return $http.post(`${API_URL}/receiveProduct/${transferId}`, 
            { ethereumAddress: currentAccount }, 
            getAuthHeaders()
          );
        })
        .then(function(response) {
          console.log('Backend response:', response.data);
          if (response.data.status === 'completed') {
            return {
              success: true,
              message: 'Transfer is already completed. Database updated.',
              status: 'completed',
              transfer: response.data.transfer
            };
          }
          if (response.data.status === 'failed') {
            return {
              success: false,
              message: 'Transfer failed on the blockchain.',
              status: 'failed',
              transfer: response.data.transfer
            };
          }
          return {
            success: true,
            message: response.data.message,
            status: response.data.status,
            transfer: response.data.transfer,
            blockchainTx: response.data.blockchainTx
          };
        })
        .catch(function(error) {
          console.error('Detailed error in receiveProduct:', error);
          return {
            success: false,
            error: error.data?.message || error.message || 'Unknown error occurred while receiving product'
          };
        });
    }

/**
 * Update product information
 * @param {string} productId - The ID of the product to update
 * @param {Object} updatedInfo - The updated product information
 * @returns {Promise<Object>} A promise that resolves with the update result
 */
function updateProductInfo(productId, updatedInfo) {
  console.log(`Updating product info for product ID: ${productId}`, updatedInfo);
  
  return $http.put(`${API_URL}/updateProduct/${productId}`, updatedInfo, getAuthHeaders())
    .then(response => {
      console.log('Product info updated successfully in database:', response.data);
      
      return Web3Service.updateProductInfoAsRetailer(response.data.product.blockchainId, updatedInfo);
    })
    .then(blockchainResult => {
      console.log('Product info updated successfully on blockchain:', blockchainResult);
      return $http.get(`${API_URL}/products/${productId}`, getAuthHeaders());
    })
    .then(response => {
      console.log('Fetched updated product details:', response.data);
      return {
        success: true,
        message: 'Product updated successfully in database and on blockchain',
        product: response.data
      };
    })
    .catch(error => {
      console.error('Error updating product info:', error);
      return {
        success: false,
        error: error.error || error.message || 'An error occurred while updating product info'
      };
    });
}
/**
 * Sync a product with the blockchain
 * @param {string} productId - The ID of the product to sync
 * @returns {Promise} A promise that resolves with the sync result
 */
function syncProductWithBlockchain(productId) {
  console.log(`Syncing product with blockchain: ${productId}`);
  return Web3Service.getCurrentAccount()
    .then(account => {
      if (!account) {
        throw new Error('No Ethereum account connected. Please connect your wallet.');
      }
      return $http.post(`${API_URL}/syncProduct/${productId}`, { ethereumAddress: account }, getAuthHeaders());
    })
    .then(response => {
      console.log('Product synced with blockchain:', response.data);
      return { success: true, data: response.data };
    })
    .catch(error => {
      console.error('Error syncing product with blockchain:', error);
      const errorMessage = error.data && error.data.message 
        ? error.data.message 
        : 'An unexpected error occurred while syncing product.';
      return { 
        success: false, 
        error: errorMessage
      };
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
          status: product.status,
          quantity: product.quantity,
          farmer: product.originalOwner ? product.originalOwner.username : 'Unknown',
          distributor: product.distributor ? product.distributor.username : 'Unknown',
          retailer: product.currentOwner ? product.currentOwner.username : 'Unknown',
          storageConditions: product.storageConditions,
          shelfLife: product.shelfLife,
          price: product.price
        };
    
        var qr = new QRCode(document.createElement('div'), {
          text: JSON.stringify(qrData),
          width: 256,
          height: 256,
          correctLevel: QRCode.CorrectLevel.H,
          version: 40
        });
    
        var dataURL = qr._el.querySelector('canvas').toDataURL();
        resolve(dataURL);
      });
    }

/**
 * Initiate a transfer to a consumer
 * @param {Object} transferData - The transfer data including productId, consumerId, and quantity
 * @returns {Promise<Object>} - A promise that resolves with the transfer result
 */
function initiateTransferToConsumer(transferData) {
  console.log('Initiating transfer to consumer:', transferData);
  return Web3Service.initiateRetailerToConsumerTransfer(transferData.productId, transferData.consumerId, transferData.quantity)
    .then(result => {
      console.log('Transfer initiated successfully on blockchain:', result);
      if (result.success) {
        // Update backend after successful blockchain transaction
        return $http.post(`${API_URL}/initiateTransfer`, {
          ...transferData,
          blockchainTxHash: result.txHash
        }, getAuthHeaders());
      } else {
        throw new Error(result.error || 'Blockchain transfer initiation failed');
      }
    })
    .then(response => {
      console.log('Backend updated with transfer:', response.data);
      return {
        success: true,
        message: 'Transfer initiated successfully',
        transfer: response.data.transfer,
        blockchainTx: response.data.blockchainTx
      };
    })
    .catch(error => {
      console.error('Error initiating transfer:', error);
      // Improved error handling
      let errorMessage = 'An error occurred while initiating transfer';
      if (error.status === 500 && error.data && error.data.error) {
        errorMessage = error.data.error;
      } else if (error.data && error.data.message) {
        errorMessage = error.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      return {
        success: false,
        error: errorMessage
      };
    });
}

    /**
     * Get transaction history for the retailer
     * @returns {Promise} A promise that resolves with the transaction history
     */
    function getTransactionHistory() {
      console.log('Fetching transaction history');
      return $http.get(API_URL + '/transactionHistory', getAuthHeaders())
        .then(response => {
          console.log('Transaction history fetched:', response.data);
          return response.data;
        })
        .catch(error => {
          console.error('Error fetching transaction history:', error);
          return handleError(error);
        });
    }

    /**
     * Get product information including distributor details
     * @param {string} productId - The ID of the product
     * @returns {Promise<Object>} A promise that resolves with the product and distributor information
     */
    function getProductWithDistributorInfo(productId) {
      console.log(`Fetching product with distributor info: ${productId}`);
      return $http.get(`${API_URL}/productWithDistributorInfo/${productId}`, getAuthHeaders())
        .then(response => {
          console.log('Product with distributor info fetched:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Get product traceability information
     * @param {string} productId - The ID of the product
     * @returns {Promise<Object>} A promise that resolves with the traceability information
     */
    function getProductTraceability(productId) {
      console.log(`Fetching traceability for product: ${productId}`);
      return $http.get(`${API_URL}/productTraceability/${productId}`, getAuthHeaders())
        .then(response => {
          console.log('Product traceability fetched:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Get full information of product traceability
     * @param {string} productId - The ID of the product
     * @returns {Promise<Object>} A promise that resolves with the full product information
     */
    function getProductWithFullInfo(productId) {
      console.log(`Fetching full product info for product ID: ${productId}`);
      return $http.get(`${API_URL}/products/${productId}/fullInfo`, getAuthHeaders())
        .then(response => {
          console.log('Full product info fetched:', response.data);
          return response.data;
        })
        .catch(error => {
          console.error('Error fetching full product info:', error);
          return $q.reject({message: 'Failed to fetch full product info', details: error});
        });
    }

    /**
     * Get details of a specific product
     * @param {string} productId - The ID of the product
     * @returns {Promise} A promise that resolves with the product details
     */
    function getProductDetails(productId) {
      console.log(`Fetching product details for product ID: ${productId}`);
      return $http.get(`${API_URL}/products/${productId}`, getAuthHeaders())
        .then(response => {
          console.log('Product details fetched successfully:', response.data);
          return response.data;
        })
        .catch(error => {
          console.error('Error fetching product details:', error);
          return handleError(error);
        });
    }

    /**
     * Update product status
     * @param {string} productId - The ID of the product to update
     * @param {string} newStatus - The new status to set
     * @returns {Promise} A promise that resolves with the update result
     */
    function updateProductStatus(productId, newStatus) {
      console.log(`Updating status for product ${productId} to ${newStatus}`);
      return $http.put(`${API_URL}/updateProductStatus/${productId}`, { status: newStatus }, getAuthHeaders())
        .then(response => {
          console.log('Product status updated successfully:', response.data);
          return {
            success: true,
            message: response.data.message,
            product: response.data.product
          };
        })
        .catch(error => {
          console.error('Error updating product status:', error);
          return {
            success: false,
            error: error.data?.message || error.message || 'An error occurred while updating product status'
          };
        });
    }

    /**
     * Update the Ethereum address for the retailer
     * @param {string} address - The new Ethereum address
     * @returns {Promise} A promise that resolves with the update result
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
     * Record consumer feedback for a product
     * @param {string} productId - The ID of the product
     * @param {Object} feedback - The feedback object containing rating and comments
     * @returns {Promise} A promise that resolves with the feedback submission result
     */
    function recordConsumerFeedback(productId, feedback) {
      console.log(`Recording consumer feedback for product: ${productId}`, feedback);
      return $http.post(`${API_URL}/recordFeedback/${productId}`, feedback, getAuthHeaders())
        .then(response => {
          console.log('Feedback recorded successfully:', response.data);
          return {
            success: true,
            message: response.data.message,
            feedback: response.data.feedback
          };
        })
        .catch(error => {
          console.error('Error recording feedback:', error);
          return {
            success: false,
            error: error.data?.message || error.message || 'An error occurred while recording feedback'
          };
        });
    }

    /**
     * Get consumer list or search consumers
     * @param {string} [searchTerm] - Optional search term for filtering consumers
     * @returns {Promise<Array>} A promise that resolves with the list of consumers
     */
    function getConsumers(searchTerm) {
      console.log('Fetching consumers', searchTerm ? `with search term: ${searchTerm}` : '');
      let url = API_URL + '/consumers';
      if (searchTerm) {
        url += `?search=${encodeURIComponent(searchTerm)}`;
      }
      return $http.get(url, getAuthHeaders())
        .then(response => {
          console.log('Consumers fetched:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    // Expose service methods
    return {
      getProducts: getProducts,
      getPendingTransfers: getPendingTransfers,
      acceptTransfer: acceptTransfer,
      receiveProduct: receiveProduct,
      updateProductInfo,
      initiateTransferToConsumer: initiateTransferToConsumer,
      syncProductWithBlockchain: syncProductWithBlockchain,
      getTransactionHistory: getTransactionHistory,
      getProductWithDistributorInfo: getProductWithDistributorInfo,
      getProductTraceability: getProductTraceability,
      generateQRCode: generateQRCode,
      getProductWithFullInfo: getProductWithFullInfo,
      getProductDetails: getProductDetails,
      updateProductStatus: updateProductStatus,
      updateEthereumAddress: updateEthereumAddress,
      recordConsumerFeedback: recordConsumerFeedback,
      getConsumers: getConsumers
    };
  }]);