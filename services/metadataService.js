const WebSocket = require('ws');
const config = require('../config');

const currentMetadata = {
  StreamTitle: '',
  artistName: '',
  title: '',
  program: 'Eternity Ready Radio',
  lastUpdated: Date.now()
};

function broadcast(data) {
  const message = JSON.stringify(data);
  global.wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}


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

module.exports = {
  currentMetadata,
  broadcast,
  updateMetadata
};

const startMetadataMonitor = require('./metadataMonitor');
module.exports = {
  currentMetadata,
  broadcast,
  updateMetadata,
  startMetadataMonitor: require('./metadataMonitor')
};