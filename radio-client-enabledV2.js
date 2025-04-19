const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const path = require('path');
const WebSocket = require('ws'); // Cambiamos Socket.IO por ws
const config = require('./config'); 

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());  
app.use(express.urlencoded({ extended: true })); 

app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=7200');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/stream-proxy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/update-url', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'update-stream-url.html'));
});

let currentStreamUrl = config.streamUrl;

app.post('/api/update-stream-url', async (req, res) => {
  try {
    const { newStreamUrl } = req.body;
    if (newStreamUrl && newStreamUrl !== currentStreamUrl) {
      currentStreamUrl = newStreamUrl;
      
      broadcast({ type: 'stream-url-updated', url: newStreamUrl });
      res.json({ message: 'URL del stream actualizada correctamente.' });
    } else {
      res.status(400).json({ message: 'URL del stream no ha cambiado o no es válida.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar la URL del stream.' });
  }
});

function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

app.get(config.proxyEndpoint, (req, res) => {
  const isHttps = config.streamUrl.startsWith('https');
  const requestLib = isHttps ? https : http;

  console.log(`[PROXY] Nueva conexión al stream: ${config.streamUrl}`);

  const forwardRequest = requestLib.get(config.streamUrl, {
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

const currentMetadata = {
  StreamTitle: '',
  artistName: '',
  title: '',
  program: 'Eternity Ready Radio',
  lastUpdated: Date.now()
};

app.get('/api/metadata', (req, res) => {
  res.json(currentMetadata);
});

function updateMetadata(icyHeaders, metadataString) {
  let updated = false;

  if (metadataString) {
    const streamTitleMatch = metadataString.match(/StreamTitle='([^']*)'/);
    if (streamTitleMatch) {
      const streamTitle = streamTitleMatch[1];
      const separatorPos = streamTitle.indexOf(' - ');

      const newMetadata = {
        StreamTitle: streamTitle,
        artistName: separatorPos > -1 ? streamTitle.slice(0, separatorPos).trim() : '',
        title: separatorPos > -1 ? streamTitle.slice(separatorPos + 3).trim() : streamTitle,
        program: icyHeaders['icy-name'] || currentMetadata.program,
        lastUpdated: Date.now()
      };

      if (newMetadata.StreamTitle !== currentMetadata.StreamTitle) {
        Object.assign(currentMetadata, newMetadata);
        broadcast({ type: 'metadata-update', data: currentMetadata });
        updated = true;
      }
    }
  }

  if (!updated && icyHeaders['icy-name'] && icyHeaders['icy-name'] !== currentMetadata.program) {
    currentMetadata.program = icyHeaders['icy-name'];
    currentMetadata.lastUpdated = Date.now();
    broadcast({ type: 'metadata-update', data: currentMetadata });
  }
}

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


wss.on('connection', (ws) => {
  console.log('Nuevo cliente WebSocket conectado');
  
  ws.send(JSON.stringify({
    type: 'metadata-update',
    data: currentMetadata
  }));

  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
  });
});

if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}

server.listen(config.port, () => {
  console.log(`Servidor corriendo en: http://localhost:${config.port}`);
  startMetadataMonitor();
});