const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const API_KEY = process.env.API_KEY;

// 🧠 mémoire globale (par user simple)
const userHistories = {};

/* =========================
   🤖 ROUTE CHAT
========================= */
app.post("/chat", async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message) {
      return res.json({ reply: "Écris un message 🙂" });
    }

    const id = userId || "default";

    if (!userHistories[id]) {
      userHistories[id] = [];
    }

    const history = userHistories[id];

    history.push({ role: "user", content: message });

    if (history.length > 12) history.shift();

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "Tu es NovaAI. Tu réponds uniquement en français."
            },
            ...history
          ]
        })
      }
    );

    const data = await response.json();

    const reply = data?.choices?.[0]?.message?.content;

    history.push({ role: "assistant", content: reply });

    res.json({ reply });

  } catch (err) {
    console.log(err);
    res.json({ reply: "Erreur serveur 😕" });
  }
});

/* =========================
   🚀 START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("✅ Server running on port " + PORT);
});
