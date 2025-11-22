// PAGE SWITCHING LOGIC
const pageHome = document.getElementById("page-home");
const pageRunner = document.getElementById("page-runner");

const startBtn = document.getElementById("start-btn");
const backBtn = document.getElementById("back-btn");
const usernameInput = document.getElementById("username");

function showPage(pageName) {
  if (pageName === "home") {
    pageHome.classList.remove("hidden");
    pageRunner.classList.add("hidden");
  } else if (pageName === "runner") {
    pageHome.classList.add("hidden");
    pageRunner.classList.remove("hidden");
  }
}

// Example of "depending on certain inputs"
startBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim();

  if (!name) {
    alert("Please enter your name to start!");
    return;
  }

  // you could also store name globally, show it on the next page, etc.
  showPage("runner");
});

backBtn.addEventListener("click", () => {
  showPage("home");
});

// ========== JUDGE0 RUNNER LOGIC ==========

// Public Judge0 instance (no key needed; fine for learning/testing)
const JUDGE0_URL =
  "https://ce.judge0.com/submissions?base64_encoded=false&wait=true";

const runBtn = document.getElementById("run-btn");
const codeEl = document.getElementById("code");
const inputEl = document.getElementById("input");
const langEl = document.getElementById("language");
const outputEl = document.getElementById("output");
const statusEl = document.getElementById("status");
const errorsEl = document.getElementById("errors");

runBtn.addEventListener("click", async () => {
  const source_code = codeEl.value;
  const stdin = inputEl.value;
  const language_id = Number(langEl.value);

  outputEl.textContent = "Running...";
  statusEl.textContent = "";
  errorsEl.textContent = "";

  try {
    const response = await fetch(JUDGE0_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language_id,
        source_code,
        stdin,
      }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok: " + response.status);
    }

    const data = await response.json();

    // Show results
    outputEl.textContent = data.stdout || "";
    statusEl.textContent =
      (data.status && data.status.description) || "Unknown status";

    let errText = "";
    if (data.compile_output) {
      errText += "Compile output:\n" + data.compile_output + "\n\n";
    }
    if (data.stderr) {
      errText += "Runtime error:\n" + data.stderr + "\n";
    }
    errorsEl.textContent = errText || "No errors";
  } catch (err) {
    outputEl.textContent = "";
    statusEl.textContent = "Error";
    errorsEl.textContent = err.message;
  }
});
