/**
 * Distributor Service
 * 
 * This service provides functions for distributors to interact with the food traceability platform.
 * It handles operations such as accepting transfers, managing products, initiating transfers to retailers,
 * and interacting with the blockchain through the Web3Service.
 */

angular.module('foodTraceabilityApp')
  .factory('DistributorService', ['$http', 'Web3Service', '$q', '$timeout', '$window', 
  function($http, Web3Service, $q, $timeout, $window) {
    // Base API URL for backend communication
    const API_URL = 'http://localhost:3000/api/distributor';
    
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
     * Fetch all products available to the distributor from the backend
     * @returns {Promise} A promise that resolves with the list of products
     */
    function getProducts() {
      console.log('Fetching products for distributor');
      return $http.get(API_URL + '/products', getAuthHeaders())
        .then(response => {
          console.log('Products fetched successfully:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Accept a transfer from a farmer
     * @param {string} transferId - The ID of the transfer to accept
     * @returns {Promise} A promise that resolves with the acceptance result
     */
    /**
     * Accept a transfer from a farmer
     * @param {string} transferId - The ID of the transfer to accept
     * @returns {Promise} A promise that resolves with the acceptance result
     */
    function acceptTransfer(transferId) {
      console.log(`Attempting to accept transfer: ${transferId}`);
      
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
          console.error('Detailed error in acceptTransfer:', error);
          return {
            success: false,
            error: error.data?.message || error.message || 'Unknown error occurred while accepting transfer'
          };
        });
    }


   /**
 * Initiate a transfer to a retailer
 * @param {Object} transferData - The transfer data including productId, retailerId, and quantity
 * @returns {Promise<Object>} - A promise that resolves with the transfer result
 */
function initiateTransferToRetailer(transferData) {
  console.log('Initiating transfer to retailer:', transferData);
  return Web3Service.initiateDistributorTransferOnBlockchain(transferData.productId, transferData.retailerId, transferData.quantity)
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
      return {
        success: false,
        error: error.data?.message || error.message || 'An error occurred while initiating transfer'
      };
    });
}
    /**
     * Fetch pending transfers for the distributor
     * @returns {Promise} A promise that resolves with the list of pending transfers
     */
    function getPendingTransfers() {
      console.log('Fetching pending transfers');
      return $http.get(API_URL + '/pendingTransfers', getAuthHeaders())
        .then(response => {
          console.log('Pending transfers fetched:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Fetch the list of retailers
     * @returns {Promise} A promise that resolves with the list of retailers
     */
    function getRetailers() {
      console.log('Fetching retailers');
      return $http.get(API_URL + '/retailers', getAuthHeaders())
        .then(response => {
          console.log('Retailers fetched:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Search for retailers based on a search term
     * @param {string} searchTerm - The term to search for
     * @returns {Promise} A promise that resolves with the search results
     */
    function searchRetailers(searchTerm) {
      console.log(`Searching retailers with term: ${searchTerm}`);
      return $http.get(`${API_URL}/searchRetailers`, {
        params: { search: searchTerm },
        ...getAuthHeaders()
      })
        .then(response => {
          console.log('Retailer search results:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Update product information
     * @param {string} productId - The ID of the product to update
     * @param {Object} updatedInfo - The updated product information
     * @returns {Promise} A promise that resolves with the update result
     */
    function updateProductInfo(productId, updatedInfo) {
      console.log(`Updating product info for product ID: ${productId}`, updatedInfo);
      return $http.put(`${API_URL}/updateProduct/${productId}`, updatedInfo, getAuthHeaders())
        .then(response => {
          console.log('Product info updated successfully:', response.data);
          return {
            success: true,
            message: response.data.message,
            product: response.data.product
          };
        })
        .catch(error => {
          console.error('Error updating product info:', error);
          return {
            success: false,
            error: error.data?.message || error.message || 'An error occurred while updating product info'
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
    return Web3Service.connectWallet()
      .then(() => {
        return $http.post(`${API_URL}/syncProduct/${productId}`, {}, getAuthHeaders());
      })
      .then(response => {
        console.log('Product synced with blockchain:', response.data);
        return response.data;
      })
      .catch(error => {
        console.error('Error syncing product with blockchain:', error);
        // Check if the error is from the server and has a message
        if (error.data && error.data.message) {
          return { 
            success: false, 
            error: error.data.message
          };
        }
        return { 
          success: false, 
          error: 'An unexpected error occurred while syncing product. Please try again later.'
        };
      });
  }

    /**
     * Get transaction history for the distributor
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
     * Get product information including farmer details
     * @param {string} productId - The ID of the product
     * @returns {Promise<Object>} A promise that resolves with the product and farmer information
     */
    function getProductWithFarmerInfo(productId) {
      console.log(`Fetching product with farmer info: ${productId}`);
      return $http.get(`${API_URL}/productWithFarmerInfo/${productId}`, getAuthHeaders())
        .then(response => {
          console.log('Product with farmer info fetched:', response.data);
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
     * Generate a QR code for a product
     * @param {string} productInfo - JSON string of product information
     * @returns {Promise<string>} A promise that resolves with the QR code data URL
     */
    function generateQRCode(productInfo) {
      return $q(function(resolve, reject) {
        if (typeof QRCode === 'undefined') {
          console.error('QRCode library not found');
          reject('QRCode library not found');
          return;
        }
    
        // Limit the amount of data or use a higher version QR code
        var qr = new QRCode(document.createElement('div'), {
          text: JSON.stringify(productInfo),
          width: 256,
          height: 256,
          correctLevel: QRCode.CorrectLevel.H,
          version: 40  // Use the highest version for maximum data capacity
        });
    
        // Convert to data URL
        var dataURL = qr._el.querySelector('canvas').toDataURL();
        resolve(dataURL);
      });
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
     * Update the Ethereum address for the distributor
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

    // Expose service methods
    return {
      getProducts: getProducts,
      acceptTransfer: acceptTransfer,
      initiateTransferToRetailer: initiateTransferToRetailer,
      getPendingTransfers: getPendingTransfers,
      getRetailers: getRetailers,
      searchRetailers: searchRetailers,
      updateProductInfo: updateProductInfo,
      syncProductWithBlockchain: syncProductWithBlockchain,
      getTransactionHistory: getTransactionHistory,
      getProductWithFarmerInfo: getProductWithFarmerInfo,
      generateQRCode: generateQRCode,
      getProductWithFullInfo: getProductWithFullInfo,
      getProductTraceability: getProductTraceability,
      getProductDetails: getProductDetails,
      updateProductStatus: updateProductStatus,
      updateEthereumAddress: updateEthereumAddress
    };
  }]);