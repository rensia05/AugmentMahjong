const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const clients = new Map();
const rooms = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, clients: clients.size, rooms: rooms.size }));
    return;
  }

  const requested = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(data);
  });
});

server.on("upgrade", (req, socket) => {
  if (req.headers.upgrade?.toLowerCase() !== "websocket") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));

  const clientId = allocateClientId();
  clients.set(socket, { clientId, roomId: "" });
  send(socket, { type: "welcome", payload: { clientId } });

  socket.on("data", buffer => {
    const text = decodeFrame(buffer);
    if (!text) return;

    try {
      handleMessage(socket, JSON.parse(text));
    } catch (error) {
      send(socket, { type: "error", payload: { message: "Invalid message" } });
    }
  });

  socket.on("close", () => removeClient(socket));
  socket.on("error", () => removeClient(socket));
});

function handleMessage(socket, message) {
  if (message.type === "createRoom") {
    createRoom(socket, message.payload?.roomId);
    return;
  }

  if (message.type === "joinRoom") {
    joinRoom(socket, message.payload?.roomId);
    return;
  }

  if (message.type === "leaveRoom") {
    leaveRoom(socket);
    send(socket, { type: "leftRoom" });
    return;
  }

  if (message.type === "snapshot") {
    const room = getClientRoom(socket);
    if (!room) return;
    room.latestSnapshot = message.payload;
    broadcastRoom(socket, room, message);
    return;
  }

  const room = getClientRoom(socket);
  if (room) broadcastRoom(socket, room, message);
}

function createRoom(socket, requestedRoomId) {
  const roomId = normalizeRoomId(requestedRoomId) || generateRoomId();
  if (rooms.has(roomId)) {
    send(socket, { type: "error", payload: { message: "이미 존재하는 방 코드입니다." } });
    return;
  }

  rooms.set(roomId, {
    id: roomId,
    hostSocket: socket,
    clients: new Set(),
    latestSnapshot: null
  });
  joinRoom(socket, roomId);
}

function joinRoom(socket, requestedRoomId) {
  const roomId = normalizeRoomId(requestedRoomId);
  const room = rooms.get(roomId);
  if (!room) {
    send(socket, { type: "error", payload: { message: "존재하지 않는 방입니다." } });
    return;
  }

  leaveRoom(socket);
  room.clients.add(socket);
  clients.get(socket).roomId = roomId;
  if (!room.hostSocket || !clients.has(room.hostSocket)) room.hostSocket = socket;

  send(socket, {
    type: "room",
    payload: makeRoomPayload(room)
  });
  if (room.latestSnapshot) send(socket, { type: "snapshot", payload: room.latestSnapshot, clientId: "server" });
  broadcastRoster(room);
}

function leaveRoom(socket) {
  const room = getClientRoom(socket);
  if (!room) return;

  room.clients.delete(socket);
  const client = clients.get(socket);
  if (client) client.roomId = "";

  if (room.clients.size === 0) {
    rooms.delete(room.id);
    return;
  }

  if (room.hostSocket === socket) room.hostSocket = room.clients.values().next().value;
  broadcastRoster(room);
}

function removeClient(socket) {
  leaveRoom(socket);
  clients.delete(socket);
}

function allocateClientId() {
  const usedIds = new Set(Array.from(clients.values()).map(client => client.clientId));
  for (let index = 1; index <= 999; index += 1) {
    const clientId = `P${index}`;
    if (!usedIds.has(clientId)) return clientId;
  }
  return `P${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function broadcastRoom(sender, room, message) {
  room.clients.forEach(socket => {
    if (socket !== sender) send(socket, message);
  });
}

function broadcastRoster(room) {
  const message = {
    type: "roster",
    payload: makeRoomPayload(room)
  };
  room.clients.forEach(socket => send(socket, message));
}

function makeRoomPayload(room) {
  return {
    roomId: room.id,
    hostId: clients.get(room.hostSocket)?.clientId || "",
    clients: Array.from(room.clients).map(socket => clients.get(socket)?.clientId).filter(Boolean)
  };
}

function getClientRoom(socket) {
  const roomId = clients.get(socket)?.roomId;
  return roomId ? rooms.get(roomId) : null;
}

function send(socket, message) {
  const payload = Buffer.from(JSON.stringify(message));
  const header = payload.length < 126
    ? Buffer.from([0x81, payload.length])
    : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 255]);
  socket.write(Buffer.concat([header, payload]));
}

function normalizeRoomId(roomId) {
  return String(roomId || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16);
}

function generateRoomId() {
  let roomId = "";
  do {
    roomId = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(roomId));
  return roomId;
}

function decodeFrame(buffer) {
  const second = buffer[1];
  const lengthCode = second & 0x7f;
  let offset = 2;
  let length = lengthCode;

  if (lengthCode === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (lengthCode === 127) {
    return "";
  }

  const masked = Boolean(second & 0x80);
  const mask = masked ? buffer.slice(offset, offset + 4) : null;
  if (masked) offset += 4;

  const payload = buffer.slice(offset, offset + length);
  if (masked) {
    for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
  }
  return payload.toString("utf8");
}

server.listen(port, host, () => {
  console.log(`Augmented Mahjong room server: http://${host}:${port}`);
});
