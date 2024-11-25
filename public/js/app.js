// public/js/app.js

if (typeof angular !== 'undefined') {
  angular.module('farmilyApp', ['ngRoute', 'farmerApp', 'distributorApp', 'retailerApp', 'consumerApp']);
} else {
  console.error('Angular is not defined. Make sure it is properly loaded.');
}