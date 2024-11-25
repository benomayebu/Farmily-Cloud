/**
 * Consumer Service
 * 
 * This service provides functions for consumers to interact with the food traceability platform.
 * It handles operations such as viewing owned products, scanning QR codes, verifying product authenticity,
 * and interacting with the blockchain through the Web3Service.
 */

angular.module('foodTraceabilityApp')
  .factory('ConsumerService', ['$http', 'Web3Service', '$q', function($http, Web3Service, $q) {
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
     * @returns {Promise} A promise that resolves with the list of products
     */
    function getMyProducts() {
        console.log('Fetching products for consumer');
        return $http.get(API_URL + '/myProducts', getAuthHeaders())
          .then(response => {
            console.log('Products fetched successfully:', response.data);
            return response.data;
          })
          .catch(handleError);
      }

    /**
     * Fetch product details by scanning a QR code
     * @param {string} qrCodeData - The data obtained from scanning the QR code
     * @returns {Promise} A promise that resolves with the product details
     */
    function getProductByQRCode(qrCodeData) {
      console.log('Fetching product details from QR code');
      return $http.post(API_URL + '/scanProduct', { qrCodeData }, getAuthHeaders())
        .then(response => {
          console.log('Product details fetched successfully:', response.data);
          return response.data;
        })
        .catch(handleError);
    }

    /**
     * Verify the authenticity of a product using blockchain data
     * @param {string} productId - The ID of the product to verify
     * @returns {Promise} A promise that resolves with the verification result
     */
    function verifyProductAuthenticity(productId) {
        console.log(`Verifying authenticity for product: ${productId}`);
        return Web3Service.verifyProductOnBlockchain(productId)
          .then(result => {
            console.log('Product verification result:', result);
            return result;
          })
          .catch(error => {
            console.error('Error verifying product:', error);
            return { verified: false, error: error.message };
          });
      }
  

   /**
     * Fetch the full journey of a product
     * @param {string} productId - The ID of the product
     * @returns {Promise} A promise that resolves with the product journey
     */
   function getProductJourney(productId) {
    console.log(`Fetching journey for product: ${productId}`);
    return $http.get(`${API_URL}/productJourney/${productId}`, getAuthHeaders())
      .then(response => {
        console.log('Product journey fetched:', response.data);
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
    console.log('Accepting transfer:', transferId);
    return $http.post(`${API_URL}/acceptTransfer/${transferId}`, {}, getAuthHeaders())
      .then(response => {
        console.log('Transfer accepted:', response.data);
        return response.data;
      })
      .catch(handleError);
  }

   /**
     * Get pending transfers for the consumer
     * @returns {Promise<Array>} A promise that resolves with the list of pending transfers
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
   * Get product history
   * @param {string} productId - The ID of the product
   * @returns {Promise<Array>} A promise that resolves with the product history
   */
  function getProductHistory(productId) {
    console.log('Fetching product history for:', productId);
    return $http.get(API_URL + '/productHistory/' + productId, getAuthHeaders())
      .then(response => {
        console.log('Product history fetched:', response.data);
        return response.data;
      })
      .catch(handleError);
  }
    /**
     * Submit feedback for a product
     * @param {string} productId - The ID of the product
     * @param {Object} feedback - The feedback object containing rating and comments
     * @returns {Promise} A promise that resolves with the feedback submission result
     */
    function submitFeedback(productId, feedback) {
      console.log(`Submitting feedback for product: ${productId}`, feedback);
      return $http.post(`${API_URL}/submitFeedback/${productId}`, feedback, getAuthHeaders())
        .then(response => {
          console.log('Feedback submitted:', response.data);
          return {
            success: true,
            message: response.data.message,
            feedback: response.data.feedback
          };
        })
        .catch(error => {
          console.error('Error submitting feedback:', error);
          return {
            success: false,
            error: error.data?.message || error.message || 'An error occurred while submitting feedback'
          };
        });
    }

    // Expose service methods
    return {
      getMyProducts,
      getProductByQRCode,
      verifyProductAuthenticity,
      getProductJourney,
      acceptTransfer,
      getPendingTransfers,
      getProductHistory,
      submitFeedback
    };
  }]);