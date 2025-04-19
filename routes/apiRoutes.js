const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// Variable movida al controller donde se usa
router.currentStreamUrl = require('../config').streamUrl;

router.post('/update-stream-url', apiController.updateStreamUrl);
router.get('/metadata', apiController.getMetadata);

module.exports = router;