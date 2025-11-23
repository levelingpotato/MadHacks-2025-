// server.js
// Simple 1v1 matchmaking server using WebSocket (no socket.io)

const http = require("http");
const WebSocket = require("ws");

// 🔒 API KEY CONFIG
const FISH_API_KEY = "cef17dd157d144a1b0bdb1a61c39d1a6";
const PORT = process.env.PORT || 4000;

const rooms = new Map();

// ==========================================
// 1. HTTP Server (Handles Roasts + Handshake)
// ==========================================
const server = http.createServer(async (req, res) => {
  
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Pre-flight check
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Roast Endpoint
  if (req.url === "/roast" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    
    req.on("end", async () => {
      try {
        // 🔴 FIX: Read voiceId from request
        const { text, voiceId } = JSON.parse(body);
        
        // Call Fish Audio
        const apiRes = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FISH_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: text,
            // 🔴 FIX: Use the specific ID if sent, else default
            reference_id: voiceId || "802e3bc2b27e49c2995d23ef70e6ac89", 
            format: "mp3",
            mp3_bitrate: 64,
            latency: "balanced"
          })
        });

        if (!apiRes.ok) {
           console.error("Fish API Error:", apiRes.status);
           res.writeHead(apiRes.status);
           res.end();
           return;
        }

        const audioBuffer = await apiRes.arrayBuffer();
        res.writeHead(200, { "Content-Type": "audio/mpeg" });
        res.end(Buffer.from(audioBuffer));

      } catch (err) {
        console.error("Server Error:", err);
        res.writeHead(500);
        res.end();
      }
    });
    return;
  }

  res.writeHead(200);
  res.end("WebSocket matchmaking server is running.\n");
});

// ==========================================
// 2. WebSocket Server (Matchmaking Logic)
// ==========================================
const wss = new WebSocket.Server({ server });
let waitingPlayer = null;

function send(ws, message) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch (e) { return; }

    if (msg.type === "joinQueue") {
      const username = msg.username || "Guest";
      
      if (!waitingPlayer) {
        waitingPlayer = { ws, username };
        send(ws, { type: "waiting" });
      } else {
        const roomId = `room-${Date.now()}`;
        const p1 = waitingPlayer;
        const p2 = { ws, username };

        const payload = { type: "paired", roomId, players: [{ username: p1.username }, { username: p2.username }] };
        send(p1.ws, payload);
        send(p2.ws, payload);

        rooms.set(roomId, {
          winner: null,
          players: [
            { username: p1.username, sockets: new Set([p1.ws]) },
            { username: p2.username, sockets: new Set([p2.ws]) },
          ],
        });
        waitingPlayer = null;
      }
    } 
    else if (msg.type === "joinRoom") {
      const { roomId, username } = msg;
      ws.roomId = roomId;
      const room = rooms.get(roomId);
      if (room) {
        let player = room.players.find((p) => p.username === username);
        if (!player) { player = { username, sockets: new Set() }; room.players.push(player); }
        player.sockets.add(ws);
        send(ws, { type: "joinedRoom", roomId });
        if (room.winner) {
            send(ws, { type: "gameResult", result: room.winner === username ? "won" : "lost", winner: room.winner });
        }
      }
    }
    else if (msg.type === "problemSolved") {
      const { roomId, username } = msg;
      const room = rooms.get(roomId);
      if (room && !room.winner) {
        room.winner = username;
        for (const player of room.players) {
          const youWon = player.username === username;
          for (const sock of player.sockets) send(sock, { type: "gameResult", result: youWon ? "won" : "lost", winner: username });
        }
      }
    }
  });

  ws.on("close", () => {
    if (waitingPlayer && waitingPlayer.ws === ws) waitingPlayer = null;
    if (ws.roomId && rooms.has(ws.roomId)) {
        const room = rooms.get(ws.roomId);
        if (room) room.players.forEach(p => p.sockets.delete(ws));
    }
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
});