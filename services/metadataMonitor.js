const https = require('https');
const http = require('http');
const config = require('../config');

const { updateMetadata } = require('./metadataService');

let retryCount = 0;
const maxRetries = 10;

function startMetadataMonitor() {
  console.log(`[META] Conectando para leer metadatos de: ${config.streamUrl}`);

  const isHttps = config.streamUrl.startsWith('https');
  const requestLib = isHttps ? https : http;

  const request = requestLib.get(config.streamUrl, {
    headers: {
      'Icy-MetaData': '1',
      'User-Agent': 'EternityReadyRadioMetadataMonitor/1.0'
    },
    timeout: 5000
  }, (response) => {
    retryCount = 0;
    const metaInt = parseInt(response.headers['icy-metaint'], 10) || 16000;
    let buffer = Buffer.alloc(0);

    response.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      
      let offset = 0;
      while (offset + metaInt < buffer.length) {
        offset += metaInt;
        const metaLength = buffer[offset] * 16;

        if (metaLength > 0 && offset + 1 + metaLength <= buffer.length) {
          const metadataBuffer = buffer.slice(offset + 1, offset + 1 + metaLength);
          const metadataString = metadataBuffer.toString('utf8').replace(/\0/g, '');
          updateMetadata(response.headers, metadataString);
        }
        offset += 1 + metaLength;
      }

      if (buffer.length > metaInt * 2) {
        buffer = buffer.slice(buffer.length - metaInt);
      }
    });

    response.on('end', () => {
      console.warn('[META] Conexión cerrada. Reintentando...');
      setTimeout(startMetadataMonitor, 5000);
    });
  });

  request.on('error', (err) => {
    console.error(`[META] Error: ${err.code} - ${err.message}`);
    retryCount++;
    if (retryCount > maxRetries) {
      console.error(`[META] Máximo de reintentos alcanzado (${maxRetries}). Deteniendo monitor.`);
    } else {
      setTimeout(startMetadataMonitor, 5000);
    }
  });

  request.on('timeout', () => {
    console.error('[META] Timeout al conectar para metadatos');
    request.destroy();
    setTimeout(startMetadataMonitor, 5000);
  });
}

module.exports = startMetadataMonitor;