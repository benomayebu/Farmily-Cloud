const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');

// Hash password function
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Generate a unique identifier
const generateUniqueIdentifier = (userType, username) => {
  // You can customize this function based on your requirements
  return `${userType}-${username}-${Date.now()}`;
};

// Registration route
router.post('/', async (req, res) => {
  try {
    const { userType, firstName, lastName, username, email, password } = req.body;

    console.log(`Registration attempt: ${username} (${email})`);

    // Validate user input
    if (!userType || !firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all fields.' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate unique identifier
    const uniqueIdentifier = generateUniqueIdentifier(userType, username);

    // Create new user
    const user = new User({
      userType,
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword,
      uniqueIdentifier, // Add this field
    });

    await user.save();
    console.log(`Registration successful: ${username} (${email})`);
    res.status(201).json({ message: 'Registration successful!' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
});

module.exports = router;