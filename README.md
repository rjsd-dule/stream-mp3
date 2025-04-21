# Eternity Ready Radio Client

This is the client application for **Eternity Ready Radio**, designed to play an audio stream and update metadata in real time using WebSockets. The project is built with **Node.js**, utilizing `express` to serve the client and `ws` for WebSocket connections.

## Description

**Eternity Ready Radio Client** provides a dynamic interface for streaming live audio while simultaneously receiving metadata updates such as the currently playing track, artist information, and more. The client is lightweight, responsive, and optimized for real-time communication via WebSocket, ensuring an engaging user experience.

## Prerequisites

Before running the application, make sure you have the following installed:

- **Node.js**: Ensure a compatible version of Node.js is installed. You can check by running:
  ```bash
  node -v
  ```

- **npm**: Node.js package manager. Check with:
  ```bash
  npm -v
  ```

## Installation

Follow these steps to install and configure the project locally:

1. **Install dependencies**:

   ```bash
   npm install
   ```

## Configuration

Ensure that `config.json` is properly configured before running the app. Here's an example structure:

```json
{
  "port": 3000,
  "streamUrl": "https://azura.eternityready.com/listen/eternity_ready_radio/radio.mp3",
  "clientTitle": "Eternity Ready Radio Client",
  "proxyEndpoint": "/stream"
}
```

- `port`: Port on which the web server will run.
- `streamUrl`: The audio stream URL to be played.
- `clientTitle`: The title displayed on the client interface.
- `proxyEndpoint`: The endpoint used for streaming audio.

## Running the Application

1. **Start the server**:

   ```bash
   npm start
   ```

   The server will start on the port defined in `config.json` (default is `3000`).

2. **Access the client**:

   Open your browser and go to:

   ```
   http://localhost:3000
   ```

   The Eternity Ready Radio client interface should appear, and it will start receiving real-time metadata.

## Using PM2 for Deployment

To manage the app in production using **PM2**, make sure it is installed:

```bash
npm install pm2 -g
```

Start the app with the PM2 configuration file:

```bash
pm2 start pm2.config.json
```

### PM2 Configuration File (`pm2.config.json`)

```json
{
  "apps": [{
    "name": "mp3static_node",
    "script": "app.js",
    "instances": 1,
    "autorestart": true,
    "watch": false,
    "max_memory_restart": "500M",
    "env": {
      "NODE_ENV": "production",
      "PORT": 3000
    },
    "log_date_format": "YYYY-MM-DD HH:mm:ss",
    "error_file": "logs/error.log",
    "out_file": "logs/out.log",
    "merge_logs": true,
    "time": true
  }]
}
```

## File Structure

- **`config.json`**: Contains server and stream settings.
- **`package.json`**: Lists project dependencies like `express` and `ws`.
- **`pm2.config.json`**: Defines how PM2 will run the application in production.
- **`app.js`**: Main server file that initializes Express and WebSocket.
- **`metadataService.js`**: Manages and broadcasts metadata updates over WebSocket.

## WebSocket Functionality

- The server maintains a persistent WebSocket connection with connected clients.
- Metadata updates are sent from the server to all connected clients instantly.
- Clients automatically update the displayed information without needing to refresh the page.

---