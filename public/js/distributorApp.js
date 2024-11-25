// distributorApp.js

/**
 * Angular module for the Distributor dashboard
 * This module configures routes, filters, and directives for the distributor interface
 */
angular.module('foodTraceabilityApp', ['ngRoute'])
  .config(['$routeProvider', function($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'distributor-dashboard-template.html',
        controller: 'DistributorController'
      })
      .when('/products', {
        templateUrl: 'distributor-dashboard-template.html',
        controller: 'DistributorController'
      })
      .when('/transfers', {
        templateUrl: 'distributor-dashboard-template.html',
        controller: 'DistributorController'
      })
      .when('/history', {
        templateUrl: 'distributor-dashboard-template.html',
        controller: 'DistributorController'
      })
      .when('/retailers', {
        templateUrl: 'distributor-dashboard-template.html',
        controller: 'DistributorController'
      })
      .otherwise({
        redirectTo: '/'
      });
  }])

  // Capitalize filter for consistent UI text presentation
  .filter('capitalize', function() {
    return function(input) {
      return (input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
    };
  })

  // Initialize global settings or variables on app start
  .run(['$rootScope', function($rootScope) {
    $rootScope.theme = localStorage.getItem('theme') || 'light';
  }])

  // Custom directive for user controls (toggle theme and logout)
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
        $scope.toggleTheme = function() {
          $rootScope.theme = $rootScope.theme === 'light' ? 'dark' : 'light';
          localStorage.setItem('theme', $rootScope.theme);
          document.documentElement.setAttribute('data-theme', $rootScope.theme);
        };

        $scope.logout = function() {
          localStorage.removeItem('token');
          Web3Service.disconnectWallet();
          window.location.href = 'login.html';
        };
      }]
    };
  })

  // Distributor-specific directives or services can be added here
  .directive('productList', function() {
    return {
      restrict: 'E',
      templateUrl: 'product-list-template.html',
      controller: 'ProductListController'
    };
  })

  .directive('transferForm', function() {
    return {
      restrict: 'E',
      templateUrl: 'transfer-form-template.html',
      controller: 'TransferFormController'
    };
  });

// Additional distributor-specific configurations or services can be added here