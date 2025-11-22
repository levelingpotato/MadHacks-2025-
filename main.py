import json
import requests
import re
import random
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List

app = FastAPI()

# --- CONFIGURATION ---
# 1. CORS: Allow all origins so Frontend can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. TARGET PROBLEMS
# We stick to simple array/math problems for reliable parsing
TARGET_SLUGS = [
    "two-sum",
    "contains-duplicate",
    "valid-anagram",
    "missing-number",
    "single-number",
    "fizz-buzz",
    "palindrome-number"
]

# --- GLOBAL STATE ---
rooms: Dict[str, List[WebSocket]] = {}
active_games: Dict[str, dict] = {} # Stores { "room_id": problem_object }
PROBLEMS = {} # Stores loaded problems { "slug": problem_object }

# --- HELPER: FETCH FROM API ---
def fetch_leetcode_problem(title_slug):
    print(f"🔍 Fetching: {title_slug}...")
    url = f"https://alfa-leetcode-api.onrender.com/select?titleSlug={title_slug}"
    
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return None
            
        data = resp.json()
        
        question_html = data.get("question", "")
        title = data.get("questionTitle", "Unknown")
        
        # 1. Extract Input (Heuristic: First 2 lines of examples)
        raw_examples = data.get("exampleTestcases", "")
        # Clean up empty lines
        input_lines = [line for line in raw_examples.split("\n") if line.strip()]
        judge0_input = "\n".join(input_lines[:2]) 

        # 2. Extract Output (Regex Hunt)
        # Looks for "Output:</strong> <span ...> [0,1] </span>"
        output_match = re.search(r"Output:?</strong>\s*<span[^>]*>([^<]+)</span>", question_html)
        if not output_match:
             output_match = re.search(r"Output:?</strong>\s*([^<]+)", question_html)
        
        judge0_output = output_match.group(1).strip() if output_match else ""
        
        if not judge0_output:
            print(f"⚠️ Skipping {title_slug}: No output found.")
            return None

        # 3. Create UI Example String
        ui_example = f"Input:\n{judge0_input}\n\nOutput:\n{judge0_output}"

        return {
            "slug": title_slug,
            "title": title,
            "description": question_html,
            "solution": f"# Write your solution for {title} here:\n\n",
            "input": judge0_input,
            "output": judge0_output,
            "example": ui_example
        }
    except Exception as e:
        print(f"❌ Error fetching {title_slug}: {e}")
        return None

# --- HELPER: JUDGE CODE ---
def run_code_public(code, problem):
    # Public Judge0 URL (No API Key needed)
    url = "https://ce.judge0.com/submissions?base64_encoded=false&wait=true"
    
    payload = {
        "source_code": code,
        "language_id": 71, # 71 is Python (3.8.1)
        "stdin": problem["input"],
        "expected_output": problem["output"]
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        return response.json()
    except Exception as e:
        print(f"Judge0 Connection Error: {e}")
        return {
            "status": {"id": 6, "description": "Runtime Error"},
            "stderr": "Could not contact Judge0 server."
        }

# --- HELPER: BROADCAST ---
async def broadcast_to_room(room_id: str, message: dict):
    if room_id in rooms:
        # Create a copy of the list to avoid modification errors during iteration
        for connection in list(rooms[room_id]):
            try:
                await connection.send_json(message)
            except RuntimeError:
                pass # Connection might have closed

# --- SERVER STARTUP ---
@app.on_event("startup")
def startup_event():
    print("--- 🚀 STARTING SERVER & FETCHING QUESTIONS ---")
    for slug in TARGET_SLUGS:
        p = fetch_leetcode_problem(slug)
        if p:
            PROBLEMS[slug] = p
            print(f"✅ Loaded: {p['title']}")
    
    if not PROBLEMS:
        print("⚠️ WARNING: No questions loaded. Using Fallback.")
        PROBLEMS["two-sum"] = {
            "title": "Two Sum (Backup)",
            "description": "<p>Find two numbers that add up to target.</p>",
            "solution": "# Backup mode",
            "input": "2\n7\n11\n15\n9",
            "output": "[0, 1]",
            "example": "Input: ... Output: [0,1]"
        }

# --- ROUTES ---
@app.get("/")
def health_check():
    return {
        "status": "running", 
        "questions_loaded": len(PROBLEMS), 
        "active_rooms": len(active_games)
    }

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    
    # 1. Join Room
    if room_id not in rooms:
        rooms[room_id] = []
    rooms[room_id].append(websocket)
    print(f"User joined {room_id}. Users: {len(rooms[room_id])}")

    try:
        # 2. SYNC GAME STATE (The Critical Fix)
        # If this room has no active game, assign one now.
        if room_id not in active_games:
            # Pick random problem ID
            random_slug = random.choice(list(PROBLEMS.keys()))
            active_games[room_id] = PROBLEMS[random_slug]
            print(f"Room {room_id} assigned problem: {random_slug}")
        
        # Get the problem assigned to THIS room
        current_problem = active_games[room_id]

        # 3. Send Problem to the new user
        await websocket.send_json({
            "type": "PROBLEM_START", 
            "payload": current_problem
        })

        # 4. Game Loop
        while True:
            data = await websocket.receive_json()
            
            if data.get("action") == "SUBMIT_CODE":
                code = data.get("code")
                
                # Notify opponent
                await broadcast_to_room(room_id, {"type": "STATUS", "msg": "Opponent is running code..."})
                
                # Execute Code
                result = run_code_public(code, current_problem)
                
                # Send result back to sender
                await websocket.send_json({
                    "type": "SUBMISSION_RESULT", 
                    "payload": result
                })
                
                # Check Win (Status 3 = Accepted)
                if result.get("status", {}).get("id") == 3:
                    await broadcast_to_room(room_id, {
                        "type": "GAME_OVER", 
                        "winner": "Player won!" 
                    })

    except WebSocketDisconnect:
        print(f"User left {room_id}")
        if room_id in rooms:
            rooms[room_id].remove(websocket)
            # Optional: If room is empty, clear the game state so next users get a new question
            if not rooms[room_id]:
                del rooms[room_id]
                if room_id in active_games:
                    del active_games[room_id]
                    print(f"Room {room_id} closed. Game state reset.")