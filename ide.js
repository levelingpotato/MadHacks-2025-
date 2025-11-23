// ===============================
//  IDE + Judge0 Runner Script
//  Requires: index.html IDE section
//  Requires: running from a server (Live Server, etc.)
// ===============================

// Run once DOM is loaded
document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------------------
  // GAME SOCKET + ROOM INFO
  // ------------------------------------------
  const gameStateBox = document.getElementById("game-state");   // shows win/lose
  const roomLabel = document.getElementById("room-label");      // shows room + opponent

  let roomInfo = null;
  let gameSocket = null;

  const roomRaw = sessionStorage.getItem("cp_room_info");
  if (roomRaw) {
    try {
      roomInfo = JSON.parse(roomRaw);

      // Show room info under the title
      if (roomLabel) {
        roomLabel.textContent =
          `Room ${roomInfo.roomId} · You vs ${roomInfo.opponent}`;
      }

      // Open WebSocket for in-game messages
      gameSocket = new WebSocket("ws://localhost:4000");

      gameSocket.addEventListener("open", () => {
        // Tell server which room + who we are
        gameSocket.send(
          JSON.stringify({
            type: "joinRoom",
            roomId: roomInfo.roomId,
            username: roomInfo.me,
          })
        );
      });

      gameSocket.addEventListener("message", (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          console.error("Bad WS message:", event.data);
          return;
        }

        console.log("💬 WS message from server:", msg);

        // Server tells us the game result
        if (msg.type === "gameResult" && gameStateBox) {
          if (msg.result === "won") {
            gameStateBox.textContent = "🎉 You won!";
          } else if (msg.result === "lost") {
            gameStateBox.textContent = `😢 You lost. Winner: ${msg.winner}`;
          }
        }
      });


      gameSocket.addEventListener("close", () => {
        console.log("Game socket closed");
      });
    } catch (e) {
      console.error("Bad room info JSON:", e);
    }
  } else {
    if (roomLabel) {
      roomLabel.textContent = "Solo mode (no room).";
    }
  }



  // ------------------------------------------
  // Grab UI elements for the IDE
  // ------------------------------------------
  const languageSelect = document.getElementById("language");    // dropdown: Java/Python/C++
  const codeEditor = document.getElementById("code-editor");     // main code textarea
  const customInput = document.getElementById("custom-input");   // stdin input box
  const runButton = document.getElementById("run-code");         // run button

  // Output + status boxes
  const outputBox = document.getElementById("output");           // stdout
  const statusBox = document.getElementById("status");           // result status
  const errorsBox = document.getElementById("errors");           // compile/runtime errors

  const checkResultBox = document.getElementById("check-result");

  const showSolutionButton = document.getElementById("show-solution");

  // ------------------------------------------
  // Judge0 API endpoint
  // base64_encoded=false → normal text
  // wait=true → get result immediately
  // ------------------------------------------
  const JUDGE0_URL =
    "https://ce.judge0.com/submissions?base64_encoded=false&wait=true";

  // ------------------------------------------
  // TAB HANDLING IN EDITOR
  // ------------------------------------------
  codeEditor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault(); // stop focus change

      const start = codeEditor.selectionStart;
      const end = codeEditor.selectionEnd;
      const value = codeEditor.value;
      const indent = "    "; // 4 spaces (or "\t" if you prefer)

      // Insert indent at cursor, replacing any selected text
      codeEditor.value =
        value.substring(0, start) + indent + value.substring(end);

      // Move caret to just after the inserted indent
      codeEditor.selectionStart = codeEditor.selectionEnd = start + indent.length;
    }
  });


  // ============================================================
  // RUN CODE BUTTON — Sends code to Judge0
  // ============================================================
  runButton.addEventListener("click", async () => {


    if (showSolutionButton) {
      showSolutionButton.disabled = true;
    }


    // Grab the code, stdin, and language ID
    const source_code = codeEditor.value;
    const stdin = customInput.value;
    const language_id = Number(languageSelect.value);  // Judge0 uses numeric IDs

    // Prevent submitting empty code
    if (!source_code.trim()) {
      outputBox.textContent = "";
      statusBox.textContent = "No code to run.";
      errorsBox.textContent = "";
      return;
    }

    // Clear old output and show temporary message
    outputBox.textContent = "Running code...";
    statusBox.textContent = "";
    errorsBox.textContent = "";
    if (checkResultBox) checkResultBox.textContent = "";

    try {
      // ------------------------
      // Make POST request to Judge0
      // ------------------------
      const response = await fetch(JUDGE0_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          language_id,
          source_code,
          stdin
        })
      });

      if (!response.ok) {
        throw new Error("Bad response: " + response.status);
      }

      // Convert response to JSON
      const data = await response.json();

      // ------------------------
      // Display stdout
      // ------------------------
      outputBox.textContent = data.stdout || "";

      // ------------------------
      // Display execution status (Accepted, Time Limit, etc.)
      // ------------------------
      statusBox.textContent =
        (data.status && data.status.description) || "Unknown Status";

      // ------------------------
      // Collect compile/runtime errors
      // ------------------------
      let errorOutput = "";
      if (data.compile_output) {
        errorOutput += "Compile Error:\n" + data.compile_output + "\n\n";
      }
      if (data.stderr) {
        errorOutput += "Runtime Error:\n" + data.stderr + "\n";
      }

      errorsBox.textContent = errorOutput || "No errors";

      // ==================================================
      // CHECK AGAINST CURRENT PROBLEM'S SAMPLE TEST
      // ==================================================
      // ==================================================
      // CHECK AGAINST CURRENT PROBLEM'S SAMPLE TEST
      // ==================================================
      if (currentProblem && currentProblem.sampleInput && currentProblem.sampleOutput && checkResultBox) {
        const expectedInput = currentProblem.sampleInput.trim();
        const actualInput = (stdin || "").trim();

        // Only check if the user is using the sample input
        if (expectedInput === actualInput) {
          const expectedOut = currentProblem.sampleOutput.trim();
          const actualOut = (data.stdout || "").trim();

          // -----------------------------
          // 🔥 Replace THIS whole section
          // -----------------------------
          if (actualOut === expectedOut) {
            checkResultBox.textContent = "✅ Correct for sample test";

            console.log("✅ Sample correct!", {
              roomInfo,
              socketState: gameSocket && gameSocket.readyState,
            });

            // ⭐ Tell server we solved it (if we're in a room)
            if (
              roomInfo &&
              gameSocket &&
              gameSocket.readyState === WebSocket.OPEN
            ) {
              console.log("📤 Sending problemSolved to server...");
              gameSocket.send(
                JSON.stringify({
                  type: "problemSolved",
                  roomId: roomInfo.roomId,
                  username: roomInfo.me,
                  timestamp: Date.now(),
                })
              );
            } else {
              console.warn("⚠️ Not sending problemSolved: missing room/socket or not open", {
                roomInfo,
                socket: !!gameSocket,
                socketState: gameSocket && gameSocket.readyState,
              });
            }

          } else {
            checkResultBox.textContent =
              "❌ Incorrect for sample test\nExpected:\n" +
              expectedOut +
              "\n\nGot:\n" +
              actualOut;
          }
        } else {
          checkResultBox.textContent =
            "ℹ️ Sample check skipped (Custom Input does not match this problem's sample input).";
        }
      }



    } catch (err) {
      // Network or fetch error → show user
      outputBox.textContent = "";
      statusBox.textContent = "Request failed";
      errorsBox.textContent = err.message;
    } finally {
      if (showSolutionButton) {
        showSolutionButton.disabled = false;
      }
    }


  });
});
