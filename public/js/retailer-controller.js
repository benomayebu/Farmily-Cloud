/**
 * Retailer Controller
 * 
 * This controller manages the retailer dashboard functionality in the food traceability platform.
 * It handles product management, blockchain interactions, transfers to consumers, and various dashboard views.
 */
angular.module('foodTraceabilityApp')
  .controller('RetailerController', ['$scope', '$location', '$q', '$timeout', '$interval', 'RetailerService', 'Web3Service', '$window',
  function($scope, $location, $q, $timeout, $interval, RetailerService, Web3Service, $window) {

    // Initialize scope variables
    $scope.products = [];
    $scope.pendingTransfers = [];
    $scope.isWalletConnected = false;
    $scope.walletAddress = '';
    $scope.walletBalance = 0;
    $scope.consumers = [];
    $scope.activeTab = 'products';
    $scope.successMessage = '';
    $scope.errorMessage = '';
    $scope.isLoading = false;
    $scope.selectedProduct = null;
    $scope.transferData = {
      productId: null,
      consumerId: null,
      quantity: null
    };
    $scope.updatedInfo = {};
    $scope.notifications = [];
    $scope.isConnecting = false;
    $scope.showQRCode = false;
    $scope.qrCodeUrl = null;
    $scope.isGeneratingQR = false;
    $scope.qrCodeError = null;
    $scope.transactions = [];
    $scope.searchTerm = '';
    $scope.sortProperty = '';
    $scope.sortReverse = false;
    $scope.currentPage = 1;
    $scope.itemsPerPage = 10;
    $scope.totalPages = 1;

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
        case 'products':
          $scope.loadProducts();
          break;
        case 'transfers':
          $scope.loadPendingTransfers();
          break;
        case 'history':
          $scope.loadTransactionHistory();
          break;
        case 'consumers':
          $scope.loadConsumers();
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
            $scope.loadTransactionHistory();
            // Start periodic checks to ensure wallet stays connected
            startWalletConnectionCheck();
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
       * Start periodic checks for wallet connection
       */
      function startWalletConnectionCheck() {
        $interval(checkWalletConnection, 5000); // Check every 5 seconds
      }
  
      /**
       * Check wallet connection status
       */
      function checkWalletConnection() {
        if ($scope.isWalletConnected) {
          Web3Service.isWalletConnected()
            .then(function(isConnected) {
              if (!isConnected) {
                // If wallet is disconnected, try to reconnect
                return Web3Service.connectWallet();
              }
            })
            .then(function(address) {
              if (address) {
                $scope.walletAddress = address;
                $scope.isWalletConnected = true;
                $scope.refreshWalletBalance();
              }
            })
            .catch(function(error) {
              console.error('Error checking wallet connection:', error);
              $scope.isWalletConnected = false;
              $scope.$applyAsync();
            });
        }
      }

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
     * Load products for the retailer
     */
    $scope.loadProducts = function() {
      $scope.isLoading = true;
      return RetailerService.getProducts()
        .then(function(products) {
          $scope.products = products;
          console.log('Products loaded:', $scope.products);
          $scope.totalPages = Math.ceil($scope.products.length / $scope.itemsPerPage);
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
     * Load pending transfers
     */
    $scope.loadPendingTransfers = function() {
      if (!$scope.isWalletConnected) {
        console.log('Wallet not connected. Skipping pending transfers load.');
        return;
      }

      $scope.isLoading = true;
      RetailerService.getPendingTransfers($scope.walletAddress)
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
     * Accept a transfer from a distributor
     * @param {string} transferId - The ID of the transfer to accept
     */
    $scope.acceptTransfer = function(transferId) {
      if (!$scope.isWalletConnected) {
        $scope.errorMessage = 'Please connect your wallet first';
        return;
      }

      console.log('Accepting transfer:', transferId);

      $scope.isLoading = true;
      RetailerService.acceptTransfer(transferId)
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
 * Update product information
 */
$scope.updateProductInfo = function() {
  if (!$scope.selectedProduct) {
    $scope.errorMessage = 'No product selected';
    return;
  }
  
  console.log('Updating product:', $scope.selectedProduct._id, $scope.updatedInfo);
  
  $scope.isLoading = true;
  RetailerService.updateProductInfo($scope.selectedProduct._id, $scope.updatedInfo)
    .then(function(result) {
      if (result.success) {
        $scope.successMessage = 'Product updated successfully: ' + result.message;
        $scope.selectedProduct = result.product; // Update the selected product with new details
        $scope.closeUpdateProductForm();
        return $scope.loadProducts();
      } else {
        throw new Error(result.error || 'Update failed');
      }
    })
    .catch(function(error) {
      console.error('Error updating product:', error);
      $scope.errorMessage = 'Failed to update product: ' + (error.message || 'An unexpected error occurred');
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
     * Show update product form
     */
   $scope.showUpdateProductForm = function() {
    $scope.updatedInfo = {
      retailPrice: $scope.selectedProduct.retailPrice,
      shelfLife: $scope.selectedProduct.shelfLife,
      storageConditions: $scope.selectedProduct.storageConditions,
      displayLocation: $scope.selectedProduct.displayLocation,
      retailerNotes: $scope.selectedProduct.retailerNotes
    };
    $scope.showUpdateProductForm = true;
  };

  /**
   * Close update product form
   */
  $scope.closeUpdateProductForm = function() {
    $scope.showUpdateProductForm = false;
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
     * Initiate a transfer to a consumer
     */
    // Add this function to handle dismissing error messages

$scope.initiateTransferToConsumer = function() {
  if (!$scope.transferData.productId || !$scope.transferData.consumerId || !$scope.transferData.quantity) {
    $scope.errorMessage = 'Please fill in all transfer details';
    return;
  }

  $scope.isLoading = true;
  RetailerService.initiateTransferToConsumer($scope.transferData)
    .then(function(result) {
      if (result.success) {
        $scope.successMessage = 'Transfer initiated successfully: ' + result.message;
        $scope.errorMessage = ''; // Clear any previous error messages
        $scope.loadProducts();
        $scope.addNotification('Transfer initiated to consumer');
      } else {
        $scope.errorMessage = 'Failed to initiate transfer: ' + result.error;
        $scope.successMessage = ''; // Clear any previous success messages
      }
    })
    .catch(function(error) {
      console.error('Error initiating transfer:', error);
      $scope.errorMessage = 'An unexpected error occurred while initiating transfer';
      $scope.successMessage = ''; // Clear any previous success messages
    })
    .finally(function() {
      $scope.isLoading = false;
      $scope.$applyAsync();
    });
};
    /**
     * Load transaction history
     */
    $scope.loadTransactionHistory = function() {
      if (!$scope.isWalletConnected) {
        $scope.errorMessage = 'Please connect your wallet to view transaction history';
        return;
      }

      $scope.isLoading = true;
      RetailerService.getTransactionHistory()
        .then(function(history) {
          $scope.transactions = history;
          console.log('Transaction history loaded:', $scope.transactions);
        })
        .catch(function(error) {
          handleError(error, 'loading transaction history');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Load consumers
     */
    $scope.loadConsumers = function() {
      $scope.isLoading = true;
      RetailerService.getConsumers()
        .then(function(consumers) {
          $scope.consumers = consumers;
          console.log('Consumers loaded:', $scope.consumers);
        })
        .catch(function(error) {
          handleError(error, 'loading consumers');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
 * Sync product with blockchain
 * @param {string} productId - The ID of the product to sync
 */
$scope.syncProductWithBlockchain = function(productId) {
  if (!$scope.isWalletConnected) {
    $scope.errorMessage = 'Please connect your wallet first';
    return;
  }

  $scope.isLoading = true;
  RetailerService.syncProductWithBlockchain(productId)
    .then(function(result) {
      if (result.success) {
        $scope.successMessage = 'Product synced with blockchain successfully';
        $scope.addNotification('Product synced with blockchain');
        return $scope.loadProducts();
      } else {
        throw new Error(result.error);
      }
    })
    .catch(function(error) {
      console.error('Error syncing product with blockchain:', error);
      $scope.errorMessage = 'Failed to sync product with blockchain: ' + (error.message || 'An unexpected error occurred');
    })
    .finally(function() {
      $scope.isLoading = false;
      $scope.$applyAsync();
    });
};

    /**
     * Generate QR code for a product
     * @param {Object} product - The product to generate a QR code for
     */
    $scope.generateQRCode = function(product) {
      RetailerService.generateQRCode(product)
        .then(function(url) {
          $scope.qrCodeUrl = url;
          $scope.showQRCode = true;
        })
        .catch(function(error) {
          $scope.qrCodeError = 'Failed to generate QR code: ' + error;
        })
        .finally(function() {
          $scope.$applyAsync();
        });
    };

    /**
     * Toggle QR Code display
     */
    $scope.toggleQRCode = function() {
      console.log('Toggle QR Code clicked');
      if (!$scope.showQRCode) {
        console.log('Attempting to generate QR code');
        $scope.generateQRCode($scope.selectedProduct);
      } else {
        console.log('Hiding QR code');
        $scope.showQRCode = false;
      }
    };

    /**
     * Open real-time tracking page for a product
     */
    $scope.openRealTimeTracking = function() {
      if (!$scope.selectedProduct) {
        console.error('No product selected for real-time tracking');
        $scope.errorMessage = 'Please select a product before opening real-time tracking.';
        return;
      }

      var url = '/public/real-time-tracking.html?id=' + encodeURIComponent($scope.selectedProduct._id);
      $window.open(url, '_blank');
      console.log('Opening real-time tracking for product:', $scope.selectedProduct._id);
    };

    /**
     * Show traceability information for the selected product
     */
    $scope.showTraceability = function() {
      if (!$scope.selectedProduct) {
        console.error('Cannot show traceability: No product selected');
        $scope.errorMessage = 'Please select a product to view traceability information';
        return;
      }
      
      RetailerService.getProductTraceability($scope.selectedProduct._id)
        .then(function(traceabilityData) {
          $scope.traceabilityInfo = traceabilityData;
          $scope.showTraceabilityModal = true;
        })
        .catch(function(error) {
          handleError(error, 'fetching traceability information');
        });
    };

    /**
     * Close the traceability modal
     */
    $scope.closeTraceabilityModal = function() {
      $scope.showTraceabilityModal = false;
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
     * Export products to CSV
     */
    $scope.exportToCSV = function() {
      let csv = 'Type,Batch Number,Quantity,Price,Production Date,Status,Shelf Life\n';
      $scope.products.forEach(product => {
        csv += `${product.type},${product.batchNumber},${product.quantity},${product.price},${product.productionDate},${product.status},${product.shelfLife}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "retailer_products.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };

    /**
     * Sort products by a given property
     * @param {string} property - The property to sort by
     */
    $scope.sortProducts = function(property) {
      $scope.sortProperty = property;
      $scope.sortReverse = !$scope.sortReverse;
      $scope.products.sort((a, b) => {
        if (a[property] < b[property]) return $scope.sortReverse ? 1 : -1;
        if (a[property] > b[property]) return $scope.sortReverse ? -1 : 1;
        return 0;
      });
    };

    /**
     * Filter products based on search term
     * @param {string} searchTerm - The term to search for
     */
    $scope.filterProducts = function(searchTerm) {
      if (!searchTerm) {
        $scope.loadProducts();
        return;
      }
      $scope.products = $scope.products.filter(product => 
        product.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    };

    /**
     * Change page for pagination
     * @param {number} newPage - The new page number
     */
    $scope.changePage = function(newPage) {
      if (newPage >= 1 && newPage <= $scope.totalPages) {
        $scope.currentPage = newPage;
        $scope.loadProducts();
      }
    };

    /**
     * Record consumer feedback
     * @param {string} productId - The ID of the product
     * @param {Object} feedback - The feedback object
     */
    $scope.recordConsumerFeedback = function(productId, feedback) {
      RetailerService.recordConsumerFeedback(productId, feedback)
        .then(function(result) {
          if (result.success) {
            $scope.successMessage = 'Feedback recorded successfully';
            $scope.addNotification('New consumer feedback recorded');
          } else {
            throw new Error(result.error || 'Failed to record feedback');
          }
        })
        .catch(function(error) {
          handleError(error, 'recording feedback');
        });
    };

    /**
     * Update Ethereum address
     */
    $scope.updateEthereumAddress = function() {
      if (!$scope.newEthereumAddress) {
        $scope.errorMessage = 'Please enter a valid Ethereum address';
        return;
      }

      RetailerService.updateEthereumAddress($scope.newEthereumAddress)
        .then(function(response) {
          $scope.successMessage = 'Ethereum address updated successfully';
          $scope.errorMessage = '';
          $scope.newEthereumAddress = '';
          // Optionally, update the user's information in the scope
          $scope.user.ethereumAddress = response.user.ethereumAddress;
        })
        .catch(function(error) {
          handleError(error, 'updating Ethereum address');
        });
    };

    /**
     * Show product details
     * @param {string} productId - The ID of the product to show details for
     */
    $scope.showProductDetails = function(productId) {
      console.log('Showing details for product:', productId);
      $scope.isLoading = true;
      RetailerService.getProductDetails(productId)
        .then(function(product) {
          $scope.selectedProduct = product;
          // Convert date strings to Date objects
          $scope.selectedProduct.productionDate = new Date($scope.selectedProduct.productionDate);
          $scope.selectedProduct.estimatedDeliveryDate = new Date($scope.selectedProduct.estimatedDeliveryDate);
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
     * Sync product with blockchain
     * @param {string} productId - The ID of the product to sync
     */
    $scope.syncProductWithBlockchain = function(productId) {
      if (!$scope.isWalletConnected) {
        $scope.errorMessage = 'Please connect your wallet first';
        return;
      }

      $scope.isLoading = true;
      RetailerService.syncProductWithBlockchain(productId)
        .then(function(response) {
          $scope.successMessage = 'Product synced with blockchain successfully';
          $scope.addNotification('Product synced with blockchain');
          $scope.loadProducts();
        })
        .catch(function(error) {
          handleError(error, 'syncing product with blockchain');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Initialize dashboard
     */
    function initializeDashboard() {
      $scope.loadProducts()
        .then(function() {
          // Format dates after products are loaded
          $scope.products.forEach(function(product) {
            if (product.estimatedDeliveryDate) {
              product.formattedEstimatedDeliveryDate = $scope.formatDate(product.estimatedDeliveryDate);
            }
          });
        });
      $scope.loadConsumers();
      if ($scope.isWalletConnected) {
        $scope.loadPendingTransfers();
        $scope.loadTransactionHistory();
      }
    }

    // Call initialize function
    initializeDashboard();

    // Watch for changes in wallet connection status
    $scope.$watch('isWalletConnected', function(newValue, oldValue) {
      if (newValue !== oldValue) {
        if (newValue) {
          $scope.refreshWalletBalance();
          $scope.loadPendingTransfers();
          $scope.loadTransactionHistory();
        } else {
          $scope.walletBalance = 0;
          $scope.pendingTransfers = [];
          $scope.transactions = [];
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