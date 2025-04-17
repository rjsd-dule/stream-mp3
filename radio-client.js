const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const path = require('path');
const { Server } = require('socket.io');

const config = {
  port: 3000,
  streamUrl: "https://azura.eternityready.com/listen/eternity_ready_radio/radio.mp3",
  clientTitle: "Eternity Ready Radio Client",
  proxyEndpoint: "/stream"
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=60');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/stream-proxy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(config.proxyEndpoint, (req, res) => {
  const isHttps = config.streamUrl.startsWith('https');
  const requestLib = isHttps ? https : http;

  console.log(`Nueva conexión proxy al stream: ${config.streamUrl}`);

  const forwardRequest = requestLib.get(config.streamUrl, {
    headers: {
      'Icy-MetaData': '1',
      'User-Agent': 'EternityReadyRadioProxy/1.0'
    }
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

  forwardRequest.on('error', (err) => {
    console.error('Error en proxy:', err);
    if (!res.headersSent) {
      res.status(502).send('Proxy error');
    }
    res.end();
  });

  req.on('close', () => {
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
        io.emit("metadata-update", currentMetadata);
        updated = true;
      }
    }
  }

  if (!updated && icyHeaders['icy-name'] && icyHeaders['icy-name'] !== currentMetadata.program) {
    currentMetadata.program = icyHeaders['icy-name'];
    currentMetadata.lastUpdated = Date.now();
    io.emit("metadata-update", currentMetadata);
  }
}

function startMetadataMonitor() {
  console.log(`Iniciando monitor de metadatos: ${config.streamUrl}`);

  const isHttps = config.streamUrl.startsWith('https');
  const requestLib = isHttps ? https : http;

  const request = requestLib.get(config.streamUrl, {
    headers: {
      'Icy-MetaData': '1',
      'User-Agent': 'EternityReadyRadioMetadataMonitor/1.0'
    }
  }, (response) => {
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
      console.log('Conexión de metadatos cerrada, reconectando...');
      setTimeout(startMetadataMonitor, 5000);
    });
  });

  request.on('error', (err) => {
    console.error('Error en monitor de metadatos:', err);
    setTimeout(startMetadataMonitor, 5000);
  });
}

io.on('connection', (socket) => {
  console.log('Cliente conectado vía socket.io');
  socket.emit('metadata-update', currentMetadata);

  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}

// ✅ LÍNEA CLAVE PARA INICIAR EL SERVIDOR Y EL MONITOR
server.listen(config.port, () => {
  console.log(`01 - Servidor corriendo en http://localhost:${config.port}`);
  startMetadataMonitor();
});
