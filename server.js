require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));



// Set the views directory and the view engine
app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'ejs');

// Route to handle voice input
app.post('/voice', (req, res) => {
  // Process the voice input
});


// Route to serve the web application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


 app.get('/api/key', (req, res) => {
   res.json({ apiKey: process.env.OPENAI_API_KEY });
 });

// Route to serve the index.js file
app.get('/index.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.js'));
});


const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
