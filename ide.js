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
      gameSocket = new WebSocket("ws://10.141.254.52:4000");

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

      // FIX: Add a flag so we know if we failed
      let hasError = false;
      let errorOutput = "";

      if (data.compile_output) {
        hasError = true;
        errorOutput += "Compile Error:\n" + data.compile_output + "\n\n";

        // ROAST ON COMPILE ERROR (Mean Voice)
        const compile_insults = [
          "You suck at coding you loser! You don't deserve to be at Madhacks!",
          "You gotta be kidding me! 6 7",
          "How do you expect to win with this trash!",
        ]
        const compileInsult = compile_insults[Math.floor(Math.random() * compile_insults.length)];
        playRoast(compileInsult, "920944a3175541dcb1c4c2968f5c14f1");
      }

      // Use 'else if' so we don't play two errors at once
      else if (data.stderr) {
        hasError = true;
        errorOutput += "Runtime Error:\n" + data.stderr + "\n";
        // ROAST ON Runtime ERROR (Trump Voice)
        const runtime_insults = [
          "This is not good for the economy. We have to make computer science great again",
          "I don't like this code. This is very, very, bad",
          "I found 67 ways to make this code better.",
          "You are reminding me of Sleepy Joe, and that is very bad."
        ]
        const runtimeInsult = runtime_insults[Math.floor(Math.random() * runtime_insults.length)];
        // ROAST ON CRASH (Trump Voice)
        playRoast(runtimeInsult, "5196af35f6ff4a0dbf541793fc9f2157");
      }

      errorsBox.textContent = errorOutput || "No errors";

      // ==================================================
      // CHECK AGAINST CURRENT PROBLEM'S SAMPLE TEST
      // ==================================================

      // FIX: Only check the answer if there were NO errors (!hasError)
      if (!hasError && currentProblem && currentProblem.sampleInput && currentProblem.sampleOutput && checkResultBox) {
        const expectedInput = currentProblem.sampleInput.trim();
        const actualInput = (stdin || "").trim();

        // Only check if the user is using the sample input
        if (expectedInput === actualInput) {
          const expectedOut = currentProblem.sampleOutput.trim();
          const actualOut = (data.stdout || "").trim();

          if (actualOut === expectedOut) {
            checkResultBox.textContent = "✅ Correct for sample test";

            // WINNER ROAST (Energetic Voice)
            // ROAST ON Runtime ERROR (Trump Voice)
            const winner_insults = [
              "Lets go! Light work",
              "This was too easy, you need a harder challenge",
              "You finished quick! That was only 6 or 7 minutes!",
              "Congratulations, you did it!!"
            ]
            const winnerInsult = winner_insults[Math.floor(Math.random() * winner_insults.length)];
            playRoast(winnerInsult, "da8ae28bb18d4a1ca55eccf096f4c8da");

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
              console.warn("⚠️ Not sending problemSolved: missing room/socket or not open");
            }

          } else {
            checkResultBox.textContent =
              "❌ Incorrect for sample test\nExpected:\n" +
              expectedOut +
              "\n\nGot:\n" +
              actualOut;
            const wrong_insults = [
              "Wrong answer, you gotta lock in",
              "Nope, thats wrong",
              "Wrong wrong wrong",
              "That is definitely incorrect"
            ]
            const wrongInsult = wrong_insults[Math.floor(Math.random() * wrong_insults.length)];
            // WRONG ANSWER ROAST (Disappointed Voice)
            playRoast(wrongInsult, "933563129e564b19a115bedd57b7406a");

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

// Fish Audio Helper
async function playRoast(text, specifiedVoiceId) {
  // Use the IP of wherever your server is running
  const SERVER_URL = "http://localhost:4000/roast";

  try {
    const res = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId: specifiedVoiceId })
    });
    if (res.ok) {
      const blob = await res.blob();
      new Audio(URL.createObjectURL(blob)).play();
    }
  } catch (err) {
    console.log("Audio failed (server might be busy):", err);
  }
}