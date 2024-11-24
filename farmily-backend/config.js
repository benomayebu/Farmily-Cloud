// Load environment variables from .env file
require('dotenv').config();

// Export configuration as an object
module.exports = {
  // The port to listen on for incoming requests
  PORT: process.env.PORT || 3000,

  // The URI to connect to the MongoDB database
  MONGODB_URI: process.env.MONGODB_URI,

  // The secret key used to sign JSON Web Tokens (JWT)
  // This is used to authenticate users and protect routes
  JWT_SECRET: process.env.JWT_SECRET,
};
