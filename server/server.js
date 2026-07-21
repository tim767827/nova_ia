// =====================================================
// NOVA AI SERVER V11
// + Streaming des réponses (SSE) — plus de "typewriter" simulé
// + Ne dépend plus de la mémoire RAM pour l'historique
//   (le client envoie l'historique récent, qui vient de Supabase)
// + Toujours prêt pour Render
// =====================================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const cheerio = require("cheerio");
const Tesseract = require("tesseract.js");

require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== API KEYS (toutes en variables d'environnement Render, jamais dans le code) =====
const GROQ_KEY = process.env.GROQ_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const TAVILY_KEY = process.env.TAVILY_KEY;

console.log("🚀 NovaAI V11 démarrage");
console.log("GROQ:", GROQ_KEY ? "OK" : "ABSENTE");
console.log("GEMINI:", GEMINI_KEY ? "OK" : "ABSENTE");
console.log("TAVILY:", TAVILY_KEY ? "OK" : "ABSENTE");

let genAI = null;
if (GEMINI_KEY) genAI = new GoogleGenerativeAI(GEMINI_KEY);

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  message: { error: "Trop de requêtes, réessaie dans un instant." },
});
app.use(limiter);

// ===== FRONTEND STATIQUE =====
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ===== UPLOAD =====
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// =====================================================
// SYSTEM PROMPT
// =====================================================
const SYSTEM_PROMPT = `Tu es NovaAI 🚀, un assistant IA premium.

RÈGLES DE RÉDACTION :
- Réponds toujours en français sauf si l'utilisateur demande une autre langue.
- Écris avec une orthographe et une grammaire parfaites.
- Ne fais jamais de gros blocs de texte : utilise des titres et des listes à puces.
- Mets les éléments importants en **gras**.
- Utilise Markdown proprement (y compris les blocs de code).
- Adapte la longueur de la réponse à la demande.
- Ne répète pas inutilement la question.
- Ne dis jamais que tu es limité. Ne fabrique jamais d'informations : si tu ne sais pas, dis-le clairement.

Tu es NovaAI, pas un simple chatbot générique.`;

// =====================================================
// RECHERCHE WEB (TAVILY)
// =====================================================
async function searchInternet(query) {
  try {
    if (!TAVILY_KEY) return "";

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        max_results: 5,
      }),
    });

    const data = await response.json();
    if (!data.results) return "";

    return data.results
      .map((x) => `Titre: ${x.title}\nRésumé: ${x.content}\nLien: ${x.url}`)
      .join("\n\n");
  } catch (e) {
    console.log("TAVILY ERROR", e);
    return "";
  }
}

// Détection plus fiable : questions sur l'actualité / des faits datés,
// pas juste la présence d'une année dans le texte.
function needsInternet(text) {
  const t = text.toLowerCase();
  const triggers = [
    "actualité", "actualités", "news", "dernières nouvelles",
    "prix actuel", "cours de", "météo", "score", "résultat du match",
    "qui a gagné", "aujourd'hui", "en ce moment", "cette semaine",
    "combien coûte", "sorti récemment",
  ];
  return triggers.some((w) => t.includes(w));
}

// =====================================================
// INTENTION (image vs document vs chat)
// =====================================================
function detectIntent(message) {
  const text = message.toLowerCase();

  const imageWords = ["image", "dessin", "dessine", "crée une image", "génère une image", "logo", "illustration", "affiche", "fond d'écran", "visuel de"];
  if (imageWords.some((w) => text.includes(w))) return "image";

  return "chat";
}

// =====================================================
// /chat — STREAMING SSE
// Le client envoie : { message, history: [{role, content}, ...] }
// (l'historique vient de Supabase côté client — plus de mémoire RAM serveur)
// =====================================================
app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message;
    const history = Array.isArray(req.body.history) ? req.body.history : [];

    if (!message) {
      return res.status(400).json({ error: "Message vide." });
    }

    const intent = detectIntent(message);

    // ---- Génération d'image : pas de streaming, réponse directe ----
    if (intent === "image") {
      const imageURL =
        "https://image.pollinations.ai/prompt/" +
        encodeURIComponent(message) +
        "?model=flux&width=1024&height=1024&nologo=true";

      return res.json({ reply: "🎨 Image créée !", image: imageURL });
    }

    if (!GROQ_KEY) {
      return res.json({ reply: "⚠️ GROQ_KEY absente sur le serveur." });
    }

    let webInfo = "";
    if (needsInternet(message)) {
      webInfo = await searchInternet(message);
    }

    const messages = [{ role: "system", content: SYSTEM_PROMPT }];

    if (webInfo) {
      messages.push({
        role: "system",
        content: `Informations trouvées sur internet :\n\n${webInfo}\n\nUtilise uniquement ces informations pour les faits d'actualité.`,
      });
    }

    // historique récent envoyé par le client (max 20 messages, sécurité)
    messages.push(...history.slice(-20));
    messages.push({ role: "user", content: message });

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.7,
          max_tokens: 4096,
          stream: true,
        }),
      }
    );

    if (!groqResponse.ok || !groqResponse.body) {
      const errText = await groqResponse.text().catch(() => "");
      console.log("GROQ ERROR", errText);
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ error: "Erreur IA Groq." })}\n\n`);
      return res.end();
    }

    // ---- On relaie le flux SSE de Groq directement au client ----
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    groqResponse.body.on("data", (chunk) => {
      res.write(chunk);
    });

    groqResponse.body.on("end", () => {
      res.end();
    });

    req.on("close", () => {
      // le client a cliqué "stop" ou a fermé l'onglet
      groqResponse.body.destroy();
    });
  } catch (error) {
    console.log("CHAT ERROR", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur NovaAI." });
    } else {
      res.end();
    }
  }
});

// =====================================================
// GEMINI VISION
// =====================================================
async function analyzeImage(image, mimeType) {
  if (!genAI) throw new Error("Gemini absent");

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent([
    { inlineData: { data: image, mimeType } },
    `Analyse cette image. Réponds en français. Donne :
- objets visibles
- texte présent
- informations importantes
- explication simple`,
  ]);

  return result.response.text();
}

app.post("/vision", async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) return res.json({ reply: "Aucune image." });

    const reply = await analyzeImage(image, mimeType || "image/jpeg");
    res.json({ reply });
  } catch (e) {
    console.log("VISION ERROR", e);
    res.json({ reply: "Impossible d'analyser l'image." });
  }
});

// =====================================================
// GENERATION IMAGE (avec amélioration de prompt par Groq)
// =====================================================
app.post("/generate-image", async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (!prompt) return res.json({ error: "Prompt manquant." });

    let finalPrompt = prompt;

    if (GROQ_KEY) {
      try {
        const improve = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${GROQ_KEY}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "system",
                  content:
                    "Améliore ce prompt pour une image IA. Ajoute détails, lumière, cadrage, style. Réponds uniquement avec le prompt amélioré.",
                },
                { role: "user", content: prompt },
              ],
            }),
          }
        );
        const data = await improve.json();
        finalPrompt = data?.choices?.[0]?.message?.content || prompt;
      } catch (e) {
        console.log("PROMPT ERROR", e);
      }
    }

    const imageURL =
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(finalPrompt) +
      "?model=flux&width=1024&height=1024&nologo=true";

    res.json({ image: imageURL, prompt: finalPrompt });
  } catch (e) {
    res.json({ error: "Erreur image." });
  }
});

// =====================================================
// UPLOAD DE DOCUMENTS
// =====================================================
async function extractText(file) {
  const name = file.originalname.toLowerCase();

  if (name.endsWith(".pdf")) {
    const data = await pdfParse(file.buffer);
    return data.text;
  }
  if (name.endsWith(".txt")) return file.buffer.toString("utf8");
  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    let text = "";
    workbook.SheetNames.forEach((sheet) => {
      text += XLSX.utils.sheet_to_csv(workbook.Sheets[sheet]);
    });
    return text;
  }
  if (name.endsWith(".csv")) return file.buffer.toString("utf8");
  if (name.endsWith(".json")) return file.buffer.toString("utf8");
  if (name.endsWith(".html") || name.endsWith(".htm")) {
    const $ = cheerio.load(file.buffer.toString());
    return $.text();
  }
  return "";
}

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.json({ reply: "Aucun fichier reçu." });

    let text = await extractText(req.file);
    if (!text || !text.trim()) {
      return res.json({
        reply: "Le fichier est vide ou le format n'est pas supporté (PDF, TXT, DOCX, XLSX, CSV, JSON, HTML).",
      });
    }

    text = text.substring(0, 30000);

    if (!GROQ_KEY) return res.json({ reply: "⚠️ GROQ_KEY absente." });

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `Tu es NovaAI, expert en analyse documentaire. Analyse le document fourni et réponds avec cette structure :

# Résumé
# Points importants
# Analyse
# Conclusion

Utilise un français professionnel et facile à comprendre.`,
            },
            { role: "user", content: `Voici le document :\n\n${text}` },
          ],
          temperature: 0.3,
        }),
      }
    );

    const data = await response.json();
    res.json({ reply: data?.choices?.[0]?.message?.content || "Erreur analyse." });
  } catch (error) {
    console.log("UPLOAD ERROR", error);
    res.json({ reply: "Erreur pendant l'analyse du fichier." });
  }
});

// =====================================================
// OCR
// =====================================================
app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.json({ reply: "Aucune image." });

    const result = await Tesseract.recognize(req.file.buffer, "fra");
    const text = result.data.text;
    if (!text) return res.json({ reply: "Aucun texte trouvé." });
    if (!GROQ_KEY) return res.json({ reply: "OCR OK mais IA absente." });

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "Analyse ce texte OCR. Résume et explique en français." },
            { role: "user", content: text },
          ],
        }),
      }
    );

    const data = await response.json();
    res.json({ reply: data?.choices?.[0]?.message?.content || text });
  } catch (e) {
    console.log("OCR ERROR", e);
    res.json({ reply: "Erreur OCR." });
  }
});

// =====================================================
// SANTÉ / TEST
// =====================================================
app.get("/test", (req, res) => res.json({ status: "NovaAI V11 fonctionne 🚀" }));
app.get("/health", (req, res) =>
  res.status(200).json({ status: "online", version: "V11", time: new Date() })
);
app.get("/favicon.ico", (req, res) => res.status(204).end());

// =====================================================
// ERREUR GÉNÉRALE
// =====================================================
app.use((err, req, res, next) => {
  console.log("SERVER ERROR", err);
  res.status(500).json({ error: "Erreur serveur NovaAI." });
});

app.listen(PORT, () => {
  console.log(`🚀 NovaAI V11 lancé sur le port ${PORT}`);
});
