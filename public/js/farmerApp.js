// farmerApp.js
angular.module('foodTraceabilityApp', ['ngRoute'])
  .config(['$routeProvider', function($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'farmer-dashboard-template.html',
        controller: 'FarmerController'
      })
      .when('/products', {
        templateUrl: 'farmer-dashboard-template.html',
        controller: 'FarmerController'
      })
      .when('/insights', {
        templateUrl: 'farmer-dashboard-template.html',
        controller: 'FarmerController'
      })
      .when('/history', {
        templateUrl: 'farmer-dashboard-template.html',
        controller: 'FarmerController'
      })
      .when('/transfers', {
        templateUrl: 'farmer-dashboard-template.html',
        controller: 'FarmerController'
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
  });
