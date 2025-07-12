let socket = null;
    let socketInitialized = false;
    let connectionAttempts = 0;
    const maxRetries = 3;

    function loadSocketIOFallback() {
      console.warn('Socket.IO local falló, cargando desde CDN...');
      const fallbackScript = document.getElementById('socketio-fallback');
      fallbackScript.style.display = 'block';
      fallbackScript.onload = initializeSocket;
    }
    function initializeSocket() {
      if (socketInitialized) return;
      
      try {
       
        if (typeof io === 'undefined') {
          throw new Error('Socket.IO no está disponible');
        }

        socket = io({
          timeout: 10000,
          transports: ['websocket', 'polling'],
          autoConnect: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          maxReconnectionAttempts: maxRetries
        });

        // Listeners de eventos
        socket.on('connect', function() {
          console.log('Socket conectado exitosamente');
          socketInitialized = true;
          connectionAttempts = 0;
          showAlert('success', 'Connected to server', 2000);
        });

        socket.on('disconnect', function(reason) {
          console.log('Socket desconectado:', reason);
          socketInitialized = false;
          showAlert('error', 'Disconnected from server', 3000);
        });

        socket.on('connect_error', function(error) {
          console.error('Error de conexión:', error);
          connectionAttempts++;
          
          if (connectionAttempts >= maxRetries) {
            console.log('error', 'Unable to connect to server after multiple attempts', 5000);
          } else {
            console.log('error', `Connection attempt ${connectionAttempts}/${maxRetries} failed`, 2000);
          }
        });

        socket.on('stream-url-updated', function(newStreamUrl) {
          console.log('URL actualizada recibida:', newStreamUrl);
          showAlert('success', 'Stream URL updated: ' + newStreamUrl, 4000);
        });

        socket.on('reconnect', function(attemptNumber) {
          console.log('Reconectado después de', attemptNumber, 'intentos');
          showAlert('success', 'Reconnected to server', 2000);
        });

      } catch (error) {
        console.error('Error inicializando socket:', error);
        showAlert('error', 'Failed to initialize connection', 3000);
      }
    }

    // Inicializar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', function() {
      console.log('DOM cargado, inicializando socket...');
      
      setTimeout(() => {
        initializeSocket();
      }, 100);
    });

    async function updateStreamUrl() {
      const streamUrlInput = document.getElementById('streamUrl');
      const newStreamUrl = streamUrlInput.value.trim();
      
      if (!newStreamUrl) {
        showAlert('error', 'Please enter a valid URL', 3000);
        streamUrlInput.focus();
        return;
      }

      try {
        new URL(newStreamUrl);
      } catch (error) {
        showAlert('error', 'Please enter a valid URL format', 3000);
        streamUrlInput.focus();
        return;
      }

      const button = document.querySelector('button');
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Updating...';

      try {
        console.log('Enviando actualización de URL:', newStreamUrl);
        
        const response = await fetch('/api/update-stream-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newStreamUrl }),
          
          signal: AbortSignal.timeout(15000)
        });

        const data = await response.json().catch(() => ({}));
        
        if (response.ok) {
          console.log('URL updated successfully');
          showAlert('success', data.message || 'URL updated successfully', 3000);
          
          if (socket && socket.connected) {
            socket.emit('stream-url-updated', newStreamUrl);
            console.log(' Evento socket emitido');
          } else {
            console.warn('Socket no conectado, no se emitió evento');
          }
          
          // Limpiar input
          streamUrlInput.value = '';
          
        } else {
          console.error('Error del servidor:', data.message);
          showAlert('error', data.message || 'Error updating stream URL', 4000);
        }

      } catch (error) {
        console.error('Error de red:', error);
        
        if (error.name === 'TimeoutError') {
          showAlert('error', 'Request timeout - please try again', 4000);
        } else if (error.name === 'AbortError') {
          showAlert('error', 'Request cancelled - please try again', 4000);
        } else {
          showAlert('error', 'Network error - check your connection', 4000);
        }
      } finally {
        // Rehabilitar botón
        button.disabled = false;
        button.textContent = originalText;
      }
    }

    function showAlert(type, message, duration = 3000) {
      const alert = document.querySelector('.alert');
      
      // Limpiar clases anteriores
      alert.classList.remove('success', 'error');
      alert.classList.add(type);
      alert.textContent = message;
      alert.style.display = 'block';
      
      if (alert.hideTimeout) {
        clearTimeout(alert.hideTimeout);
      }
      
      alert.hideTimeout = setTimeout(() => {
        alert.style.display = 'none';
      }, duration);
    }

    window.addEventListener('error', function(event) {
      console.error('Error global:', event.error);
      if (event.error.message.includes('socket')) {
        showAlert('error', 'Connection error occurred', 3000);
      }
    });

    // Manejar tecla Enter en el input
    document.addEventListener('DOMContentLoaded', function() {
      const streamUrlInput = document.getElementById('streamUrl');
      streamUrlInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          updateStreamUrl();
        }
      });
    });