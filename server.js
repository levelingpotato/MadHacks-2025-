// server.js
// Simple 1v1 matchmaking server using WebSocket (no socket.io)
const fs = require("fs");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 4000;

const rooms = new Map();

// Basic HTTP server (for health check / upgrade target)
const server = http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/homepage.html" : req.url;
  const filePath = path.join(__dirname, urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }

    // Infer Content-Type
    let type = "text/plain";
    if (filePath.endsWith(".html")) type = "text/html";
    if (filePath.endsWith(".css")) type = "text/css";
    if (filePath.endsWith(".js")) type = "application/javascript";

    res.writeHead(200, { "Content-Type": type });
    res.end(data);

  });
});

// Attach WebSocket server
const wss = new WebSocket.Server({ server });

// At most one waiting player at a time
// Format: { ws, username }
let waitingPlayer = null;

// Helper to send JSON messages
function send(ws, message) {
  ws.send(JSON.stringify(message));
}

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      console.error("Invalid JSON from client:", data.toString());
      return;
    }
    console.log("🔥 Message from client:", msg);


    // Handle `joinQueue` messages
    if (msg.type === "joinQueue") {
      const username = msg.username || "Guest";
      console.log(`${username} joined queue`);

      // If no one is waiting, mark this player as waiting
      if (!waitingPlayer) {
        waitingPlayer = { ws, username };
        send(ws, { type: "waiting" }); // tell them they're now waiting
        return;
      }

      const roomId = `room-${Date.now()}`;
      const player1 = waitingPlayer;
      const player2 = { ws, username };

      const payload = {
        type: "paired",
        roomId,
        players: [
          { username: player1.username },
          { username: player2.username }
        ]
      };

      send(player1.ws, payload);
      send(player2.ws, payload);

      console.log("Paired players in room:", roomId, {
        p1: player1.username,
        p2: player2.username
      });

      // ⭐ NEW: create room entry (initial sockets are waiting-page sockets)
      rooms.set(roomId, {
        winner: null,
        players: [
          { username: player1.username, sockets: new Set([player1.ws]) },
          { username: player2.username, sockets: new Set([player2.ws]) },
        ],
      });

      // Clear waiting slot
      waitingPlayer = null;

    }

    // --------------------------------------------------
    // Player joins a room from gamepage.html
    // --------------------------------------------------
    else if (msg.type === "joinRoom") {
      const { roomId, username } = msg;
      const room = rooms.get(roomId);
      if (!room) {
        send(ws, { type: "error", message: "Room not found" });
        return;
      }

      // remember on the socket
      ws.roomId = roomId;
      ws.username = username;

      // find or create player entry
      let player = room.players.find((p) => p.username === username);
      if (!player) {
        player = { username, sockets: new Set() };
        room.players.push(player);
      }
      player.sockets.add(ws);

      send(ws, { type: "joinedRoom", roomId });

      // if winner already decided before this socket joined, inform immediately
      if (room.winner) {
        const youWon = room.winner === username;
        send(ws, {
          type: "gameResult",
          result: youWon ? "won" : "lost",
          winner: room.winner,
        });
      }
    }

    // --------------------------------------------------
    // First solver wins: handle problemSolved
    // --------------------------------------------------
    else if (msg.type === "problemSolved") {
      const { roomId, username } = msg;
      const room = rooms.get(roomId);
      if (!room) {
        return;
      }

      // if no winner yet, this user becomes winner
      if (!room.winner) {
        room.winner = username;
        console.log(`Winner in ${roomId}: ${username}`);

        // notify everyone in room of result
        for (const player of room.players) {
          const youWon = player.username === username;
          for (const sock of player.sockets) {
            if (sock.readyState === WebSocket.OPEN) {
              send(sock, {
                type: "gameResult",
                result: youWon ? "won" : "lost",
                winner: username,
              });
            }
          }
        }
      } else {
        // someone already won; ignore further solves
        console.log(
          `Room ${roomId} already has winner ${room.winner}, ignoring solve by ${username}`
        );
      }
    }

  });

  ws.on("close", () => {
    console.log("Client disconnected");

    // If the waiting player disconnected, clear them
    if (waitingPlayer && waitingPlayer.ws === ws) {
      waitingPlayer = null;
    }

    if (ws.roomId && rooms.has(ws.roomId)) {
      const room = rooms.get(ws.roomId);
      for (const player of room.players) {
        if (player.sockets.has(ws)) {
          player.sockets.delete(ws);
        }
      }
    }

  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
});
