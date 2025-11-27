# Copilot Instructions for Blackjack Multiplayer

## Project Overview
A real-time multiplayer blackjack game using Express.js and Socket.IO. Single HTML page with vanilla JS client-side logic and WebSocket server for game coordination.

## Architecture

### Backend (`server.js`)
- **Express** serves static files from `public/`
- **Socket.IO** manages player connections and real-time events
- **Port**: 3000 (configurable via `PORT` env var)
- Key socket events: `connection`, `disconnect`
- Minimal game logic — mostly relays client actions

### Frontend (`public/`)
- `index.html` — Game UI (empty, needs implementation)
- `client.js` — Client-side logic (empty, needs Socket.IO client init)
- `style.css` — Styling (empty)

## Critical Patterns & Conventions

1. **Socket.IO Communication**: All real-time updates use Socket.IO events, not HTTP
   - Server listens: `io.on('connection')` in `server.js`
   - Client sends: `socket.emit('eventName', data)` from `client.js`

2. **Static Assets**: All files in `public/` auto-served; referenced from HTML without `/public/` prefix
   - HTML: `<script src="client.js"></script>` (not `public/client.js`)

3. **Game State**: Currently centralized on server (see `server.js` socket handlers)
   - No persistent DB; state resets on server restart

4. **Player ID**: Socket.ID used as unique player identifier (`socket.id`)

## Development Workflow

### Build & Run
```bash
npm install          # Install dependencies (Express, Socket.IO)
PORT=3000 npm start  # Start server on port 3000
```

### Testing
- No automated tests yet
- Manual: Open `http://localhost:3000` in browser; check browser console for client errors

### Port Forwarding (Dev Container/Codespaces)
- If using VS Code Dev Container: Open VS Code `Ports` panel → forward port 3000 to local machine
- Command: Ctrl+Shift+P → "Forward a Port" → enter 3000

## Common Tasks

- **Add new Socket.IO event**: 
  1. Define handler in `server.js`: `socket.on('eventName', (data) => { ... })`
  2. Trigger from `client.js`: `socket.emit('eventName', payload)`

- **Update UI**: Edit `public/index.html` and `public/style.css`; changes auto-served

- **Debug Socket issues**: 
  - Server: Check console logs in terminal running `npm start`
  - Client: Browser DevTools → Console tab; Socket.IO debug: `localStorage.debug = '*'` in browser console

## Key Files Reference
- `server.js` — Entry point; Express + Socket.IO setup
- `public/index.html` — Main game page
- `public/client.js` — Client-side Socket.IO initialization
- `package.json` — Dependencies: Express, Socket.IO

## External Dependencies
- **Express** (v5.1.0) — Web framework
- **Socket.IO** (v4.8.1) — Real-time bidirectional communication

---
**Last Updated**: Nov 27, 2025
