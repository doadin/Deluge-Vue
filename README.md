# Deluge-Vue

Deluge-Vue is a Vue 3 frontend for the Deluge torrent client, built to resemble the Deluge web UI while communicating with Deluge over its JSON-RPC API.

## Features

- Vue 3 + Vite frontend
- Proxy-based Deluge RPC access via `/api`
- Torrent list with status, progress, speed, ETA, and detailed stats
- Deluge actions: add, remove, pause, resume, and queue operations
- Preferences modal with download, network, queue, encryption, and daemon settings
- Session persistence to avoid repeated Deluge password prompts

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development mode:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Usage

- Open the app in your browser from the Vite server.
- Use the toolbar to manage torrents.
- Open `Preferences` to edit Deluge settings in a modal dialog.

## Deluge Integration

This project expects Deluge to be accessible through a proxy at `/api/json`, with the Deluge JSON-RPC backend available from the frontend via the configured proxy.

## Donate

If you like this project and want to support development, you can donate via PayPal:

[Donate to Deluge-Vue](https://paypal.me/doadin)

Or send directly to: `doadindonates@gmail.com`

<img width="1320" height="161" alt="image" src="https://github.com/user-attachments/assets/9cf670a5-c37c-43d4-bc9b-c721b26d79d8" />


## Notes

- The Deluge password is requested once per browser session and reused while the session is active.
- Some Deluge config fields may require Deluge server compatibility.
