/**
 * consumerApp.js
 * 
 * This file initializes and configures the AngularJS module for the consumer interface
 * of the food traceability platform.
 */

angular.module('foodTraceabilityApp', ['ngRoute'])
  .config(['$routeProvider', function($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'consumer-dashboard-template.html',
        controller: 'ConsumerController'
      })
      .when('/my-products', {
        templateUrl: 'consumer-dashboard-template.html',
        controller: 'ConsumerController'
      })
      .when('/scan-product', {
        templateUrl: 'consumer-dashboard-template.html',
        controller: 'ConsumerController'
      })
      .when('/product-history', {
        templateUrl: 'consumer-dashboard-template.html',
        controller: 'ConsumerController'
      })
      .when('/transfers', {
        templateUrl: 'consumer-dashboard-template.html',
        controller: 'ConsumerController'
      })
      .otherwise({
        redirectTo: '/'
      });
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
   * Directive for displaying a list of products owned by the consumer
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
   * Allows consumers to scan product QR codes for information
   */
  .directive('qrCodeScanner', function() {
    return {
      restrict: 'E',
      templateUrl: 'qr-code-scanner-template.html',
      controller: 'QRCodeScannerController'
    };
  });