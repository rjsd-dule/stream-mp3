const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');


router.currentStreamUrl = require('../config').streamUrl;

router.post('/update-stream-url', apiController.updateStreamUrl);
router.get('/metadata', apiController.getMetadata);

module.exports = router;