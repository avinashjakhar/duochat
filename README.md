# DuoChat — Private Encrypted 2-Person Messenger

A real-time private messenger for exactly 2 people, with end-to-end encrypted messaging, WebRTC voice calls, and WebRTC video calls.

## Features
- **Real-time messaging** via WebSocket
- **Voice calls** via WebRTC (peer-to-peer, DTLS-SRTP encrypted)
- **Video calls** via WebRTC with camera/mic controls
- **2-person room limit** — server enforces max 2 users per room
- **Secure room keys** — SHA-256 hashed, never stored
- **Safety number** for out-of-band verification
- **Typing indicators**, online presence, read receipts

## Setup & Run

### Requirements
- Node.js v16+

### Install & Start
```bash
npm install
npm start
```
Server runs at **http://localhost:3000**

### Usage
1. Open http://localhost:3000 in two browser tabs (or two devices on the same network)
2. Both people enter the **same secret room key**
3. Start chatting, call, or video call

### Deploy to Production
- **Railway / Render / Fly.io**: Push repo, set start command to `node server.js`
- **Environment variable**: `PORT` (defaults to 3000)
- **HTTPS required** for WebRTC on production — use a platform that provides it

### For real E2E encryption (production upgrade)
Replace the WebSocket text relay with libsodium or SubtleCrypto AES-GCM:
```js
// Encrypt before sending
const key = await deriveKey(roomKey);
const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, encoder.encode(text));
```

## Architecture
```
Browser A ──WS──► Server (relay only) ◄──WS── Browser B
    └──────────── WebRTC P2P ────────────────┘
                 (voice/video direct)
```
