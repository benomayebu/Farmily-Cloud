const express = require('express');  // Import the Express.js framework
const app = express();                // Create a new Express.js application
const config = require('./config');   // Import the configuration module
const registerRouter = require('./routes/register'); // Import the register router module
const loginRouter = require('./routes/login'); // Import the login router module

app.use(express.json()); // Enable JSON parsing for incoming requests

app.use('/api/register', registerRouter); // Mount the register router to the /api/register endpoint
app.use('/api/login', loginRouter); // Mount the login router to the /api/login endpoint

app.listen(config.PORT, () => {       // Start the server and listen on the specified port
  console.log(`Server started on port ${config.PORT}`); // Log a message to the console
});
