const userHistories = {};
function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = `msg ${type}`;
  div.textContent = text;

  document.getElementById("messages").appendChild(div);
  scroll();
}

function scroll() {
  const m = document.getElementById("messages");
  m.scrollTop = m.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("input");
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  // 🧠 réflexion IA
  const thinking = document.createElement("div");
  thinking.className = "msg bot";
  thinking.textContent = "Nova réfléchit...";
  document.getElementById("messages").appendChild(thinking);
  scroll();

  const res = await fetch("/chat", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({message:text})
  });

  const data = await res.json();

  thinking.remove();

  typeWriter(data.reply);
}

// ✨ effet typing ChatGPT
function typeWriter(text) {
  const div = document.createElement("div");
  div.className = "msg bot";
  document.getElementById("messages").appendChild(div);

  let i = 0;
  const interval = setInterval(() => {
    div.textContent += text[i];
    i++;
    scroll();

    if (i >= text.length) clearInterval(interval);
  }, 10);
}

/* 🌗 theme */
function toggleTheme() {
  document.body.classList.toggle("dark");
}

/* ⚙ settings */
function toggleSettings() {
  document.getElementById("settings").classList.toggle("hidden");
}
