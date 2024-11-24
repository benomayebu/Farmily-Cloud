/**
 * Logger Utility
 * 
 * This module sets up a centralized logging system using Winston.
 * It provides a consistent interface for logging across the application.
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors 
winston.addColors(colors);

// Define the format for logging
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console(),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/all.log'),
  }),
  
  // File transport for error logs
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format,
  transports,
});

/**
 * Log an error message
 * @param {string} message - The error message
 * @param {Object} [meta] - Additional metadata to log
 */
function error(message, meta) {
  logger.error(message, meta);
}

/**
 * Log a warning message
 * @param {string} message - The warning message
 * @param {Object} [meta] - Additional metadata to log
 */
function warn(message, meta) {
  logger.warn(message, meta);
}

/**
 * Log an info message
 * @param {string} message - The info message
 * @param {Object} [meta] - Additional metadata to log
 */
function info(message, meta) {
  logger.info(message, meta);
}

/**
 * Log a debug message
 * @param {string} message - The debug message
 * @param {Object} [meta] - Additional metadata to log
 */
function debug(message, meta) {
  logger.debug(message, meta);
}

module.exports = {
  error,
  warn,
  info,
  debug,
};