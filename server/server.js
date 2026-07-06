const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// FRONT
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// API KEY
const API_KEY = process.env.API_KEY;

/* =========================
   🧠 MEMOIRE SIMPLE
========================= */
const userHistories = {};

/* =========================
   🤖 CHAT ROUTE
========================= */
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const userId = req.body.userId || "default";

    if (!userMessage) {
      return res.json({ reply: "Écris un message 🙂" });
    }

    // init mémoire user
    if (!userHistories[userId]) {
      userHistories[userId] = [];
    }

    const history = userHistories[userId];

    // ajouter message user
    history.push({ role: "user", content: userMessage });

    // limiter mémoire
    if (history.length > 12) {
      history.shift();
    }

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
                "Tu es NovaAI. Tu réponds toujours uniquement en français."
            },
            ...history
          ]
        })
      }
    );

    const data = await response.json();

    console.log("GROQ RESPONSE =>", data);

    const reply = data?.choices?.[0]?.message?.content;

    // ajouter réponse IA à mémoire
    history.push({ role: "assistant", content: reply });

    res.json({
      reply: reply || "IA n'a pas répondu 😕"
    });

  } catch (err) {
    console.log("ERROR =>", err);
    res.json({ reply: "Erreur serveur 😕" });
  }
});

/* =========================
   🚀 SERVER START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
