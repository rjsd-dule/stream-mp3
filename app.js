const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

global.wss = wss;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=7200');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', require('./routes/apiRoutes'));
app.use('/', require('./routes/webRoutes'));
app.use('/', require('./routes/proxyRoutes'));

require('./services/metadataService').startMetadataMonitor();

if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}

server.listen(config.port, () => {
  console.log(`Servidor corriendo en: http://localhost:${config.port}`);
});