// radio-client.js
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const path = require('path');

// Configuration
const config = {
  port: 3030,
  streamUrl: "https://azura.eternityready.com/listen/eternity_ready_radio/radio.mp3",
  clientTitle: "Eternity Ready Radio Client",
  proxyEndpoint: "/stream-proxy"  // Nueva configuración para el endpoint proxy
};

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Middleware para conexiones persistentes
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=60');
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/stream', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Proxy transparente para el stream de radio
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
    // Reenviar todos los headers importantes
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
    
    // Pipe directo para máxima eficiencia
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

// Metadata endpoint (opcional, para mostrar en tu interfaz web)
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

// Metadata parser (solo para mostrar en tu web, no afecta al stream)
function updateMetadata(icyHeaders, metadataString) {
  if (metadataString) {
    const streamTitleMatch = metadataString.match(/StreamTitle='([^']*)'/);
    if (streamTitleMatch) {
      const streamTitle = streamTitleMatch[1];
      const separatorPos = streamTitle.indexOf(' - ');
      
      currentMetadata.StreamTitle = streamTitle;
      currentMetadata.artistName = separatorPos > -1 ? 
        streamTitle.slice(0, separatorPos).trim() : '';
      currentMetadata.title = separatorPos > -1 ? 
        streamTitle.slice(separatorPos + 3).trim() : streamTitle;
      currentMetadata.lastUpdated = Date.now();
    }
  }
  
  if (icyHeaders['icy-name']) {
    currentMetadata.program = icyHeaders['icy-name'];
  }
}

// Monitor de metadatos (separado del proxy para no afectar el stream)
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
      
      // Limitar tamaño del buffer
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

// Crear directorio público y archivos estáticos
if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}

// HTML con el reproductor que usa el proxy
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.clientTitle}</title>
    <style>
        /* Tus estilos existentes */
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f0f0f0; }
        .player-container { background-color: #fff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); padding: 20px; margin-bottom: 20px; }
        audio { width: 100%; margin: 20px 0; }
        /* Resto de tus estilos... */
    </style>
</head>
<body>
    <h1>${config.clientTitle}</h1>
    
    <div class="player-container">
        <h2>Live Stream</h2>
        <audio id="audio-player" controls autoplay>
            <source src="${config.proxyEndpoint}" type="audio/mpeg">
            Your browser does not support the audio element.
        </audio>
    </div>
    
    <div class="metadata-container">
        <h2>Now Playing</h2>
        <div class="now-playing">
            <span class="artist" id="artist">${currentMetadata.artistName || 'Loading...'}</span>
            <span> - </span>
            <span class="title" id="title">${currentMetadata.title || ''}</span>
        </div>
        <div class="program" id="program">${currentMetadata.program}</div>
        <div class="update-time" id="update-time">Last updated: ${new Date(currentMetadata.lastUpdated).toLocaleTimeString()}</div>
    </div>

    <script>
        // Actualización de metadatos
        async function updateMetadata() {
            try {
                const response = await fetch('/api/metadata');
                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('artist').textContent = data.artistName || 'Unknown Artist';
                    document.getElementById('title').textContent = data.title || 'Unknown Track';
                    document.getElementById('program').textContent = data.program || 'Eternity Ready Radio';
                    document.getElementById('update-time').textContent = 'Last updated: ' + new Date(data.lastUpdated).toLocaleTimeString();
                }
            } catch (error) {
                console.error('Error fetching metadata:', error);
            }
        }
        
        // Actualizar cada 5 segundos
        setInterval(updateMetadata, 5000);
        updateMetadata();
        
        // Configuración inicial del reproductor
        document.addEventListener('DOMContentLoaded', () => {
            const player = document.getElementById('audio-player');
            player.volume = 0.8;
        });
    </script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'public', 'index.html'), htmlContent);

// Iniciar servidor
server.listen(config.port, () => {
  console.log(`Servidor corriendo en http://localhost:${config.port}`);
  console.log(`Proxy de stream disponible en: http://localhost:${config.port}${config.proxyEndpoint}`);
  startMetadataMonitor();
});