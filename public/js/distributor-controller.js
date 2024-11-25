/**
 * Distributor Controller
 * 
 * This controller manages the distributor dashboard functionality in the food traceability platform.
 * It handles product management, blockchain interactions, transfers, and various dashboard views.
 */
angular.module('foodTraceabilityApp')
  .controller('DistributorController', ['$scope', '$location', '$q', '$timeout', '$interval', 'DistributorService', 'Web3Service', '$window',
  function($scope, $location, $q, $timeout, $interval, DistributorService, Web3Service, $window) {

    // Initialize scope variables
    $scope.products = [];
    $scope.pendingTransfers = [];
    $scope.isWalletConnected = false;
    $scope.walletAddress = '';
    $scope.walletBalance = 0;
    $scope.retailers = [];
    $scope.activeTab = 'products';
    $scope.successMessage = '';
    $scope.errorMessage = '';
    $scope.isLoading = false;
    $scope.selectedProduct = null;
    $scope.transferData = {
      productId: null,
      retailerId: null,
      quantity: null
    };
    $scope.updatedInfo = {};
    $scope.notifications = [];
    $scope.isConnecting = false;
    $scope.showQRCode = false;
    $scope.qrCodeUrl = null;
    $scope.isGeneratingQR = false;
    $scope.qrCodeError = null;

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
        case 'retailers':
          $scope.loadRetailers();
          break;
        case 'history':
          $scope.loadTransactionHistory();
          break;
      }
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
     * Load products for the distributor
     */
    $scope.loadProducts = function() {
      $scope.isLoading = true;
      return DistributorService.getProducts()
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
     * Close the product details modal
     */
    $scope.closeProductDetails = function() {
      $scope.showProductModal = false;
      $scope.selectedProduct = null;  // Clear the selected product
    };

    /**
     * Dismiss error message
     */
    $scope.dismissError = function() {
      $scope.errorMessage = '';
    };

    /**
     * Update product status
     * @param {string} productId - The ID of the product to update
     * @param {string} newStatus - The new status to set for the product
     */
    $scope.updateProductStatus = function(productId, newStatus) {
      if (!$scope.isWalletConnected) {
        $scope.errorMessage = 'Please connect your wallet first';
        return;
      }

      $scope.isLoading = true;
      DistributorService.updateProductStatus(productId, newStatus)
        .then(function(result) {
          if (result.success) {
            $scope.successMessage = 'Product status updated successfully';
            $scope.addNotification('Product status updated');
            return $scope.loadProducts();
          } else {
            throw new Error(result.error || 'Failed to update product status');
          }
        })
        .catch(function(error) {
          handleError(error, 'updating product status');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

/**
 * Update product information
 * This function updates product fields such as storage conditions, 
 * transportation details, and estimated delivery date.
 */
$scope.updateProductInfo = function() {
  // Check if a product is selected
  if (!$scope.selectedProduct) {
    $scope.errorMessage = 'No product selected';
    return;
  }
  
  console.log('Updating product:', $scope.selectedProduct);
  
  // Prepare the update data using existing values if new ones aren't provided
  let updateData = {
    storageConditions: $scope.updatedInfo.storageConditions || $scope.selectedProduct.storageConditions,
    transportationMode: $scope.updatedInfo.transportationMode || $scope.selectedProduct.transportationMode,
    transportationDetails: $scope.updatedInfo.transportationDetails || $scope.selectedProduct.transportationDetails,
    estimatedDeliveryDate: $scope.updatedInfo.estimatedDeliveryDate || $scope.selectedProduct.estimatedDeliveryDate
  };

  // Check if any data has actually changed
  let hasChanges = Object.keys(updateData).some(key => 
    updateData[key] !== $scope.selectedProduct[key]
  );

  if (!hasChanges) {
    $scope.errorMessage = 'No changes detected. Please modify at least one field.';
    return;
  }
  
  // Begin the update process by first updating on the blockchain
  $scope.isLoading = true;
  Web3Service.updateProductInfoOnBlockchain($scope.selectedProduct.blockchainId, updateData)
    .then(function(result) {
      console.log('Blockchain update result:', result);
      if (result.success) {
        // If blockchain update is successful, update the backend
        return DistributorService.updateProductInfo($scope.selectedProduct._id, updateData);
      } else {
        throw new Error(result.error || 'Blockchain update failed');
      }
    })
    .then(function(result) {
      console.log('Backend update result:', result);
      if (result.success) {
        $scope.successMessage = 'Product updated successfully: ' + result.message;
        $scope.closeProductDetails();
        return $scope.loadProducts(); // Refresh the product list
      } else {
        throw new Error(result.error || 'Backend update failed');
      }
    })
    .catch(function(error) {
      console.error('Error updating product:', error);
      // Provide more informative error messages
      if (error.message.includes('User denied transaction signature')) {
        $scope.errorMessage = 'Update cancelled: Transaction was rejected by the user.';
      } else if (error.message.includes('gas required exceeds allowance')) {
        $scope.errorMessage = 'Transaction failed: Insufficient gas. Please try again with a higher gas limit.';
      } else if (error.message.includes('nonce too low')) {
        $scope.errorMessage = 'Transaction failed: Nonce too low. Please refresh the page and try again.';
      } else {
        $scope.errorMessage = 'Failed to update product: ' + error.message;
      }
    })
    .finally(function() {
      $scope.isLoading = false;
      $scope.$applyAsync();
    });
};

    /**
     * Load retailers
     */
    $scope.loadRetailers = function() {
      $scope.isLoading = true;
      DistributorService.getRetailers()
        .then(function(retailers) {
          $scope.retailers = retailers;
          console.log('Retailers loaded:', $scope.retailers);
        })
        .catch(function(error) {
          handleError(error, 'loading retailers');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Search retailers
     * @param {string} searchTerm - The term to search for
     */
    $scope.searchRetailers = function(searchTerm) {
      $scope.isLoading = true;
      DistributorService.searchRetailers(searchTerm)
        .then(function(retailers) {
          $scope.retailers = retailers;
          console.log('Retailers search results:', $scope.retailers);
        })
        .catch(function(error) {
          handleError(error, 'searching retailers');
        })
        .finally(function() {
          $scope.isLoading = false;
          $scope.$applyAsync();
        });
    };

    /**
     * Initiate a transfer to a retailer
     */
    $scope.initiateTransferToRetailer = function() {
      if (!$scope.transferData.productId || !$scope.transferData.retailerId || !$scope.transferData.quantity) {
        $scope.errorMessage = 'Please fill in all transfer details';
        return;
      }
    
      $scope.isLoading = true;
      DistributorService.initiateTransferToRetailer($scope.transferData)
        .then(function(result) {
          console.log('Transfer initiation result:', result);
          if (result.success) {
            $scope.successMessage = 'Transfer initiated successfully: ' + result.message;
            $scope.loadProducts();
            $scope.loadPendingTransfers();
            // Add notification for transfer initiation
            $scope.addNotification('Transfer initiated to retailer');
          } else {
            throw new Error(result.error || 'Unknown error occurred');
          }
        })
        .catch(function(error) {
          console.error('Error initiating transfer:', error);
          $scope.errorMessage = 'Failed to initiate transfer: ' + error.message;
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
      DistributorService.getPendingTransfers($scope.walletAddress)
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
     * Accept a transfer from a farmer
     * @param {string} transferId - The ID of the transfer to accept
     */
     $scope.acceptTransfer = function(transferId) {
      if (!$scope.isWalletConnected) {
        $scope.errorMessage = 'Please connect your wallet first';
        return;
      }

      console.log('Accepting transfer:', transferId);

      $scope.isLoading = true;
      DistributorService.acceptTransfer(transferId)
        .then(function(result) {
          console.log('Transfer acceptance result:', result);
          if (result.success) {
            if (result.status === 'completed') {
              $scope.successMessage = result.message;
            } else {
              $scope.successMessage = 'Transfer accepted successfully: ' + result.message;
            }
            $scope.addNotification('Transfer processed');
            return $q.all([
              $scope.loadPendingTransfers(),
              $scope.loadProducts()
            ]);
          } else if (result.status === 'failed') {
            $scope.errorMessage = result.message;
            return $scope.loadPendingTransfers();
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
     * Load transaction history
     */
    $scope.loadTransactionHistory = function() {
      if (!$scope.isWalletConnected) {
        $scope.errorMessage = 'Please connect your wallet to view transaction history';
        return;
      }

      $scope.isLoading = true;
      DistributorService.getTransactionHistory()
        .then(function(history) {
          $scope.transactionHistory = history;
          console.log('Transaction history loaded:', $scope.transactionHistory);
          if ($scope.transactionHistory.length === 0) {
            $scope.noTransactionsMessage = 'No transactions found.';
          } else {
            $scope.noTransactionsMessage = '';
          }
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
     * Sync product with blockchain
     * @param {string} productId - The ID of the product to sync
     */
    $scope.syncProductWithBlockchain = function(productId) {
      if (!$scope.isWalletConnected) {
        $scope.errorMessage = 'Please connect your wallet first';
        return;
      }

      $scope.isLoading = true;
      DistributorService.syncProductWithBlockchain(productId)
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
     * Show product details
     * @param {string} productId - The ID of the product to show details for
     */
$scope.showProductDetails = function(productId) {
  console.log('Showing details for product:', productId);
  $scope.isLoading = true;
  DistributorService.getProductDetails(productId)
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
      console.error('Error fetching product details:', error);
      $scope.errorMessage = 'Failed to fetch product details: ' + error.message;
    })
    .finally(function() {
      $scope.$applyAsync();
    });
};

/**
 * Generate QR code for a product
 * @param {Object} product - The product to generate a QR code for
 */
$scope.generateQRCode = function(product) {
  var qrData = {
    productId: product._id,
    type: product.type,
    batchNumber: product.batchNumber,
    origin: product.origin,
    productionDate: product.productionDate,
    status: product.status,
    quantity: product.quantity,
    farmer: {
      name: product.originalOwner.username,
      location: product.originalOwner.location
    },
    distributor: {
      name: product.currentOwner.username,
      location: product.currentOwner.location
    },
    storageConditions: product.storageConditions,
    transportationMode: product.transportationMode,
    transportationDetails: product.transportationDetails,
    estimatedDeliveryDate: product.estimatedDeliveryDate
  };

  DistributorService.generateQRCode(JSON.stringify(qrData))
    .then(function(url) {
      $scope.qrCodeUrl = url;
      $scope.showQRCode = true;
    })
    .catch(function(error) {
      $scope.qrCodeError = 'Failed to generate QR code: ' + error;
    });
};


/**
 * Opens the real-time tracking page for the selected product
 */
$scope.openRealTimeTracking = function() {
  if (!$scope.selectedProduct) {
    console.error('No product selected for real-time tracking');
    $scope.errorMessage = 'Please select a product before opening real-time tracking.';
    return;
  }

  // Construct the URL with query parameters
  var url = '/public/real-time-tracking.html?id=' + encodeURIComponent($scope.selectedProduct._id);
  
  // Open the tracking page in a new tab
  $window.open(url, '_blank');
  
  console.log('Opening real-time tracking for product:', $scope.selectedProduct._id);
};

/**
 * Shows traceability information for the selected product
 */
$scope.showTraceability = function() {
  if (!$scope.selectedProduct) {
    console.error('Cannot show traceability: No product selected');
    $scope.errorMessage = 'Please select a product to view traceability information';
    return;
  }
  
  // Fetch traceability information
  DistributorService.getProductTraceability($scope.selectedProduct._id)
    .then(function(traceabilityData) {
      $scope.traceabilityInfo = traceabilityData;
      $scope.showTraceabilityModal = true;
    })
    .catch(function(error) {
      console.error('Error fetching traceability information:', error);
      $scope.errorMessage = 'Failed to fetch traceability information: ' + error.message;
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
      let csv = 'Type,Batch Number,Quantity,Price,Production Date,Status\n';
      $scope.products.forEach(product => {
        csv += `${product.type},${product.batchNumber},${product.quantity},${product.price},${product.productionDate},${product.status}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "products.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };

    /**
     * Sort products by a given property
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
      $scope.loadRetailers();
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
          $scope.transactionHistory = [];
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