// retailerApp.js

/**
 * Angular module for the Retailer dashboard
 * This module configures routes, filters, and directives for the retailer interface
 */
angular.module('foodTraceabilityApp', ['ngRoute'])
  .config(['$routeProvider', function($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'retailer-dashboard-template.html',
        controller: 'RetailerController'
      })
      .when('/products', {
        templateUrl: 'retailer-dashboard-template.html',
        controller: 'RetailerController'
      })
      .when('/transfers', {
        templateUrl: 'retailer-dashboard-template.html',
        controller: 'RetailerController'
      })
      .when('/history', {
        templateUrl: 'retailer-dashboard-template.html',
        controller: 'RetailerController'
      })
      .when('/consumers', {
        templateUrl: 'retailer-dashboard-template.html',
        controller: 'RetailerController'
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
   * Directive for displaying a list of products in the retailer's view
   */
  .directive('productList', function() {
    return {
      restrict: 'E',
      templateUrl: 'product-list-template.html',
      controller: 'ProductListController'
    };
  })

  /**
   * Directive for the transfer form in the retailer's view
   * Allows retailers to initiate product transfers to consumers
   */
  .directive('transferForm', function() {
    return {
      restrict: 'E',
      templateUrl: 'transfer-form-template.html',
      controller: 'TransferFormController'
    };
  });

// Additional retailer-specific configurations or services can be added here
