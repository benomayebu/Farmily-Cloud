/**
 * Consumer Controller
 * 
 * This controller manages the consumer dashboard functionality in the food traceability platform.
 * It handles product viewing, transfer acceptance, QR code scanning, and real-time tracking.
 */
angular.module('foodTraceabilityApp')
  .controller('ConsumerController', ['$scope', '$location', '$q', '$timeout', '$interval', 'ConsumerService', 'Web3Service', '$window',
  function($scope, $location, $q, $timeout, $interval, ConsumerService, Web3Service, $window) {

    // Initialize scope variables
    $scope.products = [];
    $scope.pendingTransfers = [];
    $scope.isWalletConnected = false;
    $scope.walletAddress = '';
    $scope.walletBalance = 0;
    $scope.activeTab = 'my-products';
    $scope.successMessage = '';
    $scope.errorMessage = '';
    $scope.isLoading = false;
    $scope.selectedProduct = null;
    $scope.scannedProduct = null;
    $scope.productHistory = [];
    $scope.notifications = [];
    $scope.manualProductId = '';
    $scope.feedback = {
      rating: 0,
      comment: ''
    };

    // Helper function to handle errors
    function handleError(error, action) {
      console.error(`Error ${action}:`, error);
      $scope.errorMessage = `Error ${action}: ${error.message || 'An unexpected error occurred'}`;
      $scope.$applyAsync();
    }

    /**
     * Set active tab and load relevant data
     * @param {string} tab - The tab to activate
     */
    $scope.setActiveTab = function(tab) {
      $scope.activeTab = tab;
      $location.path('/' + tab);

      switch(tab) {
        case 'my-products':
          $scope.loadProducts();
          break;
        case 'transfers':
          $scope.loadPendingTransfers();
          break;
        case 'scan-product':
          // Prepare for QR code scanning
          break;
        case 'product-history':
          $scope.loadProductHistory();
          break;
      }
    };

    /**
     * Connect to Ethereum wallet
     */
    $scope.connectWallet = function() {
      if ($scope.isWalletConnected || $scope.isConnecting) {
        console.log('Wallet already connected or connection in progress');
        return;
      }

      $scope.isConnecting = true;
      Web3Service.connectWallet()
        .then(function(address) {
          $scope.walletAddress = address;
          $scope.isWalletConnected = true;
          $scope.successMessage = 'Wallet connected successfully';
          return Web3Service.getBalance(address);
        })
        .then(function(balance) {
          $scope.walletBalance = balance;
          $scope.loadProducts();
          $scope.loadPendingTransfers();
        })
        .catch(function(error) {
          handleError(error, 'connecting wallet');
        })
        .finally(function() {
          $scope.isConnecting = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Disconnect from Ethereum wallet
     */
    $scope.disconnectWallet = function() {
      Web3Service.disconnectWallet();
      $scope.isWalletConnected = false;
      $scope.walletAddress = '';
      $scope.walletBalance = 0;
      $scope.successMessage = 'Wallet disconnected successfully';
      $scope.$applyAsync();
    };

    /**
     * Dismiss error message
     */
    $scope.dismissError = function() {
      $scope.errorMessage = '';
    };

    /**
     * Dismiss success message
     */
    $scope.dismissSuccess = function() {
      $scope.successMessage = '';
    };

    /**
     * Load products owned by the consumer
     */
    $scope.loadProducts = function() {
      $scope.isLoading = true;
      return ConsumerService.getProducts()
        .then(function(products) {
          $scope.products = products;
          console.log('Products loaded:', $scope.products);
        })
        .catch(function(error) {
          handleError(error, 'loading products');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Show product details
     * @param {string} productId - The ID of the product to show details for
     */
    $scope.showProductDetails = function(productId) {
      console.log('Showing details for product:', productId);
      $scope.isLoading = true;
      ConsumerService.getProductDetails(productId)
        .then(function(productDetails) {
          $scope.selectedProduct = productDetails;
          console.log('Selected product:', $scope.selectedProduct);
          $scope.showProductModal = true;
        })
        .catch(function(error) {
          handleError(error, 'fetching product details');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Close the product details modal
     */
    $scope.closeProductDetails = function() {
      $scope.showProductModal = false;
      $scope.selectedProduct = null;
    };

/**
 * Get product info manually by ID
 */
$scope.getProductInfoManually = function() {
  if (!$scope.manualProductId) {
    $scope.errorMessage = 'Please enter a valid Product ID';
    return;
  }
  $scope.isLoading = true;
  ConsumerService.getProductWithFullInfo($scope.manualProductId)
    .then(function(productDetails) {
      $scope.selectedProduct = productDetails;
      $scope.showProductModal = true;
      console.log('Product details fetched manually:', productDetails);
    })
    .catch(function(error) {
      console.error('Error fetching product details:', error);
      $scope.errorMessage = 'Failed to fetch product details: ' + (error.message || error);
    })
    .finally(function() {
      $scope.isLoading = false;
      $scope.$applyAsync();
    });
};

/**
 * Open real-time tracking for a product
 */
$scope.openRealTimeTracking = function() {
  if (!$scope.selectedProduct || !$scope.selectedProduct.product) {
    console.error('Invalid product or product ID');
    $scope.errorMessage = 'Unable to open real-time tracking: Invalid product';
    return;
  }

  console.log('Selected product for tracking:', $scope.selectedProduct);

  // Construct the URL with all product details as query parameters
  var url = '/public/consumer-real-time-tracking.html?' + 
    'id=' + encodeURIComponent($scope.selectedProduct.product._id) +
    '&type=' + encodeURIComponent($scope.selectedProduct.product.type) +
    '&origin=' + encodeURIComponent($scope.selectedProduct.product.origin) +
    '&productionDate=' + encodeURIComponent($scope.selectedProduct.product.productionDate) +
    '&batchNumber=' + encodeURIComponent($scope.selectedProduct.product.batchNumber) +
    '&status=' + encodeURIComponent($scope.selectedProduct.product.status) +
    '&quantity=' + encodeURIComponent($scope.selectedProduct.product.quantity) +
    '&price=' + encodeURIComponent($scope.selectedProduct.product.price) +
    '&blockchainId=' + encodeURIComponent($scope.selectedProduct.product.blockchainId) +
    '&blockchainStatus=' + encodeURIComponent($scope.selectedProduct.blockchainStatus) +
    '&storageConditions=' + encodeURIComponent($scope.selectedProduct.product.storageConditions) +
    '&transportationMode=' + encodeURIComponent($scope.selectedProduct.product.transportationMode) +
    '&transportationDetails=' + encodeURIComponent($scope.selectedProduct.product.transportationDetails) +
    '&estimatedDeliveryDate=' + encodeURIComponent($scope.selectedProduct.product.estimatedDeliveryDate) +
    '&certifications=' + encodeURIComponent(JSON.stringify($scope.selectedProduct.product.certifications)) +
    '&farmerUsername=' + encodeURIComponent($scope.selectedProduct.farmer ? $scope.selectedProduct.farmer.username : 'N/A') +
    '&distributorUsername=' + encodeURIComponent($scope.selectedProduct.distributor ? $scope.selectedProduct.distributor.username : 'N/A') +
    '&retailerUsername=' + encodeURIComponent($scope.selectedProduct.currentOwner ? $scope.selectedProduct.currentOwner.username : 'N/A') +
    '&consumerUsername=' + encodeURIComponent($scope.selectedProduct.consumer ? $scope.selectedProduct.consumer.username : 'N/A');

  console.log('Opening URL:', url);
  
  // Open the tracking page in a new tab
  $window.open(url, '_blank');
};
    /**
     * Scan QR code for product information
     * This function would typically be called when a QR code is successfully scanned
     * @param {string} qrData - The data from the scanned QR code
     */
    $scope.scanQRCode = function(qrData) {
      ConsumerService.getProductFromQR(qrData)
        .then(function(product) {
          $scope.scannedProduct = product;
          $scope.showScannedProductModal = true;
        })
        .catch(function(error) {
          handleError(error, 'scanning QR code');
        });
    };

    /**
     * Generate QR code for a product
     */
    $scope.generateQRCode = function() {
      if (!$scope.selectedProduct || !$scope.selectedProduct.product) {
        $scope.errorMessage = 'No product selected for QR code generation';
        return;
      }

      $scope.isGeneratingQR = true;
      ConsumerService.generateQRCode($scope.selectedProduct.product)
        .then(function(qrCodeUrl) {
          $scope.qrCodeUrl = qrCodeUrl;
          $scope.showQRCode = true;
        })
        .catch(function(error) {
          $scope.errorMessage = 'Failed to generate QR code: ' + error;
        })
        .finally(function() {
          $scope.isGeneratingQR = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Handle QR code scan
     * @param {string} qrData - The data from the scanned QR code
     */
    $scope.handleQRScan = function(qrData) {
      $scope.isLoading = true;
      ConsumerService.getProductFromQR(qrData)
        .then(function(product) {
          $scope.scannedProduct = product;
          $scope.showScannedProductModal = true;
        })
        .catch(function(error) {
          handleError(error, 'scanning QR code');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Close the modal for a scanned product
     * Resets the selected scanned product to null
     */
    $scope.closeScannedProductModal = function() {
      $scope.showScannedProductModal = false;
      $scope.scannedProduct = null;
    };

    /**
     * Submit feedback for a product
     */
    $scope.submitFeedback = function() {
      if (!$scope.selectedProduct || !$scope.selectedProduct.product || !$scope.selectedProduct.product._id) {
        $scope.errorMessage = 'No product selected for feedback';
        return;
      }
      if ($scope.feedback.rating === 0) {
        $scope.errorMessage = 'Please select a rating';
        return;
      }
      
      $scope.isLoading = true;
      ConsumerService.submitFeedback($scope.selectedProduct.product._id, $scope.feedback)
        .then(function(response) {
          $scope.successMessage = 'Feedback submitted successfully';
          $scope.feedback = { rating: 0, comment: '' }; // Reset feedback
          $scope.closeProductDetails(); // Close the modal after submitting feedback
        })
        .catch(function(error) {
          $scope.errorMessage = 'Failed to submit feedback: ' + error;
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Load pending transfers for the consumer
     */
    $scope.loadPendingTransfers = function() {
      if (!$scope.isWalletConnected) {
        console.log('Wallet not connected. Skipping pending transfers load.');
        return;
      }

      $scope.isLoading = true;
      ConsumerService.getPendingTransfers($scope.walletAddress)
        .then(function(transfers) {
          $scope.pendingTransfers = transfers;
          console.log('Pending transfers loaded:', $scope.pendingTransfers);
        })
        .catch(function(error) {
          handleError(error, 'loading pending transfers');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Accept a transfer from a retailer
     * @param {string} transferId - The ID of the transfer to accept
     */
    $scope.acceptTransfer = function(transferId) {
      if (!$scope.isWalletConnected) {
        $scope.errorMessage = 'Please connect your wallet first';
        return;
      }

      console.log('Accepting transfer:', transferId);

      $scope.isLoading = true;
      ConsumerService.acceptTransfer(transferId)
        .then(function(result) {
          console.log('Transfer acceptance result:', result);
          if (result.success) {
            $scope.successMessage = 'Transfer accepted successfully: ' + result.message;
            $scope.addNotification('Transfer processed');
            return $q.all([
              $scope.loadPendingTransfers(),
              $scope.loadProducts()
            ]);
          } else {
            throw new Error(result.error || 'Unknown error occurred');
          }
        })
        .then(function() {
          console.log('Transfers and products reloaded after processing');
        })
        .catch(function(error) {
          console.error('Error processing transfer:', error);
          $scope.errorMessage = 'Failed to process transfer: ' + error.message;
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Load product history
     */
    $scope.loadProductHistory = function() {
      if (!$scope.selectedProduct) {
        $scope.errorMessage = 'Please select a product to view its history';
        return;
      }

      $scope.isLoading = true;
      ConsumerService.getProductHistory($scope.selectedProduct.product._id)
        .then(function(history) {
          $scope.productHistory = history;
          console.log('Product history loaded:', $scope.productHistory);
        })
        .catch(function(error) {
          handleError(error, 'loading product history');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Add a notification
     * @param {string} message - The notification message
     */
    $scope.addNotification = function(message) {
      $scope.notifications.push({ message: message, timestamp: new Date() });
    };

    /**
     * Dismiss a notification
     * @param {number} index - The index of the notification to dismiss
     */
    $scope.dismissNotification = function(index) {
      $scope.notifications.splice(index, 1);
    };

    /**
     * Refresh wallet balance
     */
    $scope.refreshWalletBalance = function() {
      if ($scope.isWalletConnected) {
        Web3Service.getBalance($scope.walletAddress)
          .then(function(balance) {
            $scope.walletBalance = balance;
          })
          .catch(function(error) {
            console.error('Error refreshing wallet balance:', error);
          });
      }
    };

    /**
     * Format date for display
     * @param {string} dateString - The date string to format
     * @returns {string} The formatted date string
     */
    $scope.formatDate = function(dateString) {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleString();
    };

    /**
     * Initialize dashboard
     */
    function initializeDashboard() {
      if ($scope.isWalletConnected) {
        $scope.loadProducts();
        $scope.loadPendingTransfers();
      }
    }

    // Call initialize function
    initializeDashboard();

    // Watch for changes in wallet connection status
    $scope.$watch('isWalletConnected', function(newValue, oldValue) {
      if (newValue !== oldValue) {
        if (newValue) {
          $scope.refreshWalletBalance();
          $scope.loadProducts();
          $scope.loadPendingTransfers();
        } else {
          $scope.walletBalance = 0;
          $scope.products = [];
          $scope.pendingTransfers = [];
        }
      }
    });

    // Set up an interval to check for new transfers
    var transferCheckInterval = $interval(function() {
      if ($scope.isWalletConnected) {
        $scope.loadPendingTransfers();
      }
    }, 30000); // Check every 30 seconds

    // Cleanup on scope destruction
    $scope.$on('$destroy', function() {
      if (angular.isDefined(transferCheckInterval)) {
        $interval.cancel(transferCheckInterval);
      }
    });
  }]);