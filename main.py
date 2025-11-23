import random
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from services import fetch_problem, run_code_sync, PROBLEM_CONFIGS
from manager import manager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# Only load problems that we have Configs for
TARGET_SLUGS = list(PROBLEM_CONFIGS.keys())
PROBLEMS = {}

@app.on_event("startup")
def startup_event():
    print("--- 🚀 LOADING QUESTIONS ---")
    for slug in TARGET_SLUGS:
        p = fetch_problem(slug)
        if p: 
            PROBLEMS[slug] = p
            print(f"✅ Loaded: {p['title']}")

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    await manager.connect(websocket, room_id, client_id)
    
    if manager.get_player_count(room_id) > 2:
        await websocket.send_json({"type": "ERROR", "msg": "Room Full"})
        await websocket.close()
        return

    try:
        # 1. Send Existing Game
        existing_game = manager.get_game(room_id)
        if existing_game:
            await websocket.send_json({"type": "PROBLEM_START", "payload": existing_game})
        
        # 2. Sync Logic
        count = manager.get_player_count(room_id)
        if count == 1:
            await websocket.send_json({"type": "WAITING"})
        elif count == 2 and not existing_game:
            # Start Game
            slug = random.choice(list(PROBLEMS.keys()))
            manager.set_game(room_id, PROBLEMS[slug])
            await manager.broadcast(room_id, {
                "type": "PROBLEM_START", 
                "payload": manager.get_game(room_id)
            })

        # 3. Loop
        while True:
            data = await websocket.receive_json()
            problem = manager.get_game(room_id)

            if data.get("action") == "SUBMIT_CODE" and problem:
                await manager.broadcast(room_id, {"type": "STATUS", "msg": "Opponent running code..."})
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, run_code_sync, data["code"], problem)
                await websocket.send_json({"type": "SUBMISSION_RESULT", "payload": result})
                
                # Win Condition: All Tests Passed
                if "tests" in result and all(t["passed"] for t in result["tests"]):
                     await manager.broadcast(room_id, {"type": "GAME_OVER", "winner": "Player Won!"})

    except WebSocketDisconnect:
        await manager.handle_disconnect(room_id, client_id)