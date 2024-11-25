/**
 * Farmer Controller
 * 
 * This controller manages the farmer dashboard functionality in the food traceability platform.
 * It handles product management, blockchain interactions, transfers, and various dashboard views.
 */
angular.module('foodTraceabilityApp')
  .controller('FarmerController', ['$scope', '$location', '$q', '$timeout', '$interval', 'FarmerService', 'Web3Service', '$window', '$filter',
  function($scope, $location, $q, $timeout, $interval, FarmerService, Web3Service, $window, $filter) {
    // Utility function to apply scope changes using $timeout, ensuring proper digest cycle
    function applyScope(fn) {
      $timeout(fn, 0);
    }

    // Declare stopTime to track the interval for transfer updates
    let stopTime;

    // Initialize scope variables
    $scope.products = [];
    $scope.newProduct = {};
    $scope.isRegistering = false;
    $scope.selectedProductId = null;
    $scope.newStatus = null;
    $scope.statusOptions = ['Planted', 'Growing', 'Harvested', 'Processed', 'Packaged', 'In Transit', 'Delivered'];
    $scope.successMessage = '';
    $scope.errorMessage = '';
    $scope.isLoading = false;
    $scope.isUpdating = false;
    $scope.isWalletConnected = false;
    $scope.walletAddress = '';
    $scope.walletBalance = 0;
    $scope.distributors = [];
    $scope.transferData = {
      productId: null,
      newOwnerUsername: null,
      quantity: null
    };
    $scope.pendingTransfers = [];
    $scope.showSyncOption = false;
    $scope.productToSync = null;
    $scope.isTransferring = false;
    $scope.selectedTransferProductId = null; // Product to transfer
    $scope.newOwnerUsername = null; // New owner's username
    $scope.transferQuantity = null; // Quantity to transfer
    $scope.products = [];

    // Added for tab management
    $scope.activeTab = 'products';
    $scope.activeProductTab = 'register';

    // Set active tab and update URL
    $scope.setActiveTab = function(tab) {
      $scope.activeTab = tab;
      $location.path('/' + tab);
    };

    // Set active product tab
    $scope.setActiveProductTab = function(tab) {
      $scope.activeProductTab = tab;
    };

    // Listen for route changes to update the active tab
    $scope.$on('$routeChangeSuccess', function() {
      var path = $location.path();
      $scope.activeTab = path.substring(1) || 'products';
    });

    /**
     * Handle errors in the controller
     * @param {Error} error - The error object
     */
    function handleError(error) {
      console.error('Error:', error);
      $scope.$apply(function() {
        $scope.errorMessage = error.message || 'An unexpected error occurred';
      });
    }

 /**
     * Format date for display in the input field
     * @param {Date|string} date - The date to format
     * @returns {string} Formatted date string
     */
 $scope.formatDate = function(date) {
  if (date) {
    return $filter('date')(new Date(date), 'yyyy-MM-dd');
  }
  return '';
};

/**
 * Parse date from the input field
 * @param {string} dateString - The date string to parse
 * @returns {Date|null} Parsed Date object or null if invalid
 */
$scope.parseDate = function(dateString) {
  if (dateString) {
    return new Date(dateString);
  }
  return null;
};

// Add a watch to format the date for display
$scope.$watch('newProduct.productionDate', function(newValue) {
  if (newValue && newValue instanceof Date) {
    // Format the date as 'yyyy-MM-dd' for the input field
    $scope.formattedProductionDate = $filter('date')(newValue, 'yyyy-MM-dd');
  }
});
/**
/**
     * Register a new product on the blockchain and in the backend
     */
$scope.registerProduct = function() {
  if (!validateNewProductForm()) {
    $scope.errorMessage = 'Please fill in all the required product fields correctly.';
    return;
  }

  $scope.isRegistering = true;
  $scope.errorMessage = '';
  $scope.successMessage = '';

  // Ensure certifications is an array
  if (typeof $scope.newProduct.certifications === 'string') {
    $scope.newProduct.certifications = [$scope.newProduct.certifications];
  }

  // Create a copy of the product data for registration
  var productToRegister = angular.copy($scope.newProduct);

  // Convert the formatted date back to ISO string for backend
  if (productToRegister.productionDate) {
    productToRegister.productionDate = new Date(productToRegister.productionDate).toISOString();
  }

  FarmerService.registerProduct(productToRegister)
    .then(function(result) {
      $scope.successMessage = 'Product registered successfully on the blockchain!';
      $scope.newProduct = {}; // Reset the form
      return $scope.loadProducts(); // Reload the product list
    })
    .catch(function(error) {
      $scope.errorMessage = error.message || 'An unexpected error occurred during product registration';
      console.error('Error registering product:', error);
    })
    .finally(function() {
      $scope.isRegistering = false;
      // Use $timeout to safely apply changes
      $timeout(function() {
        $scope.$apply();
      });
    });
};

/**
 * Validate the new product form
 * @returns {boolean} True if the form is valid, false otherwise
 */
function validateNewProductForm() {
  return $scope.newProduct.type &&
         $scope.newProduct.origin &&
         $scope.newProduct.batchNumber &&
         $scope.newProduct.quantity > 0 &&
         $scope.newProduct.price > 0 &&
         $scope.newProduct.productionDate &&
         $scope.newProduct.certifications;
}

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
     * Show traceability information for a product
     * @param {Object} product - The product object
     */
$scope.showTraceability = function(product) {
  console.log('Showing traceability for product:', product);
  
  // Set the selected product
  $scope.selectedProduct = product;
  
  // Generate QR code
  FarmerService.generateQRCode(product)
    .then(function(qrCodeUrl) {
      $timeout(function() {
        $scope.qrCodeUrl = qrCodeUrl;
        $scope.showQRCodeModal = true;
      });
    })
    .catch(function(error) {
      console.error('Error generating QR code:', error);
      $scope.errorMessage = 'Failed to generate QR code: ' + error.message;
    });
};

/**
     * Opens the real-time tracking page for a selected product
     * @param {Object} product - The selected product object
     */
$scope.openRealTimeTracking = function(product) {
  if (product && product._id) {
    var url = '/public/real-time-tracking.html?' + 
              'id=' + encodeURIComponent(product._id) +
              '&type=' + encodeURIComponent(product.type) +
              '&origin=' + encodeURIComponent(product.origin) +
              '&productionDate=' + encodeURIComponent(product.productionDate) +
              '&batchNumber=' + encodeURIComponent(product.batchNumber) +
              '&status=' + encodeURIComponent(product.status);
    
    $window.open(url, '_blank');
    
    console.log('Opening real-time tracking for product:', product._id);
  } else {
    console.error('No product selected for real-time tracking');
    $scope.errorMessage = 'Please select a product before opening real-time tracking.';
  }
};

/**
 * Generate QR code for a product
 * @param {Object} product - The product to generate a QR code for
 */
$scope.generateQRCode = function(product) {
  console.log('Generating QR code for product:', product);
  FarmerService.generateQRCode(product)
    .then(function(qrCodeUrl) {
      $scope.qrCodeUrl = qrCodeUrl;
      $scope.showQRCode = true;
    })
    .catch(function(error) {
      console.error('Error generating QR code:', error);
      $scope.errorMessage = 'Failed to generate QR code: ' + error.message;
    });
};

/**
 * Check if update status button should be enabled
 * @returns {boolean} True if the button should be enabled, false otherwise
 */
$scope.isUpdateStatusEnabled = function() {
  const enabled = $scope.isWalletConnected && $scope.selectedProductId && $scope.newStatus && !$scope.isUpdating;
  console.log('Update status button enabled:', enabled, {
    isWalletConnected: $scope.isWalletConnected,
    selectedProductId: $scope.selectedProductId,
    newStatus: $scope.newStatus,
    isUpdating: $scope.isUpdating
  });
  return enabled;
};

// Make sure these variables are properly initialized
$scope.isWalletConnected = false;
$scope.selectedProductId = null;
$scope.newStatus = null;
$scope.isUpdating = false;

/**
 * Handle product selection
 * @param {string} productId - The ID of the selected product
 */
$scope.onProductSelect = function(productId) {
  console.log('Product selected:', productId);
  $scope.selectedProductId = productId;
  $scope.newStatus = null; // Reset status when a new product is selected
};

/**
 * Handle status selection
 * @param {string} status - The selected status
 */
$scope.onStatusSelect = function(status) {
  console.log('Status selected:', status);
  $scope.newStatus = status;
};


/**
 * Update product status
 * @param {string} selectedProductId - The ID of the selected product
 * @param {string} newStatus - The new status to set
 */
$scope.updateProductStatus = function() {
  console.log('Update status button clicked');
  if (!$scope.isUpdateStatusEnabled()) {
    console.log('Update status not enabled');
    return;
  }

  // Start update status process
  console.log('Starting update status process');
  $scope.isUpdating = true;
  $scope.errorMessage = ''; // Clear previous error messages

  // Update product status
  FarmerService.updateProductStatus($scope.selectedProductId, $scope.newStatus)
    .then(function(response) {
      console.log('Update status response:', response);
      if (response.success) {
        $scope.successMessage = 'Product status updated successfully!';
        $scope.loadProducts(); // Reload products to reflect the updated status
      } else {
        throw new Error(response.error || 'Failed to update product status');
      }
    })
    .catch(function(error) {
      console.error('Update status error:', error);
      $scope.errorMessage = error.message || 'Error updating product status';
    })
    .finally(function() {
      console.log('Update status process completed');
      $scope.isUpdating = false;
      $scope.$apply(); // Ensure the view updates
    });
};

/**
     * Show product details
     * @param {string} productId - The ID of the selected product
     */
$scope.showProductDetails = function(productId) {
  console.log('Showing details for product:', productId);
  $scope.isLoading = true;
  FarmerService.getProduct(productId)
    .then(function(product) {
      $scope.selectedProduct = product;
      $scope.selectedProductId = product._id; // Set the selectedProductId
      $scope.newStatus = null; // Reset the status when a new product is selected
      console.log('Selected product:', $scope.selectedProduct);
    })
    .catch(function(error) {
      console.error('Error fetching product details:', error);
      $scope.errorMessage = 'Error fetching product details: ' + error.message;
    })
    .finally(function() {
      $scope.isLoading = false;
    });
};

/**
 * Check if update status button should be enabled
 * @returns {boolean} True if the button should be enabled, false otherwise
 */
$scope.isUpdateStatusEnabled = function() {
  return $scope.isWalletConnected && $scope.selectedProductId && $scope.newStatus && !$scope.isUpdating;
};

/**
 * Update product status
 */
$scope.updateProductStatus = function() {
  console.log('Update status button clicked');
  if (!$scope.isUpdateStatusEnabled()) {
    console.log('Update status not enabled');
    return;
  }

  console.log('Starting update status process');
  $scope.isUpdating = true;
  $scope.errorMessage = ''; // Clear previous error messages

  FarmerService.updateProductStatus($scope.selectedProductId, $scope.newStatus)
    .then(function(response) {
      console.log('Update status response:', response);
      if (response.success) {
        $scope.successMessage = 'Product status updated successfully!';
        // Update the product in the list and refresh details
        $scope.showProductDetails($scope.selectedProductId);
      } else {
        throw new Error(response.error || 'Failed to update product status');
      }
    })
    .catch(function(error) {
      console.error('Update status error:', error);
      $scope.errorMessage = error.message || 'Error updating product status';
    })
    .finally(function() {
      console.log('Update status process completed');
      $scope.isUpdating = false;
      $scope.$apply(); // Ensure the view updates
    });
};

/**
 * Initiate a transfer of product ownership
 */
$scope.initiateTransfer = function() {
  console.log('Initiating transfer with data:', $scope.transferData);

  if (!$scope.transferData.productId || !$scope.transferData.newOwnerUsername || !$scope.transferData.quantity || !$scope.isWalletConnected) {
    $scope.errorMessage = 'Please fill all transfer fields and connect your wallet.';
    return;
  }

  $scope.isTransferring = true;
  $scope.errorMessage = '';
  $scope.successMessage = '';

  Web3Service.initiateTransferOnBlockchain(
    $scope.transferData.productId,
    $scope.transferData.newOwnerUsername,
    $scope.transferData.quantity
  )
    .then(function(blockchainResult) {
      console.log('Blockchain transfer result:', blockchainResult);
      if (blockchainResult.success) {
        return FarmerService.initiateTransfer({
          productId: $scope.transferData.productId,
          newOwnerUsername: $scope.transferData.newOwnerUsername,
          quantity: parseInt($scope.transferData.quantity, 10),
          blockchainTx: blockchainResult.txHash
        });
      } else {
        throw new Error(blockchainResult.error || 'Blockchain transfer failed.');
      }
    })
    .then(function(backendResult) {
      console.log('Backend transfer result:', backendResult);
      if (backendResult.success) {
        $scope.successMessage = 'Transfer initiated successfully!';
        // Update the product quantity in the list
        const product = $scope.products.find(p => p._id === $scope.transferData.productId);
        if (product) {
          product.quantity -= parseInt($scope.transferData.quantity, 10);
        }
        $scope.transferData = { productId: null, newOwnerUsername: null, quantity: null };
        $scope.loadProducts();
        $scope.loadPendingTransfers();
      } else {
        throw new Error(backendResult.error || 'Backend transfer failed.');
      }
    })
    .catch(function(error) {
      console.error('Transfer failed:', error);
      $scope.errorMessage = 'Error initiating transfer: ' + (error.error || error.message || 'An unexpected error occurred');
    })
    .finally(function() {
      $scope.isTransferring = false;
      $timeout(function() {
        $scope.$apply();
      });
    });
};

function showEthereumAddressUpdateModal(product) {
  // This function should show a modal or form to update the Ethereum address
  // For this example, we'll use a simple prompt, but in a real application,
  // you should use a proper modal or form
  return $q(function(resolve, reject) {
    const address = prompt("Please enter your Ethereum address:");
    if (address) {
      FarmerService.updateEthereumAddress(address)
        .then(function(response) {
          product.currentOwner.ethereumAddress = address;
          resolve(product);
        })
        .catch(reject);
    } else {
      reject(new Error("Ethereum address is required"));
    }
  });
}

$scope.updateEthereumAddress = function() {
  if (!$scope.newEthereumAddress) {
    $scope.errorMessage = 'Please enter a valid Ethereum address';
    return;
  }

  FarmerService.updateEthereumAddress($scope.newEthereumAddress)
    .then(function(response) {
      $scope.successMessage = 'Ethereum address updated successfully';
      $scope.errorMessage = '';
      $scope.newEthereumAddress = '';
      // Optionally, update the user's information in the scope
      $scope.user.ethereumAddress = response.user.ethereumAddress;
    })
    .catch(function(error) {
      $scope.errorMessage = 'Failed to update Ethereum address: ' + error.message;
      $scope.successMessage = '';
    });
};

// Add a watch to log changes in transferData
$scope.$watch('transferData', function(newVal, oldVal) {
  if (newVal !== oldVal) {
    console.log('Transfer data changed:', newVal);
  }
}, true);

/**
 * Load all products for the farmer
 */
$scope.loadProducts = function() {
  $scope.isLoading = true;
  return FarmerService.getProducts()
    .then(function(products) {
      $timeout(function() {
        $scope.products = products;
        console.log('Products loaded:', $scope.products);
      });
    })
    .catch(function(error) {
      $scope.errorMessage = 'Error loading products: ' + error.message;
      console.error('Error loading products:', error);
    })
    .finally(function() {
      $timeout(function() {
        $scope.isLoading = false;
      });
    });
};

// Check if distributors are being loaded
$scope.loadDistributors = function() {
  FarmerService.getDistributors()
    .then(function(distributors) {
      $scope.distributors = distributors;
      console.log('Distributors loaded:', $scope.distributors); // Log distributors after loading
    })
    .catch(function(error) {
      $scope.errorMessage = 'Error loading distributors: ' + error.message;
      console.error('Error loading distributors:', error);
    });
};


/**
 * Load the list of pending transfers from the server
 */
$scope.loadPendingTransfers = function() {
  $scope.isLoadingPendingTransfers = true;
  FarmerService.getPendingTransfers()
    .then(function(transfers) {
      $scope.pendingTransfers = transfers;
      console.log('Pending transfers loaded:', $scope.pendingTransfers);
    })
    .catch(function(error) {
      console.error('Error loading pending transfers:', error);
      $scope.errorMessage = 'Error loading pending transfers: ' + error.message;
    })
    .finally(function() {
      $scope.isLoadingPendingTransfers = false;
    });
};


    /**
     * Connect to Ethereum wallet
     * Checks if the wallet is already connected or in the process of connecting
     * and proceeds accordingly.
     */
    $scope.connectWallet = function() {
      if ($scope.isWalletConnected || $scope.isConnecting) {
        console.log('Wallet already connected or connection in progress');
        return;
      }

      $scope.isConnecting = true;
      Web3Service.connectWallet()
        .then(function(address) {
          applyScope(() => {
            $scope.walletAddress = address;
            $scope.isWalletConnected = true;
            $scope.successMessage = 'Wallet connected successfully';
            return Web3Service.getBalance(address); // Retrieve the wallet balance
          });
        })
        .then(function(balance) {
          applyScope(() => {
            $scope.walletBalance = balance;
          });
        })
        .catch(function(error) {
          applyScope(() => {
            $scope.errorMessage = error.message || 'Failed to connect wallet. Please make sure MetaMask is installed and unlocked.';
          });
        })
        .finally(function() {
          applyScope(() => {
            $scope.isConnecting = false;
          });
        });
    };

    /**
     * Disconnect from Ethereum wallet
     */
    $scope.disconnectWallet = function() {
      Web3Service.disconnectWallet();
      applyScope(() => {
        $scope.isWalletConnected = false;
        $scope.walletAddress = '';
        $scope.walletBalance = 0;
        $scope.successMessage = 'Wallet disconnected successfully';
      });
    };

/**
     * Sync products with blockchain
     */
$scope.syncProducts = function() {
  console.log('Sync button clicked');
  if (!$scope.isSyncEnabled()) {
    console.log('Sync not enabled');
    return;
  }

  console.log('Starting sync process');
  $scope.isSyncing = true;
  $scope.syncMessage = 'Syncing products...';
  
  FarmerService.syncProductsWithBlockchain()
    .then(function(result) {
      console.log('Sync result:', result);
      $scope.successMessage = result.message;
      $scope.loadProducts(); // Reload products after syncing
    })
    .catch(function(error) {
      console.error('Sync error:', error);
      $scope.errorMessage = 'Failed to sync products: ' + error.message;
    })
    .finally(function() {
      console.log('Sync process completed');
      $scope.isSyncing = false;
      $scope.syncMessage = '';
    });
};

/**
 * Check if sync button should be enabled
 * @returns {boolean} True if the button should be enabled, false otherwise
 */
$scope.isSyncEnabled = function() {
  const enabled = $scope.isWalletConnected && !$scope.isSyncing;
  console.log('Sync button enabled:', enabled);
  return enabled;
};

    /**
     * Check if update status button should be enabled
     * @returns {boolean} True if the button should be enabled, false otherwise
     */
    $scope.isUpdateStatusEnabled = function() {
      return $scope.selectedProductId && $scope.newStatus && $scope.isWalletConnected;
    };


/**
 * Update product status
 * This function is called when the user clicks the update status button
 */
$scope.updateProductStatus = function() {
  console.log('Update status button clicked');
  if (!$scope.isUpdateStatusEnabled()) {
    console.log('Update status not enabled');
    return;
  }

  console.log('Starting update status process');
  $scope.isUpdating = true;
  $scope.errorMessage = ''; // Clear previous error messages
  FarmerService.updateProductStatus($scope.selectedProductId, $scope.newStatus)
    .then(function(response) {
      console.log('Update status response:', response);
      if (response.success) {
        $scope.successMessage = 'Product status updated successfully!';
        $scope.loadProducts(); // Reload products to reflect the updated status
      } else {
        throw new Error(response.error || 'Failed to update product status');
      }
    })
    .catch(function(error) {
      console.error('Update status error:', error);
      $scope.errorMessage = error.message || 'Error updating product status';
      if (error.message.includes('Product not found')) {
        $scope.errorMessage = 'Product not found in the database. It may have been deleted.';
      } else if (error.message.includes('does not have a blockchain ID')) {
        $scope.errorMessage = 'Product is not properly registered on the blockchain. Please re-register the product.';
      } else if (error.message.includes('does not exist on the blockchain')) {
        $scope.errorMessage = 'Product is not found on the blockchain. Please ensure the product is registered correctly.';
      }
    })
    .finally(function() {
      console.log('Update status process completed');
      $scope.isUpdating = false;
    });
};

/**
 * Sync products with blockchain
 */
$scope.syncProducts = function() {
  console.log('Sync button clicked');
  if (!$scope.isSyncEnabled()) {
    console.log('Sync not enabled');
    return;
  }

  console.log('Starting sync process');
  $scope.isSyncing = true;
  $scope.syncMessage = 'Syncing products...';
  $scope.successMessage = '';
  $scope.errorMessage = '';
  
  FarmerService.syncProductsWithBlockchain()
    .then(function(result) {
      console.log('Sync result:', result);
      if (result.success) {
        $scope.successMessage = result.message;
      } else {
        throw new Error(result.error || 'Failed to sync products');
      }
      $scope.loadProducts(); // Reload products after syncing
    })
    .catch(function(error) {
      console.error('Sync error:', error);
      $scope.errorMessage = 'Failed to sync products: ' + (error.message || 'An unexpected error occurred');
    })
    .finally(function() {
      console.log('Sync process completed');
      $scope.isSyncing = false;
      $scope.syncMessage = '';
    });
};

    // Make sure to cancel the interval when the controller is destroyed
    $scope.$on('$destroy', function() {
      if (angular.isDefined(stopTime)) {
        $interval.cancel(stopTime);
        stopTime = undefined;
      }
    });

    /**
     * Check for transfer updates
     */
    function checkTransferUpdates() {
      FarmerService.getPendingTransfers()
        .then(function(transfers) {
          $scope.pendingTransfers = transfers;
          transfers.forEach(function(transfer) {
            if (transfer.status === 'accepted') {
              $scope.successMessage = 'Transfer for product ' + transfer.productId + ' has been accepted by the distributor.';
              $scope.loadProducts();
            }
          });
        })
        .catch(function(error) {
          console.error('Error checking transfer updates:', error);
        });
    }


/**
 * Cancel a pending transfer
 * @param {string} transferId - The ID of the transfer to cancel
 */
$scope.cancelTransfer = function(transferId) {
  console.log('Cancelling transfer:', transferId);
  
  // Find the transfer in the pendingTransfers array
  const transfer = $scope.pendingTransfers.find(t => t._id === transferId);
  if (!transfer) {
    console.error('Transfer not found:', transferId);
    return;
  }

  // Set the isCancelling flag for this specific transfer
  transfer.isCancelling = true;

  FarmerService.cancelTransfer(transferId)
    .then(function(response) {
      if (response.success) {
        $scope.successMessage = 'Transfer cancelled successfully';
        $scope.loadPendingTransfers();  // Reload the transfers list
      } else {
        throw new Error(response.error || 'Failed to cancel transfer');
      }
    })
    .catch(function(error) {
      console.error('Error cancelling transfer:', error);
      $scope.errorMessage = 'Failed to cancel transfer: ' + (error.message || 'An unexpected error occurred');
    })
    .finally(function() {
      transfer.isCancelling = false;
    });
};

/**
 * Proceed with transfer cancellation once the wallet is connected
 * @param {string} transferId - The ID of the transfer to cancel
 */
function proceedWithCancelTransfer(transferId) {
  $scope.isLoading = true;
  $scope.errorMessage = '';
  $scope.successMessage = '';

  FarmerService.getTransferDetails(transferId)  // Ensure you have a method to get transfer details
    .then(function(transfer) {
      if (transfer.fromId !== $scope.walletAddress) {
        throw new Error('Only the transfer initiator can cancel this transfer.');
      }

      return FarmerService.cancelTransfer(transferId);  // Proceed with the cancellation
    })
    .then(function(response) {
      if (response.success) {
        $scope.successMessage = 'Transfer cancelled successfully';
        $scope.loadPendingTransfers();  // Reload the transfers list
      } else {
        throw new Error(response.error || 'Failed to cancel transfer');
      }
    })
    .catch(function(error) {
      console.error('Error cancelling transfer:', error);
      $scope.errorMessage = 'Failed to cancel transfer: ' + (error.message || 'An unexpected error occurred');
    })
    .finally(function() {
      $scope.isLoading = false;
    });
}



/**
 * Generate a QR code for a product
 * @param {Object} product - The product to generate a QR code for
 */

// QR Code related variables
$scope.showQRCode = false;
$scope.qrCodeUrl = null;
$scope.isGeneratingQR = false;
$scope.qrCodeError = null;

// Function to toggle QR Code display
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


// Update the generateQRCode function
$scope.generateQRCode = function(product) {
  console.log('Generating QR code for product:', product);
  $scope.isGeneratingQR = true;
  $scope.qrCodeError = null;

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

  FarmerService.generateQRCode(productInfo)
    .then(function(url) {
      console.log('QR code generated successfully');
      $scope.qrCodeUrl = url;
    })
    .catch(function(error) {
      console.error('Error generating QR code:', error);
      $scope.qrCodeError = 'Failed to generate QR code: ' + error.message;
    })
    .finally(function() {
      $scope.isGeneratingQR = false;
      $scope.$applyAsync();
    });
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
     * Reset form fields and messages
     */
    $scope.resetForm = function() {
      $scope.newProduct = {};
      $scope.selectedProductId = null;
      $scope.newStatus = null;
      $scope.successMessage = '';
      $scope.errorMessage = '';
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
     * Show product details in a modal
     */
 // Update the showProductDetails function
$scope.showProductDetails = function(productId) {
  console.log('Showing details for product:', productId);
  $scope.isLoading = true;
  FarmerService.getProduct(productId)
    .then(function(product) {
      $scope.selectedProduct = product;
      console.log('Selected product:', $scope.selectedProduct);
      // Reset QR code related variables
      $scope.qrCodeUrl = null;
      $scope.qrCodeError = null;
    })
    .catch(function(error) {
      console.error('Error fetching product details:', error);
      $scope.errorMessage = 'Error fetching product details: ' + error.message;
    })
    .finally(function() {
      $scope.isLoading = false;
    });
};

    /**
     * Format date for display
     */
    $scope.formatDate = function(dateString) {
      return new Date(dateString).toLocaleString();
    };

    /**
     * Validate new product form
     */
    $scope.validateNewProductForm = function() {
      return $scope.newProduct.type &&
             $scope.newProduct.batchNumber &&
             $scope.newProduct.quantity > 0 &&
             $scope.newProduct.price > 0 &&
             $scope.newProduct.productionDate;
    };

    // Watch for changes in wallet connection status
    $scope.$watch('isWalletConnected', function(newValue, oldValue) {
      if (newValue !== oldValue) {
        if (newValue) {
          $scope.refreshWalletBalance(); // Refresh balance when wallet is connected
        } else {
          $scope.walletBalance = 0; // Reset balance when wallet is disconnected
        }
      }
    });

    // Cleanup interval on scope destruction
    $scope.$on('$destroy', function() {
      if (angular.isDefined(stopTime)) {
        $interval.cancel(stopTime);
        stopTime = undefined;
      }
    });

    // Load initial data on controller initialization
    function initializeDashboard() {
      $scope.loadProducts();
      $scope.loadDistributors();
      $scope.loadPendingTransfers(); 
    }
    
    initializeDashboard();

    // Add a function to refresh distributors
    $scope.refreshDistributors = function() {
      console.log('Refreshing distributors...');
      $scope.loadDistributors();
    };

  }]);
