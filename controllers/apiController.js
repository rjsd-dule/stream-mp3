const config = require('../config');
const metadataService = require('../services/metadataService');

let currentStreamUrl = config.streamUrl;

exports.updateStreamUrl = async (req, res) => {
  try {
    const { newStreamUrl } = req.body;
    if (!newStreamUrl) {
      return res.status(400).json({ message: 'URL no proporcionada' });
    }

    const cleanedUrl = newStreamUrl.trim();
    console.log('URL actual:', currentStreamUrl);
    console.log('URL nueva recibida:', cleanedUrl);
    console.log('¿Son iguales?', cleanedUrl === currentStreamUrl.trim());

    if (cleanedUrl !== currentStreamUrl.trim()) {
      currentStreamUrl = cleanedUrl;
      metadataService.broadcast({ type: 'stream-url-updated', url: cleanedUrl });
      res.json({ error:false,message: 'URL actualizada correctamente' });
    } else {
      res.status(400).json({ message: 'URL no válida o sin cambios' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar URL' });
  }
};

exports.getCurrentStreamUrl = () => {
  return currentStreamUrl;
}

exports.getMetadata = (req, res) => {
  res.json(metadataService.currentMetadata);
};