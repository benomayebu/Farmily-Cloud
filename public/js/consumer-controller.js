/**
 * Consumer Controller
 * 
 * This controller manages the consumer dashboard functionality in the food traceability platform.
 * It handles product viewing, QR code scanning, product authentication, and transfer acceptance.
 */
angular.module('foodTraceabilityApp')
  .controller('ConsumerController', ['$scope', '$timeout', '$interval', '$location', 'ConsumerService', 'Web3Service', 
  function($scope, $timeout, $interval, $location, ConsumerService, Web3Service) {

    // Initialize scope variables
    $scope.myProducts = [];
    $scope.pendingTransfers = [];
    $scope.isWalletConnected = false;
    $scope.walletAddress = '';
    $scope.walletBalance = 0;
    $scope.activeTab = 'my-products';
    $scope.successMessage = '';
    $scope.errorMessage = '';
    $scope.isLoading = false;
    $scope.selectedProduct = null;
    $scope.notifications = [];
    $scope.isConnecting = false;
    $scope.showQRCode = false;
    $scope.qrCodeUrl = null;
    $scope.isGeneratingQR = false;
    $scope.qrCodeError = null;
    $scope.scannedProduct = null;
    $scope.productJourney = null;
    $scope.feedbackData = {
      rating: null,
      comment: ''
    };

    /**
     * Helper function to handle errors
     * @param {Error} error - The error object
     * @param {string} action - The action being performed when the error occurred
     */
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

      // Use $timeout to defer the execution of tab-specific actions
      $timeout(function() {
        switch(tab) {
          case 'my-products':
            $scope.loadMyProducts();
            break;
          case 'transfers':
            $scope.loadPendingTransfers();
            break;
          case 'scan-product':
            // Reset scanned product when switching to scan tab
            $scope.scannedProduct = null;
            break;
          case 'product-history':
            // Clear product journey when switching to history tab
            $scope.productJourney = null;
            break;
        }
      });
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
          // Use $timeout to defer the execution of these functions
          $timeout(function() {
            $scope.loadMyProducts();
            $scope.loadPendingTransfers();
          });
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
     * Load my products
     */
    $scope.loadMyProducts = function() {
      if (!$scope.isWalletConnected) {
        console.log('Wallet not connected. Skipping product load.');
        return;
      }

      $scope.isLoading = true;
      ConsumerService.getMyProducts()
        .then(function(products) {
          $timeout(function() {
            $scope.myProducts = products;
            console.log('My products loaded:', $scope.myProducts);
          });
        })
        .catch(function(error) {
          console.error('Error loading products:', error);
          $scope.errorMessage = 'Failed to load products: ' + error.message;
        })
        .finally(function() {
          $timeout(function() {
            $scope.isLoading = false;
          });
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
      ConsumerService.getPendingTransfers()
        .then(function(transfers) {
          $timeout(function() {
            $scope.pendingTransfers = transfers;
            console.log('Pending transfers loaded:', $scope.pendingTransfers);
          });
        })
        .catch(function(error) {
          console.error('Error loading pending transfers:', error);
          $scope.errorMessage = 'Failed to load pending transfers: ' + error.message;
        })
        .finally(function() {
          $timeout(function() {
            $scope.isLoading = false;
          });
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

      $scope.isLoading = true;
      ConsumerService.acceptTransfer(transferId)
        .then(function(result) {
          $scope.successMessage = 'Transfer accepted successfully';
          $timeout(function() {
            $scope.loadPendingTransfers();
            $scope.loadMyProducts();
          });
        })
        .catch(function(error) {
          console.error('Error accepting transfer:', error);
          $scope.errorMessage = 'Failed to accept transfer: ' + error.message;
        })
        .finally(function() {
          $timeout(function() {
            $scope.isLoading = false;
          });
        });
    };

  /**
   * View product history
   * @param {string} productId - The ID of the product
   */
  $scope.viewProductHistory = function(productId) {
    $scope.isLoading = true;
    ConsumerService.getProductHistory(productId)
      .then(function(history) {
        $scope.productHistory = history;
        $scope.showProductHistoryModal = true;
      })
      .catch(function(error) {
        console.error('Error fetching product history:', error);
        $scope.errorMessage = 'Failed to fetch product history: ' + error.message;
      })
      .finally(function() {
        $scope.isLoading = false;
        $scope.$apply();
      });
  };

    /**
     * Scan QR code to get product details
     */
    $scope.scanQRCode = function() {
      // In a real implementation, this would integrate with a QR code scanner
      // For now, we'll simulate scanning by prompting for a product ID
      var productId = prompt("Enter Product ID (simulating QR code scan):");
      if (productId) {
        $scope.isLoading = true;
        ConsumerService.getProductByQRCode(productId)
          .then(function(product) {
            $scope.scannedProduct = product;
            console.log('Scanned product:', $scope.scannedProduct);
          })
          .catch(function(error) {
            handleError(error, 'scanning product');
          })
          .finally(function() {
            $scope.isLoading = false;
            $scope.$applyAsync();
          });
      }
    };

    /**
     * Verify the authenticity of a product
     * @param {string} productId - The ID of the product to verify
     */
    $scope.verifyProductAuthenticity = function(productId) {
      $scope.isLoading = true;
      ConsumerService.verifyProductAuthenticity(productId)
        .then(function(result) {
          if (result.verified) {
            $scope.successMessage = 'Product authenticity verified successfully';
          } else {
            $scope.errorMessage = 'Product authenticity could not be verified: ' + result.error;
          }
        })
        .catch(function(error) {
          handleError(error, 'verifying product authenticity');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Get the full journey of a product
     * @param {string} productId - The ID of the product
     */
    $scope.getProductJourney = function(productId) {
      $scope.isLoading = true;
      ConsumerService.getProductJourney(productId)
        .then(function(journey) {
          $scope.productJourney = journey;
          console.log('Product journey:', $scope.productJourney);
        })
        .catch(function(error) {
          handleError(error, 'fetching product journey');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Submit feedback for a product
     * @param {string} productId - The ID of the product
     */
    $scope.submitFeedback = function(productId) {
      if (!$scope.feedbackData.rating) {
        $scope.errorMessage = 'Please provide a rating';
        return;
      }

      $scope.isLoading = true;
      ConsumerService.submitFeedback(productId, $scope.feedbackData)
        .then(function(result) {
          if (result.success) {
            $scope.successMessage = 'Feedback submitted successfully';
            $scope.feedbackData = { rating: null, comment: '' }; // Reset feedback form
          } else {
            throw new Error(result.error || 'Failed to submit feedback');
          }
        })
        .catch(function(error) {
          handleError(error, 'submitting feedback');
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
      ConsumerService.getProductByQRCode(productId)
        .then(function(product) {
          $scope.selectedProduct = product;
          console.log('Selected product:', $scope.selectedProduct);
          $scope.showProductModal = true;
          $scope.isLoading = false;
        })
        .catch(function(error) {
          handleError(error, 'fetching product details');
        })
        .finally(function() {
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
        $scope.loadMyProducts();
        $scope.loadPendingTransfers();
      }
    }

    // Initialize dashboard
    function initializeDashboard() {
        if ($scope.isWalletConnected) {
          $scope.loadMyProducts();
          $scope.loadPendingTransfers();
        }
      }
  
      // Call initialize function
      initializeDashboard();
  
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