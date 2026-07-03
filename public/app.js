async function sendMessage() {
  const input = document.getElementById("input");
  const chat = document.getElementById("chat");

  const text = input.value; // ✅ IMPORTANT

  if (!text) return;

  chat.innerHTML += `<div class='msg user'>${text}</div>`;
  input.value = "";

  const res = await fetch("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: text }) // ✅ maintenant text existe
  });

  const data = await res.json();

  chat.innerHTML += `<div class='msg bot'>${data.reply}</div>`;

  chat.scrollTop = chat.scrollHeight;
}