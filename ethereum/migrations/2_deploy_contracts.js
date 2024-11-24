// File: 2207870\ FARMILY\ethereum\migrations\2_deploy_contracts.js
const ProductManagement = artifacts.require("ProductManagement");

module.exports = function(deployer) {
  deployer.deploy(ProductManagement);
};