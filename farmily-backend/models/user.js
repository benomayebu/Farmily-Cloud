// models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  userType: {
    type: String,
    required: true,
    enum: ['farmer', 'distributor', 'retailer', 'consumer']
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  username: {
    type: String,
    unique: true,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  uniqueIdentifier: {
    type: String,
    unique: true,
    required: true,
  },
  ethereumAddress: {
    type: String,
    unique: true,
    sparse: true // This allows the field to be unique but not required
  }
}, {
  timestamps: true
});

// Generate a unique identifier when a new user is created
userSchema.pre('save', function(next) {
  if (this.isNew && !this.uniqueIdentifier) {
    this.uniqueIdentifier = 'UID_' + this._id.toString();
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;