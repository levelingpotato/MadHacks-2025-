import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import "./App.css"; 

function App() {
  // --- STATE ---
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState("room-1"); 
  const [isConnected, setIsConnected] = useState(false);
  
  // Game Data
  const [problem, setProblem] = useState(null);
  const [code, setCode] = useState("# Write your Python solution here...\n");
  const [output, setOutput] = useState("Click 'Run Code' to see results.");
  const [status, setStatus] = useState(""); 
  const [isWinner, setIsWinner] = useState(false);

  // --- 1. CONNECT TO BACKEND ---
  useEffect(() => {
    // Connect to your local Python server
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${roomId}`);

    ws.onopen = () => {
      console.log("Connected to backend");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case "PROBLEM_START":
          setProblem(data.payload);
          setOutput("New problem loaded.");
          setIsWinner(false);
          break;

        case "STATUS":
          setStatus(data.msg);
          setTimeout(() => setStatus(""), 3000); // Hide after 3s
          break;

        case "SUBMISSION_RESULT":
          const res = data.payload;
          if (res.stderr) {
            setOutput(`❌ Error:\n${res.stderr}`);
          } else if (res.compile_output) {
            setOutput(`❌ Compilation Error:\n${res.compile_output}`);
          } else {
            setOutput(`✅ Output:\n${res.stdout || "No output printed"}`);
          }
          break;

        case "GAME_OVER":
          alert(`🏆 GAME OVER! ${data.winner}`);
          setIsWinner(true);
          break;
      }
    };

    ws.onclose = () => setIsConnected(false);
    setSocket(ws);

    return () => ws.close();
  }, [roomId]);

  // --- 2. RUN CODE FUNCTION ---
  const runCode = () => {
    if (!socket) return;
    setOutput("Running on Judge0...");
    
    // Send the code to Python
    socket.send(JSON.stringify({
      action: "SUBMIT_CODE",
      code: code,
      language_id: 71 // Python
    }));
  };

  // --- 3. RENDER THE UI ---
  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="header">
        <div className="logo">🔥 1v1 Code Arena</div>
        <div className="status-badge">
          <span className={`dot ${isConnected ? "green" : "red"}`}></span>
          {isConnected ? "Connected" : "Disconnected"}
        </div>
      </header>

      <div className="main-content">
        {/* LEFT PANEL: Problem Description */}
        <div className="panel left-panel">
          {problem ? (
            <>
              <h2 className="problem-title">{problem.title}</h2>
              {/* Renders the HTML we fetched from the API */}
              <div 
                className="problem-desc"
                dangerouslySetInnerHTML={{ __html: problem.description }} 
              />
              
              <div className="example-box">
                <strong>Test Input:</strong>
                <pre>{problem.test_input}</pre>
              </div>
            </>
          ) : (
            <div className="loading">Fetching Problem...</div>
          )}
        </div>

        {/* RIGHT PANEL: Code Editor & Console */}
        <div className="panel right-panel">
          <div className="editor-wrapper">
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val)}
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </div>

          <div className="console-wrapper">
            <div className="console-header">
              <button className="run-btn" onClick={runCode} disabled={isWinner}>
                ▶ Run Code
              </button>
              {status && <span className="status-text">⚠️ {status}</span>}
            </div>
            <div className="console-output">
              {output}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;