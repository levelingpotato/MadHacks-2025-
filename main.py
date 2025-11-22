import json
import requests
import re
import random  # <--- NEW: Needed to pick random questions
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rooms: Dict[str, List[WebSocket]] = {}
PROBLEMS = {}

# --- LIST OF QUESTIONS TO FETCH ---
# We stick to Arrays/Strings because Linked Lists/Trees are hard 
# to parse from standard input in a hackathon setting.
TARGET_SLUGS = [
    "two-sum",
    "contains-duplicate",
    "valid-anagram",
    "missing-number",
    "single-number"
]

def fetch_leetcode_problem(title_slug):
    url = f"https://alfa-leetcode-api.onrender.com/select?titleSlug={title_slug}"
    print(f"Fetching {title_slug}...")
    
    try:
        resp = requests.get(url)
        data = resp.json()
        
        question_html = data.get("question", "")
        title = data.get("questionTitle", "Unknown")
        
        # Extract Input (First 2 lines usually work for these problems)
        raw_examples = data.get("exampleTestcases", "")
        test_input = "\n".join(raw_examples.split("\n")[:2]) 

        # Extract Output via Regex
        output_match = re.search(r"Output:?</strong>\s*<span[^>]*>([^<]+)</span>", question_html)
        if not output_match:
             output_match = re.search(r"Output:?</strong>\s*([^<]+)", question_html)
        test_output = output_match.group(1).strip() if output_match else "[]"
        
        return {
            "slug": title_slug,
            "title": title,
            "description": question_html,
            "test_input": test_input,
            "test_output": test_output
        }
    except Exception as e:
        print(f"Failed to fetch {title_slug}: {e}")
        return None

@app.on_event("startup")
def load_problems():
    print("--- STARTING PROBLEM FETCH ---")
    for slug in TARGET_SLUGS:
        problem = fetch_leetcode_problem(slug)
        if problem:
            PROBLEMS[slug] = problem
            print(f"✅ Loaded: {problem['title']}")
    print(f"--- LOADED {len(PROBLEMS)} QUESTIONS ---")

@app.get("/")
def health_check():
    return {"status": "active", "loaded_questions": list(PROBLEMS.keys())}

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    if room_id not in rooms: rooms[room_id] = []
    rooms[room_id].append(websocket)
    
    try:
        # --- RANDOM PROBLEM SELECTION ---
        # If problems exist, pick a random one. Otherwise use fallback.
        if PROBLEMS:
            selected_key = random.choice(list(PROBLEMS.keys()))
            current_problem = PROBLEMS[selected_key]
        else:
            current_problem = {
                "title": "Two Sum (Backup)",
                "description": "API Failed. Using Backup.",
                "test_input": "2\n7\n11\n15\n9",
                "test_output": "[0, 1]"
            }

        await websocket.send_json({
            "type": "PROBLEM_START", 
            "payload": current_problem
        })

        while True:
            data = await websocket.receive_json()
            if data.get("action") == "SUBMIT_CODE":
                code = data.get("code")
                # Notify others
                await broadcast_to_room(room_id, {"type": "STATUS", "msg": "Opponent is running code..."})
                
                # Validate against the SELECTED problem
                result = run_code_public(code, current_problem)
                
                await websocket.send_json({"type": "SUBMISSION_RESULT", "payload": result})
                
                if result.get("status", {}).get("id") == 3:
                    await broadcast_to_room(room_id, {"type": "GAME_OVER", "winner": "Player won!"})

    except WebSocketDisconnect:
        rooms[room_id].remove(websocket)
        if not rooms[room_id]: del rooms[room_id]

async def broadcast_to_room(room_id: str, message: dict):
    if room_id in rooms:
        for cx in rooms[room_id]: await cx.send_json(message)

def run_code_public(code, problem):
    url = "https://ce.judge0.com/submissions?base64_encoded=false&wait=true"
    payload = {
        "source_code": code,
        "language_id": 71, 
        "stdin": problem["test_input"],
        "expected_output": problem["test_output"]
    }
    try:
        return requests.post(url, json=payload, headers={"Content-Type": "application/json"}).json()
    except:
        return {"status": {"id": 6}, "stderr": "Judge0 Error"}