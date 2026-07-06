const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

/* =================================================
   📁 FRONT (index.html dans /public à la racine)
================================================= */
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

/* =================================================
   🤖 GROQ API
================================================= */
const API_KEY = process.env.API_KEY;

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.json({ reply: "Écris un message 🙂" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await response.json();

    console.log("GROQ RESPONSE =>", data);

    const reply = data?.choices?.[0]?.message?.content;

    res.json({
      reply: reply || "IA n'a pas répondu 😕"
    });

  } catch (err) {
    console.log("ERROR =>", err);
    res.json({ reply: "Erreur serveur 😕" });
  }
});

/* =================================================
   🚀 SERVER START
================================================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("✅ Server running on port " + PORT);
});
