const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const rooms = new Map();

function getRoomHash(roomKey) {
  return crypto.createHash('sha256').update(roomKey).digest('hex').slice(0, 16);
}

function broadcast(room, senderId, data) {
  if (!rooms.has(room)) return;
  const users = rooms.get(room).users;
  for (const [uid, user] of users) {
    if (uid !== senderId && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(JSON.stringify(data));
    }
  }
}

wss.on('connection', (ws) => {
  let userId = uuidv4();
  let userRoom = null;
  let userName = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join': {
        const { name, roomKey } = msg;
        if (!name || !roomKey) return;
        const room = getRoomHash(roomKey);
        if (rooms.has(room)) {
          const existing = rooms.get(room);
          if (existing.users.size >= 2) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room is full. Only 2 people allowed.' }));
            return;
          }
        } else {
          rooms.set(room, { users: new Map() });
        }
        userRoom = room;
        userName = name;
        rooms.get(room).users.set(userId, { ws, name, id: userId });
        const peers = [...rooms.get(room).users.values()]
          .filter(u => u.id !== userId)
          .map(u => ({ id: u.id, name: u.name }));
        ws.send(JSON.stringify({ type: 'joined', userId, peers, roomHash: room }));
        broadcast(room, userId, { type: 'peer_joined', peer: { id: userId, name } });
        break;
      }
      case 'message': {
        if (!userRoom) return;
        const id = uuidv4();
        broadcast(userRoom, userId, {
          type: 'message', id, from: userId, fromName: userName, text: msg.text, ts: Date.now()
        });
        ws.send(JSON.stringify({ type: 'message_ack', id: msg.id, serverId: id }));
        break;
      }
      case 'offer':
      case 'answer':
      case 'ice_candidate':
      case 'voice_message':
      case 'file_share':
      case 'dm_timer_change':
      case 'call_request':
      case 'call_accept':
      case 'call_reject':
      case 'call_end': {
        if (!userRoom) return;
        broadcast(userRoom, userId, { ...msg, from: userId, fromName: userName });
        break;
      }
      case 'typing': {
        if (!userRoom) return;
        broadcast(userRoom, userId, { type: 'typing', from: userId, isTyping: msg.isTyping });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (userRoom && rooms.has(userRoom)) {
      const room = rooms.get(userRoom);
      room.users.delete(userId);
      broadcast(userRoom, userId, { type: 'peer_left', peerId: userId });
      if (room.users.size === 0) rooms.delete(userRoom);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`DuoChat running at http://localhost:${PORT}`));