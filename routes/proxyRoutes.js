const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const config = require('../config');
const { broadcast } = require('../services/metadataService');

const { getCurrentStreamUrl } = require('../controllers/apiController');

router.get(config.proxyEndpoint, (req, res) => {

  const currentUrl = getCurrentStreamUrl() || config.streamUrl;

  //const isHttps = config.streamUrl.startsWith('https');
  const isHttps = currentUrl.startsWith('https');
  const requestLib = isHttps ? https : http;

  console.log(`[PROXY] Nueva conexión al stream: ${currentUrl}`);

  const forwardRequest = requestLib.get(currentUrl, {
    headers: {
      'Icy-MetaData': '1',
      'User-Agent': 'EternityReadyRadioProxy/1.0'
    },
    timeout: 5000
  }, (forwardResponse) => {
    const passthroughHeaders = [
      'content-type',
      'icy-metaint',
      'icy-name',
      'icy-genre',
      'icy-url',
      'icy-pub',
      'content-length'
    ];

    passthroughHeaders.forEach(header => {
      if (forwardResponse.headers[header]) {
        res.setHeader(header, forwardResponse.headers[header]);
      }
    });

    forwardResponse.pipe(res);
  });

  forwardRequest.on('timeout', () => {
    console.error(`[PROXY] Timeout al conectar con ${config.streamUrl}`);
    forwardRequest.destroy();
    if (!res.headersSent) res.status(504).send('Gateway Timeout');
  });

  forwardRequest.on('error', (err) => {
    console.error(`[PROXY] Error: ${err.code} - ${err.message}`);
    if (!res.headersSent) res.status(502).send('Proxy error');
    res.end();
  });

  req.on('close', () => {
    console.log('[PROXY] Cliente cerró la conexión');
    forwardRequest.destroy();
  });
});

module.exports = router;