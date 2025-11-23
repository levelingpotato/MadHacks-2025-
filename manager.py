import asyncio
from fastapi import WebSocket
from typing import Dict

class RoomManager:
    def __init__(self):
        # Structure: { room_id: { client_id: WebSocket } }
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        self.active_games: Dict[str, dict] = {} 
        
        # Track ongoing disconnect timers to cancel them if user returns
        self.disconnect_timers: Dict[str, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket, room_id: str, client_id: str):
        await websocket.accept()
        
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
            
        # Update or Add the connection
        self.rooms[room_id][client_id] = websocket
        
        # If this user was "disconnecting", cancel the timer! They are back!
        timer_key = f"{room_id}_{client_id}"
        if timer_key in self.disconnect_timers:
            self.disconnect_timers[timer_key].cancel()
            del self.disconnect_timers[timer_key]
            # Notify everyone they are back
            await self.broadcast(room_id, {"type": "STATUS", "msg": "Opponent reconnected!"})

    async def handle_disconnect(self, room_id: str, client_id: str):
        """Start a grace period timer. If they don't return, kill the room."""
        
        # 1. Remove the socket object (it's dead) but KEEP the client_id entry
        if room_id in self.rooms and client_id in self.rooms[room_id]:
            del self.rooms[room_id][client_id]

        # 2. Notify opponent
        await self.broadcast(room_id, {
            "type": "STATUS", 
            "msg": "Opponent disconnected. Waiting 15s..."
        })

        # 3. Start the Countdown (Non-blocking)
        task = asyncio.create_task(self._wait_and_kill(room_id, client_id))
        self.disconnect_timers[f"{room_id}_{client_id}"] = task

    async def _wait_and_kill(self, room_id: str, client_id: str):
        try:
            # The Grace Period
            await asyncio.sleep(15) 
            
            # If we reach here, the user didn't reconnect.
            # Check if the room still exists and user is still missing
            if room_id in self.rooms and client_id not in self.rooms[room_id]:
                await self.broadcast(room_id, {"type": "OPPONENT_LEFT"})
                
                # Clean up
                if room_id in self.rooms:
                    del self.rooms[room_id]
                if room_id in self.active_games:
                    del self.active_games[room_id]
                    
        except asyncio.CancelledError:
            # Timer was cancelled because user reconnected. Do nothing.
            pass

    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.rooms:
            # Iterate over values (WebSockets)
            for ws in self.rooms[room_id].values():
                try:
                    await ws.send_json(message)
                except:
                    pass
    
    def get_player_count(self, room_id: str):
        # We count the 'keys' (client_ids) in the dictionary
        return len(self.rooms.get(room_id, {}))

    def set_game(self, room_id: str, problem: dict):
        self.active_games[room_id] = problem

    def get_game(self, room_id: str):
        return self.active_games.get(room_id)

manager = RoomManager()