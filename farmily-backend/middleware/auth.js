// auth.js

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to authenticate the JWT token
const auth = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization'); // Get Authorization header
    if (!authHeader) {
      return res.status(401).json({ message: 'No authentication token, access denied' }); // If no token, deny access
    }

    const token = authHeader.replace('Bearer ', ''); // Extract token from Bearer string
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
    req.user = { id: decoded.userId, userType: decoded.userType }; // Set user info in req object
    next(); // Continue to the next middleware or route handler
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' }); // Handle token expiration
    }
    res.status(401).json({ message: 'Token is not valid' }); // Handle invalid token
  }
};

module.exports = auth;
