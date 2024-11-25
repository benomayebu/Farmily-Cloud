/**
 * foodTraceabilityApp.js
 * 
 * This file initializes and configures the main AngularJS module for the food traceability platform.
 * It combines functionality for farmer, distributor, retailer, consumer, and real-time tracking interfaces.
 */

angular.module('foodTraceabilityApp', ['ngRoute', 'ui.bootstrap'])
  .config(['$routeProvider', '$uibModalProvider', function($routeProvider, $uibModalProvider) {
    // Configure routes for the application
    $routeProvider
      // Farmer routes
      .when('/farmer', {
        templateUrl: 'farmer-dashboard-template.html',
        controller: 'FarmerController'
      })
      .when('/farmer/products', {
        templateUrl: 'farmer-dashboard-template.html',
        controller: 'FarmerController'
      })
      .when('/farmer/insights', {
        templateUrl: 'farmer-dashboard-template.html',
        controller: 'FarmerController'
      })
      .when('/farmer/history', {
        templateUrl: 'farmer-dashboard-template.html',
        controller: 'FarmerController'
      })
      .when('/farmer/transfers', {
        templateUrl: 'farmer-dashboard-template.html',
        controller: 'FarmerController'
      })
      // Distributor routes
      .when('/distributor', {
        templateUrl: 'distributor-dashboard-template.html',
        controller: 'DistributorController'
      })
      .when('/distributor/products', {
        templateUrl: 'distributor-dashboard-template.html',
        controller: 'DistributorController'
      })
      .when('/distributor/transfers', {
        templateUrl: 'distributor-dashboard-template.html',
        controller: 'DistributorController'
      })
      .when('/distributor/history', {
        templateUrl: 'distributor-dashboard-template.html',
        controller: 'DistributorController'
      })
      .when('/distributor/retailers', {
        templateUrl: 'distributor-dashboard-template.html',
        controller: 'DistributorController'
      })
      // Retailer routes
      .when('/retailer', {
        templateUrl: 'retailer-dashboard-template.html',
        controller: 'RetailerController'
      })
      .when('/retailer/products', {
        templateUrl: 'retailer-dashboard-template.html',
        controller: 'RetailerController'
      })
      .when('/retailer/transfers', {
        templateUrl: 'retailer-dashboard-template.html',
        controller: 'RetailerController'
      })
      .when('/retailer/history', {
        templateUrl: 'retailer-dashboard-template.html',
        controller: 'RetailerController'
      })
      .when('/retailer/consumers', {
        templateUrl: 'retailer-dashboard-template.html',
        controller: 'RetailerController'
      })
      // Consumer routes
      .when('/consumer', {
        templateUrl: 'consumer-dashboard-template.html',
        controller: 'ConsumerController'
      })
      .when('/consumer/my-products', {
        templateUrl: 'consumer-dashboard-template.html',
        controller: 'ConsumerController'
      })
      .when('/consumer/scan-product', {
        templateUrl: 'consumer-dashboard-template.html',
        controller: 'ConsumerController'
      })
      .when('/consumer/product-history', {
        templateUrl: 'consumer-dashboard-template.html',
        controller: 'ConsumerController'
      })
      .when('/consumer/transfers', {
        templateUrl: 'consumer-dashboard-template.html',
        controller: 'ConsumerController'
      })
      // Real-time tracking route
      // Real-time tracking route
      .when('/real-time-tracking', {
        templateUrl: '/public/real-time-tracking.html',
        controller: 'TrackingController'
      })
      .otherwise({
        redirectTo: '/farmer' // Default route, can be changed as needed
      });

    // Configure UI Bootstrap modal options
    $uibModalProvider.options.backdrop = 'static';
    $uibModalProvider.options.keyboard = false;
  }])

  /**
   * Capitalize filter for consistent UI text presentation
   * This filter capitalizes the first letter of a string and lowercases the rest
   */
  .filter('capitalize', function() {
    return function(input) {
      return (input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
    };
  })

  /**
   * Initialize global settings or variables on app start
   * This run block sets up the initial theme based on localStorage or defaults to 'light'
   */
  .run(['$rootScope', function($rootScope) {
    $rootScope.theme = localStorage.getItem('theme') || 'light';
  }])

  /**
   * Custom directive for user controls (toggle theme and logout)
   * This directive provides a consistent UI element for theme toggling and logout across the app
   */
  .directive('userControls', function() {
    return {
      restrict: 'E',
      template: `
        <div>
          <button ng-click="toggleTheme()" class="theme-toggle">
            <i ng-class="theme === 'light' ? 'fas fa-moon' : 'fas fa-sun'"></i>
            {{theme === 'light' ? 'Dark Mode' : 'Light Mode'}}
          </button>
          <button ng-click="logout()" class="logout-button">
            <i class="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      `,
      controller: ['$scope', '$rootScope', 'Web3Service', function($scope, $rootScope, Web3Service) {
        /**
         * Toggle between light and dark themes
         * Updates the theme in localStorage and applies it to the document
         */
        $scope.toggleTheme = function() {
          $rootScope.theme = $rootScope.theme === 'light' ? 'dark' : 'light';
          localStorage.setItem('theme', $rootScope.theme);
          document.documentElement.setAttribute('data-theme', $rootScope.theme);
        };

        /**
         * Logout function
         * Removes the auth token, disconnects the wallet, and redirects to the login page
         */
        $scope.logout = function() {
          localStorage.removeItem('token');
          Web3Service.disconnectWallet();
          window.location.href = 'login.html';
        };
      }]
    };
  })

  /**
   * Directive for displaying a list of products
   * This can be used in farmer, distributor, and retailer views
   */
  .directive('productList', function() {
    return {
      restrict: 'E',
      templateUrl: 'product-list-template.html',
      controller: 'ProductListController'
    };
  })

  /**
   * Directive for the transfer form
   * This can be used in farmer, distributor, and retailer views for initiating transfers
   */
  .directive('transferForm', function() {
    return {
      restrict: 'E',
      templateUrl: 'transfer-form-template.html',
      controller: 'TransferFormController'
    };
  })

  /**
   * Directive for displaying a list of consumer-owned products
   */
  .directive('consumerProductList', function() {
    return {
      restrict: 'E',
      templateUrl: 'consumer-product-list-template.html',
      controller: 'ConsumerProductListController'
    };
  })

  /**
   * Directive for the QR code scanner
   * Used in the consumer view for scanning product QR codes
   */
  .directive('qrCodeScanner', function() {
    return {
      restrict: 'E',
      templateUrl: 'qr-code-scanner-template.html',
      controller: 'QRCodeScannerController'
    };
  })

  /**
   * Controller for the real-time tracking page
   * Handles loading and displaying product information for real-time tracking
   */
  .controller('TrackingController', ['$scope', '$http', '$location', '$timeout', function($scope, $http, $location, $timeout) {
    // Initialize scope variables
    $scope.product = null;
    $scope.farmer = null;
    $scope.currentOwner = null;
    $scope.ownershipHistory = [];
    $scope.blockchainData = null;
    $scope.isLoading = true;
    $scope.errorMessage = null;

    /**
     * Function to get URL parameters
     * @param {string} name - The name of the parameter to get
     * @returns {string} The value of the parameter
     */
    function getUrlParameter(name) {
      name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
      var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
      var results = regex.exec($location.absUrl());
      return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    // Get the product ID from the URL
    var productId = getUrlParameter('id');

    /**
     * Function to load product information
     */
    function loadProductInfo() {
      $scope.isLoading = true;
      $scope.errorMessage = null;

      if (!productId) {
        console.error('No product ID provided');
        $scope.errorMessage = 'No product ID provided';
        $scope.isLoading = false;
        return;
      }

      $http.get('/api/products/' + productId + '/fullInfo')
        .then(function(response) {
          console.log('Product info received:', response.data);
          $scope.product = response.data.product;
          $scope.farmer = response.data.farmer;
          $scope.currentOwner = response.data.currentOwner;
          $scope.ownershipHistory = response.data.ownershipHistory;
          $scope.blockchainData = response.data.blockchainData;
        })
        .catch(function(error) {
          console.error('Error loading product info:', error);
          $scope.errorMessage = 'Failed to load product information: ' + (error.data?.message || error.message || 'Unknown error');
        })
        .finally(function() {
          $scope.isLoading = false;
          // Use $timeout to ensure the view updates
          $timeout(function() {
            $scope.$apply();
          });
        });
    }

    /**
     * Function to refresh data
     */
    $scope.refreshData = function() {
      loadProductInfo();
    };

    /**
     * Function to format dates
     * @param {string} dateString - The date string to format
     * @returns {string} The formatted date string
     */
    $scope.formatDate = function(dateString) {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleString();
    };

    // Load product information when the controller initializes
    loadProductInfo();
  }]);