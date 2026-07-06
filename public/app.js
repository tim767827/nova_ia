function addMessage(text, type) {
  const msg = document.createElement("div");
  msg.className = `msg ${type}`;
  msg.textContent = text;

  document.getElementById("messages").appendChild(msg);
  scrollBottom();
}

function scrollBottom() {
  const box = document.getElementById("messages");
  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("input");
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  // 🧠 animation "réflexion"
  const thinking = document.createElement("div");
  thinking.className = "msg bot";
  thinking.textContent = "Nova réfléchit...";
  document.getElementById("messages").appendChild(thinking);
  scrollBottom();

  const res = await fetch("/chat", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({message:text})
  });

  const data = await res.json();

  thinking.remove();

  typeMessage(data.reply);
}

// ✨ effet typing ChatGPT
function typeMessage(text) {
  const msg = document.createElement("div");
  msg.className = "msg bot";
  document.getElementById("messages").appendChild(msg);

  let i = 0;
  const interval = setInterval(() => {
    msg.textContent += text[i];
    i++;
    scrollBottom();

    if (i >= text.length) clearInterval(interval);
  }, 10);
}

// 🌗 mode sombre / clair
function toggleTheme() {
  document.body.classList.toggle("light");
}

// ⚙ settings
function toggleSettings() {
  document.getElementById("settingsPanel").classList.toggle("hidden");
}
