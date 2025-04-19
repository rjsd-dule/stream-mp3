const config = require('../config');
const metadataService = require('../services/metadataService');

let currentStreamUrl = config.streamUrl;

exports.updateStreamUrl = async (req, res) => {
  try {
    const { newStreamUrl } = req.body;
    if (newStreamUrl && newStreamUrl !== currentStreamUrl) {
      currentStreamUrl = newStreamUrl;
      metadataService.broadcast({ type: 'stream-url-updated', url: newStreamUrl });
      res.json({ message: 'URL actualizada correctamente' });
    } else {
      res.status(400).json({ message: 'URL no válida o sin cambios' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar URL' });
  }
};

exports.getMetadata = (req, res) => {
  res.json(metadataService.currentMetadata);
};