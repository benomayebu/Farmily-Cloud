// Register.js

const app = Vue.createApp({
  data() {
    return {
      userType: '',
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      message: '',
      hasError: false,
      isLoading: false,
      passwordStrength: 0
    }
  },

  methods: {
    registerUser(event) {
      event.preventDefault();

      if (!this.validateFormData()) {
        return;
      }

      this.isLoading = true;

      // Update this URL to your actual backend server address and port
      fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userType: this.userType,
          firstName: this.firstName,
          lastName: this.lastName,
          username: this.username,
          email: this.email,
          password: this.password
        })
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(text || 'Network response was not ok');
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.message === 'Registration successful!') {
          this.message = 'Registration successful! Redirecting to login page...';
          this.hasError = false;
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 2000);
        } else {
          throw new Error(data.message || 'Registration failed. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        this.message = error.message;
        this.hasError = true;
      })
      .finally(() => {
        this.isLoading = false;
      });
    },
  
      validateFormData() {
        if (!this.userType || !this.firstName || !this.lastName || !this.username || !this.email || !this.password || !this.confirmPassword) {
          this.message = 'Please fill in all fields.';
          this.hasError = true;
          return false;
        }
  
        if (!this.validateEmail(this.email)) {
          this.message = 'Please enter a valid email address.';
          this.hasError = true;
          return false;
        }
  
        if (this.password !== this.confirmPassword) {
          this.message = 'Passwords do not match.';
          this.hasError = true;
          return false;
        }
  
        if (this.passwordStrength < 3) {
          this.message = 'Please choose a stronger password.';
          this.hasError = true;
          return false;
        }
  
        return true;
      },
  
      validateEmail(email) {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
      },
  
      checkPasswordStrength() {
        const password = this.password;
        let strength = 0;
  
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/\d/)) strength++;
        if (password.match(/[^a-zA-Z\d]/)) strength++;
  
        this.passwordStrength = strength;
      }
    },
  
    watch: {
      password() {
        this.checkPasswordStrength();
      }
    }
  });
  
  // Mount the app to the #app element
  app.mount('#app');