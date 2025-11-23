// ===============================
//  PROBLEM PICKER SCRIPT (v1)
//  Handles: selecting difficulty,
//  picking a random problem, and
//  displaying the description.
//
//  NOTE: Assumes problems.js is
//  loaded BEFORE this file.
// ===============================

let currentProblem = null;  // Holds the currently loaded problem

// Run JS ONLY after the HTML document is fully loaded
document.addEventListener("DOMContentLoaded", () => {

  const username = sessionStorage.getItem("cp_username");
  if (username) {
    document.getElementById("player-name").textContent = username;
  }

  // 🔹 Try to read shared room info (for synced problem)
  let roomId = null;
  const roomRaw = sessionStorage.getItem("cp_room_info");
  if (roomRaw) {
    try {
      const roomInfo = JSON.parse(roomRaw);
      roomId = roomInfo.roomId || null;
    } catch (e) {
      console.error("Bad room info in sessionStorage:", e);
    }
  }

  // Grab references to HTML elements by ID
  const titleEl = document.getElementById("problem-title");                   // <h3> where the title goes
  const diffEl = document.getElementById("problem-difficulty");               // <p> where difficulty is shown
  const descEl = document.getElementById("problem-description");
  const showSolutionButton = document.getElementById("show-solution");
  const solutionTitleEl = document.getElementById("solution-title");         // <div> holding full problem text
  const solutionDescEl = document.getElementById("solution-description");    // <div> holding the solution (if needed)
  const customInput = document.getElementById("custom-input");                // stdin input box

  // 🔹 Simple deterministic hash: same string → same number
  function hashToIndex(str, mod) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0; // keep it positive
    }
    return h % mod;
  }

  // ============================================================
  //  Load a problem:
  //    1. Read selected difficulty
  //    2. Pick a (deterministic) problem
  //    3. Display it
  // ============================================================
  function loadProblem() {
    const diff = sessionStorage.getItem("cp_difficulty") || "easy";

    // Grab the array of problems for that difficulty
    const list = problems[diff];

    // If the difficulty has no problems or wasn’t loaded correctly
    if (!list || list.length === 0) {
      titleEl.textContent = "No problems available.";
      diffEl.textContent = "";
      descEl.textContent = "";
      solutionTitleEl.textContent = "";
      solutionDescEl.textContent = "";
      return;
    }

    // 🔹 If we have a roomId, use it to pick SAME index for both players
    let idx;
    if (roomId) {
      idx = hashToIndex(roomId, list.length);
    } else {
      // Fallback: random if no room (solo mode)
      idx = Math.floor(Math.random() * list.length);
    }

    // Get the selected problem object
    const problem = list[idx];
    currentProblem = problem;

    // ===============================================
    // Update the DOM with the problem’s information
    // ===============================================
    titleEl.textContent = problem.title;
    diffEl.textContent = problem.difficulty;
    descEl.textContent =
      problem.description +
      "\n\nInput:\n" + problem.input +
      "\n\nOutput:\n" + problem.output +
      "\n\nSample Input:\n" + problem.sampleInput +
      "\n\nSample Output:\n" + problem.sampleOutput;

    // Clear old solution
    solutionTitleEl.textContent = "";
    solutionDescEl.textContent = "";

    if (customInput) {
      customInput.value = problem.sampleInput || "";
    }
  }


  // 🔥 Automatically load a problem as soon as the page is ready
  loadProblem();

  // show solution when button clicked
  showSolutionButton.addEventListener("click", () => {
    if (!currentProblem) {
      alert("No problem loaded. Please load a problem first.");
      return;
    }

    // Display the solution
    solutionTitleEl.textContent = "Solution:";
    solutionDescEl.textContent = currentProblem.solution;
  });

}); // End of DOMContentLoaded
