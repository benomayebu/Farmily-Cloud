const app = Vue.createApp({
  data() {
    return {
      username: '',
      password: '',
      rememberMe: false,
      errorMessage: '',
      isLoading: false,
    };
  },

  methods: {
    async loginUser() {
      this.isLoading = true;
      this.errorMessage = '';
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.username,
            password: this.password,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Store the token in localStorage
        localStorage.setItem('token', data.token);

        // Store user type
        localStorage.setItem('userType', data.userType);

        // Redirect based on user type
        this.redirectUser(data.userType);
      } catch (error) {
        console.error('Login error:', error);
        this.errorMessage = 'Failed to login. Please check your credentials and try again.';
      } finally {
        this.isLoading = false;
      }
    },

    redirectUser(userType) {
      switch(userType.toLowerCase()) {
        case 'farmer':
          window.location.href = '/farmer-dashboard.html';
          break;
        case 'distributor':
          window.location.href = '/distributor-dashboard.html';
          break;
        case 'retailer':
          window.location.href = '/retailer-dashboard.html';
          break;
        case 'consumer':
          window.location.href = '/consumer-dashboard.html';
          break;
        default:
          window.location.href = '/dashboard.html';
      }
    }
  },
});

app.mount('#app');
