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

  const thinking = document.createElement("div");
  thinking.className = "msg bot";
  thinking.textContent = "Nova réfléchit...";
  document.getElementById("messages").appendChild(thinking);

  scroll();

  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text,
      userId: "user1"
    })
  });

  const data = await res.json();

  thinking.remove();

  typeWriter(data.reply);
}

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

function toggleTheme() {
  document.body.classList.toggle("dark");
}

function toggleSettings() {
  document.getElementById("settings").classList.toggle("hidden");
}

function clearChat() {
  document.getElementById("messages").innerHTML = "";
}
