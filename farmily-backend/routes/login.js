const express = require('express');
const cors = require('cors'); // Import the cors middleware
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT secret key - in production, this should be set as an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'b4a1a5726e2ba2fd4a8e38b2607ae022b6d108636fa2157b4443363b2c45b0e3709c5c86eb7ade391ef88c1d85578b97fc263108f5c618b374c1c4b2eb804a55';

// Configure CORS to allow requests from your frontend's origin
const corsOptions = {
  origin: 'http://127.0.0.1:5500', // Replace with your frontend's actual origin
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Use the cors middleware before your routes
router.use(cors(corsOptions));

router.post('/', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log(`Login attempt: ${username}`);

    // Validate user input
    if (!username || !password) {
      return res.status(400).json({ message: 'Please fill in all fields.' });
    }

    // Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Debug log: Print hashed password from database
    console.log(`Stored hashed password: ${user.password}`);

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    
    // Debug log: Print result of password comparison
    console.log(`Password comparison result: ${isValid}`);

    if (!isValid) {
      console.log(`Invalid password for user: ${username}`);
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Generate JWT token
    // Include userType in the token payload
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        userType: user.userType // Add user type to token
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`Login successful: ${username}`);
    
    // Send response with token, user type, and success message
    res.status(200).json({ 
      token, 
      userType: user.userType, // Include user type in response
      message: 'Login successful!' 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed.', error: error.message });
  }
});

module.exports = router;