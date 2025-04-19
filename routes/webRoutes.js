// routes/webRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/stream-proxy', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

router.get('/update-url', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'update-stream-url.html'));
});

module.exports = router;