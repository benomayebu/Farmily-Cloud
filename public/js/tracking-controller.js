/**
 * Tracking Controller
 * Manages the real-time tracking page functionality
 */
angular.module('foodTraceabilityApp')
  .controller('TrackingController', ['$scope', '$http', '$location', '$timeout', function($scope, $http, $location, $timeout) {
    
    $scope.product = null;
    $scope.farmer = null;
    $scope.currentOwner = null;
    $scope.ownershipHistory = [];
    $scope.blockchainData = null;
    $scope.isLoading = true;
    $scope.errorMessage = null;

    function getUrlParameter(name) {
      name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
      var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
      var results = regex.exec($location.absUrl());
      return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    var productId = getUrlParameter('id');

    function loadProductInfo() {
      $scope.isLoading = true;
      $scope.errorMessage = null;
    
      if (!productId) {
        $scope.errorMessage = 'No product ID provided';
        $scope.isLoading = false;
        return;
      }
    
      /**
       * Fetch product info from the backend, including farmer and distributor details.
       * This uses the fullInfo API to fetch both product and blockchain data.
       */
      $http.get('/api/distributor/products/' + productId + '/fullInfo')
      .then(function(response) {
        // Assign the response data to scope variables
        $scope.product = response.data.product;
        $scope.farmer = response.data.farmer;
        $scope.currentOwner = response.data.currentOwner;
        $scope.ownershipHistory = response.data.ownershipHistory;
        $scope.blockchainData = response.data.blockchainData;
      })
      .catch(function(error) {
        // Handle any errors in fetching data
        console.error('Error fetching product info:', error);
        $scope.errorMessage = 'Failed to load product information';
      });

    }
    

    $scope.refreshData = function() {
      loadProductInfo();
    };

    $scope.formatDate = function(dateString) {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleString();
    };

    loadProductInfo();
  }]);