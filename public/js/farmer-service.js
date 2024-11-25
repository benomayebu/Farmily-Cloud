/**
 * Farmer Service
 * 
 * This service provides functions for farmers to interact with the food traceability platform.
 * It handles operations such as registering products, updating product status, initiating transfers,
 * and interacting with the blockchain through the Web3Service.
 */

angular.module('foodTraceabilityApp')
  .factory('FarmerService', ['$http', 'Web3Service', '$q', function($http, Web3Service, $q) {
    // Base API URL for backend communication
    const API_URL = 'http://localhost:3000/api/farmer';

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
 * Register a new product on the blockchain and save it in the backend.
 * 
 * @param {Object} product - The product to register.
 * @returns {Promise<Object>} A promise that resolves with the registration result.
 */
function registerProduct(product) {
  console.log('Registering new product:', product);
  
  // Ensure certifications is an array
  if (typeof product.certifications === 'string') {
    product.certifications = [product.certifications];
  }

  // Convert productionDate to ISO string format if it's not already
  if (product.productionDate instanceof Date) {
    product.productionDate = product.productionDate.toISOString();
  } else if (typeof product.productionDate === 'string' && !product.productionDate.endsWith('Z')) {
    // If it's a string but not in ISO format, convert it
    product.productionDate = new Date(product.productionDate).toISOString();
  }

  return $http.post(API_URL + '/registerProduct', product, getAuthHeaders())
    .then(response => {
      console.log('Backend registration response:', response.data);
      const registeredProduct = response.data.product;
      return Web3Service.registerProductOnBlockchain(registeredProduct);
    })
    .then(blockchainResult => {
      console.log('Blockchain registration result:', blockchainResult);
      if (blockchainResult.success) {
        return updateProductWithBlockchain(
          blockchainResult.productId, 
          blockchainResult.blockchainId,
          blockchainResult.txHash
        );
      } else {
        throw new Error(blockchainResult.error || 'Failed to register product on blockchain');
      }
    })
    .catch(error => {
      console.error('Error in registerProduct:', error);
      return $q.reject(error.data || error.message || 'An unexpected error occurred');
    });
}

/**
 * Fetch all products registered by the farmer from the backend
 * @returns {Promise} A promise that resolves with the list of products
 */
function getProducts() {
  return $http.get(API_URL + '/products', getAuthHeaders())
    .then(response => response.data)
    .catch(error => {
      console.error('Error fetching products:', error);
      return $q.reject(error.data || error.message || 'Failed to fetch products');
    });
}

/**
 * Fetch pending transfers for the farmer
 * @returns {Promise} A promise that resolves with the list of pending transfers
 */
function getPendingTransfers() {
  return $http.get(API_URL + '/pendingTransfers', getAuthHeaders())
    .then(response => response.data)
    .catch(error => {
      console.error('Error fetching pending transfers:', error);
      return $q.reject(error.data || error.message || 'Failed to fetch pending transfers');
    });
}

    /**
     * Fetch transaction history for the farmer
     * @returns {Promise} A promise that resolves with the transaction history
     */
    function getTransactionHistory() {
      return $http.get(API_URL + '/transactionHistory', getAuthHeaders())
        .then(response => response.data)
        .catch(handleError);
    }

    /**
     * Fetch production insights (such as total quantity, revenue, etc.)
     * @returns {Promise} A promise that resolves with the production insights
     */
    function getProductionInsights() {
      return $http.get(API_URL + '/productionInsights', getAuthHeaders())
        .then(response => response.data)
        .catch(handleError);
    }

  /**
     * Sync a single product with the blockchain
     * 
     * This function retrieves the product data from the blockchain using its blockchainId and 
     * synchronizes it with the backend database.
     * 
     * @param {string} blockchainId - The blockchain ID of the product to sync
     * @returns {Promise<Object>} A promise that resolves with the sync result
     */
  function syncProductWithBlockchain(productId) {
    return Web3Service.connectWallet()
      .then(() => {
        return $http.post(`${API_URL}/syncProduct/${productId}`, {}, getAuthHeaders());
      })
      .then(response => {
        console.log('Product successfully synced with blockchain:', response.data);
        return response.data;
      })
      .catch(error => {
        console.error('Error syncing product with blockchain:', error);
        return { 
          success: false, 
          error: 'Error occurred while syncing product. Please try again later.'
        };
      });
  }

/**
     * Sync all products with the blockchain
     * @returns {Promise<Object>} A promise that resolves when all products are synced
     */
function syncProductsWithBlockchain() {
  return $http.get(API_URL + '/products', getAuthHeaders())
    .then(response => {
      const products = response.data;
      console.log('Products to sync:', products);
      const syncPromises = products
        .filter(product => product.blockchainId)
        .map(product => {
          console.log(`Attempting to sync product with blockchain_id: ${product.blockchainId}`);
          return syncProductWithBlockchain(product.blockchainId)
            .catch(error => {
              console.error(`Failed to sync product ${product.blockchainId}:`, error);
              return { success: false, error: error.message };
            });
        });
      return $q.all(syncPromises);
    })
    .then(results => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      return { 
        success: true, 
        message: `Sync completed. ${successCount} products synced successfully, ${failCount} failed.` 
      };
    })
    .catch(handleError);
}


 /**
     * Update the status of a product both on the blockchain and in the backend
     * 
     * @param {string} productId - The ID of the product in the database
     * @param {string} newStatus - The new status to update
     * @returns {Promise<Object>} A promise that resolves with the update result
     */
 function updateProductStatus(productId, newStatus) {
  console.log(`Updating product status: ${productId} ${newStatus}`);

  return $http.get(`${API_URL}/products/${productId}`, getAuthHeaders())
    .then(response => {
      console.log('Product retrieved from database:', response.data);
      const product = response.data;
      if (!product) {
        throw new Error('Product not found in the database.');
      }
      
      // Check if blockchainId exists, if not, generate a temporary one
      if (!product.blockchainId) {
        console.log('Product does not have a blockchain ID. Generating a temporary one.');
        product.blockchainId = `0x${(Math.random() * 1e18).toString(16)}`;
        
        // Update the product in the database with the temporary blockchainId
        return $http.put(`${API_URL}/products/${productId}`, { blockchainId: product.blockchainId }, getAuthHeaders())
          .then(() => product);
      }
      
      return product;
    })
    .then(product => {
      const blockchainStatus = convertStatusToBlockchain(newStatus);

      return Web3Service.updateProductStatusOnBlockchain(product.blockchainId, blockchainStatus)
        .then(result => {
          if (result.success) {
            console.log('Blockchain update successful, updating backend');
            return $http.put(`${API_URL}/products/${productId}/status`, 
                             { 
                               status: newStatus, 
                               blockchainTxHash: result.txHash
                             },
                             getAuthHeaders());
          } else {
            throw new Error(result.error || 'Failed to update product status on the blockchain');
          }
        });
    })
    .then(response => {
      console.log('Backend update response:', response.data);
      return { 
        success: true, 
        message: response.data.message, 
        product: response.data.product 
      };
    })
    .catch(error => {
      console.error('Error in updateProductStatus:', error);
      return { 
        success: false, 
        error: error.message || 'An unexpected error occurred',
        details: error.response ? error.response.data : error
      };
    });
}

/**
 * Updates the product in the backend with the blockchain ID and transaction hash
 * @param {string} productId - The ID of the product in the database
 * @param {string} blockchainId - The blockchain ID of the product
 * @param {string} txHash - The transaction hash of the blockchain update
 * @returns {Promise<Object>} A promise that resolves with the update result
 */
function updateProductWithBlockchain(productId, blockchainId, txHash) {
  console.log('Updating product with blockchain details:', { productId, blockchainId, txHash });
  return $http.put(`${API_URL}/products/${productId}/blockchain`, {
    blockchainId: blockchainId,
    txHash: txHash
  }, getAuthHeaders())
  .then(response => {
    console.log('Product updated with blockchain details:', response.data);
    return response.data;
  })
  .catch(handleError);
}

/**
 * Convert the status string to the corresponding blockchain enum value
 * @param {string} status - The status string
 * @returns {number} The corresponding blockchain enum value
 */
function convertStatusToBlockchain(status) {
  const statusMap = {
    'Registered': 0,
    'Planted': 1,
    'Growing': 2,
    'Harvested': 3,
    'Processed': 4,
    'Packaged': 5,
    'InTransit': 6,
    'Delivered': 7
  };
  return statusMap[status] || 0; // Default to 'Registered' if status is not found
}


/**
     * Fetch the list of distributors for the farmer to select from
     * @returns {Promise} A promise that resolves with the list of distributors
     */
function getDistributors() {
  return $http.get(API_URL + '/distributors', getAuthHeaders())
    .then(response => {
      console.log('Distributors received:', response.data); // Add this line for debugging
      return response.data;
    })
    .catch(error => {
      console.error('Error fetching distributors:', error); // Add this line for debugging
      return $q.reject(error);
    });
}


/**
 * Initiate transfer of product ownership to a distributor
 * @param {Object} transferData - The transfer details
 * @returns {Promise} A promise that resolves with the transfer result
 */
function initiateTransfer(transferData) {
  console.log('FarmerService: Initiating transfer:', transferData);

  return $http.post(`${API_URL}/initiateTransfer`, transferData, getAuthHeaders())
    .then(response => {
      console.log('FarmerService: Backend transfer response:', response.data);
      if (response.data.success) {
        return { 
          success: true, 
          message: response.data.message, 
          transfer: response.data.transfer,
          transactionHash: response.data.transactionHash 
        };
      } else {
        throw new Error(response.data.error || 'Transfer initiation failed on the backend');
      }
    })
    .catch(error => {
      console.error('FarmerService: Error in initiateTransfer:', error);
      return { 
        success: false, 
        error: error.response ? error.response.data.error : error.message || 'An unexpected error occurred'
      };
    });
}

/**
 * Fetch a specific product by its product ID and populate the currentOwner field
 * @param {string} productId - The ID of the product
 * @returns {Promise<Object>} - A promise that resolves with the product details
 */
function getProduct(productId) {
  return $http.get(`${API_URL}/products/${productId}`, getAuthHeaders())
    .then(response => {
      const product = response.data;
      if (!product) {
        throw new Error('Product not found.');
      }
      return product;
    })
    .catch(error => {
      console.error('Error fetching product:', error);
      return $q.reject(error.message || 'Failed to fetch product');
    });
}

/**
 * Update the current user's Ethereum address
 * @param {string} ethereumAddress - The Ethereum address to set
 * @returns {Promise<Object>} - A promise that resolves with the update result
 */
function updateEthereumAddress(ethereumAddress) {
  return $http.put(`${API_URL}/updateEthereumAddress`, { ethereumAddress }, getAuthHeaders())
    .then(response => response.data)
    .catch(handleError);
}



 /**
     * Get transfer details
     * @param {string} transferId - The ID of the transfer
     * @returns {Promise<Object>} A promise that resolves with the transfer details
     */
 function getTransferDetails(transferId) {
  return $http.get(`${API_URL}/transferDetails/${transferId}`, getAuthHeaders())
    .then(response => response.data)
    .catch(error => {
      console.error('Error fetching transfer details:', error);
      return $q.reject(error);
    });
}

/**
 * Cancel a pending transfer
 * @param {string} transferId - The ID of the transfer to cancel
 * @returns {Promise<Object>} A promise that resolves with the cancellation result
 */
function cancelTransfer(transferId) {
  console.log('FarmerService: Initiating cancellation for transfer:', transferId);
  
  return Web3Service.getCurrentAccount()
    .then(currentAccount => {
      if (!currentAccount) {
        throw new Error('No Ethereum account connected');
      }
      return $http.post(`${API_URL}/cancelTransfer/${transferId}`, { initiatorAddress: currentAccount }, getAuthHeaders());
    })
    .then(response => {
      console.log('FarmerService: Transfer cancelled successfully:', response.data);
      return {
        success: true,
        message: 'Transfer cancelled successfully',
        transactionHash: response.data.transactionHash
      };
    })
    .catch(error => {
      console.error('FarmerService: Error cancelling transfer:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to cancel transfer'
      };
    });
}

 /**
     * Generate a QR code for a product
     * @param {Object} product - The product object
     * @returns {Promise<string>} A promise that resolves with the QR code data URL
     */
 function generateQRCode(product) {
  // Create a JSON string with product information
  const productInfo = JSON.stringify({
    id: product._id,
    type: product.type,
    batchNumber: product.batchNumber,
    origin: product.origin,
    productionDate: product.productionDate,
    status: product.status
  });
  
  console.log('Product info for QR code:', productInfo);

  return $q((resolve, reject) => {
    // Using qrcode.js library to generate QR code
    QRCode.toDataURL(productInfo, { 
      width: 200, 
      height: 200,
      color: {
        dark: '#000000',  // QR code color
        light: '#ffffff'  // Background color
      }
    }, (err, url) => {
      if (err) {
        console.error('Error generating QR code:', err);
        reject(err);
      } else {
        console.log('QR code generated successfully');
        resolve(url);
      }
    });
  });
}
  
    // Add the following function to fetch transfer details
    function getTransferDetails(transferId) {
      return $http.get('/api/farmer/transferDetails/' + transferId)
        .then(function(response) {
          return response.data;
        })
        .catch(function(error) {
          console.error('Error fetching transfer details:', error);
          return Promise.reject(error);
        });
    }

    function updateEthereumAddress(address) {
      return $http.put(`${API_URL}/updateEthereumAddress`, { ethereumAddress: address }, getAuthHeaders())
        .then(response => response.data)
        .catch(handleError);
    }

   // Expose service methods
   return {
    registerProduct,
    getProducts,
    getTransactionHistory,
    updateEthereumAddress,
    getProductionInsights,
    syncProductWithBlockchain,
    updateProductStatus,
    updateProductWithBlockchain,
    getDistributors,
    initiateTransfer,
    getPendingTransfers,
    getTransferDetails,
    cancelTransfer,
    generateQRCode: generateQRCode,
    getProduct, // Add getProduct here
    updateEthereumAddress
  };
}]);