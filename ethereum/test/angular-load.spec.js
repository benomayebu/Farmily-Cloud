// test/angular-load.spec.js
describe('Angular', function() {
    beforeEach(function() {
      document.body.innerHTML = '<div id="app"></div>';
    });
  
    it('should be defined', function() {
      expect(window.angular).toBeDefined();
    });
  
    it('should have main app module', function() {
      expect(angular.module('farmilyApp')).toBeDefined();
    });
  });
  
  describe('Vue', function() {
    it('should be defined', function() {
      expect(window.Vue).toBeDefined();
    });
  
    it('should create a Vue app', function() {
      const app = Vue.createApp({});
      expect(app).toBeDefined();
      app.mount('#app');
    });
  });