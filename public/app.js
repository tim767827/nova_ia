/* ==========================================
   NOVA AI V11 — app.js
   + Conversations et messages sauvegardés dans Supabase
     (fini le localStorage : accessible depuis n'importe quel appareil)
   + Réponses en streaming (effet "live", pas simulé)
   + Bouton Stop + Régénérer
   + Recherche dans les titres ET le contenu des messages
   + PWA (installation mobile)
========================================== */

// ===============================
// SUPABASE
// ===============================
const SUPABASE_URL = "https://fokziksapqquupnibjau.supabase.co";
const SUPABASE_KEY = "sb_publishable_xdzZ4xtdJiv5koMxgZ8wzA_C1wCpV70";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===============================
// ETAT
// ===============================
let userId = null;
let conversations = [];       // liste { id, title, updated_at }
let currentConversationId = null;
let currentMessages = [];     // messages de la conversation ouverte
let authMode = "login";
let abortController = null;   // pour le bouton Stop
let lastUserMessage = null;   // pour Régénérer
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => console.log("✅ Service worker enregistré"))
      .catch((err) => console.warn("❌ Échec service worker:", err));
  });
}
// ===============================
// ECRAN DE CONNEXION
// ===============================
function toggleAuthMode() {
  authMode = authMode === "login" ? "signup" : "login";

  document.getElementById("authSubmitBtn").textContent =
    authMode === "login" ? "Se connecter" : "Créer un compte";
  document.getElementById("authSub").textContent =
    authMode === "login"
      ? "Connecte-toi pour retrouver tes conversations."
      : "Crée un compte pour sauvegarder tes conversations.";
  document.getElementById("authSwitchText").textContent =
    authMode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?";
  document.getElementById("authSwitchBtn").textContent =
    authMode === "login" ? "Créer un compte" : "Se connecter";
  document.getElementById("authError").textContent = "";
}
window.toggleAuthMode = toggleAuthMode;

async function submitAuth() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const errorBox = document.getElementById("authError");
  errorBox.textContent = "";

  if (!email || !password) {
    errorBox.textContent = "Remplis l'email et le mot de passe.";
    return;
  }

  let result;
  if (authMode === "login") {
    result = await sb.auth.signInWithPassword({ email, password });
  } else {
    result = await sb.auth.signUp({ email, password });
  }

  if (result.error) {
    errorBox.textContent = result.error.message;
    return;
  }

  if (authMode === "signup" && !result.data.session) {
    errorBox.textContent = "Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.";
    return;
  }

  onAuthenticated(result.data.session.user);
}
window.submitAuth = submitAuth;

function logout() {
  sb.auth.signOut().then(() => location.reload());
}
window.logout = logout;

async function onAuthenticated(user) {
  userId = user.id;

  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appRoot").classList.remove("hidden");

  await loadConversations();

  if (conversations.length) {
    await openConversation(conversations[0].id);
  }

  startHeartbeat();
}

// ===============================
// PRESENCE ("connecté en ce moment" pour le dashboard admin)
// ===============================
function startHeartbeat() {
  updateLastSeen();
  setInterval(updateLastSeen, 30000);
}

async function updateLastSeen() {
  if (!userId) return;
  await sb.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", userId);
}

async function logEvent(type) {
  if (!userId) return;
  try {
    await sb.from("events").insert({ user_id: userId, type });
  } catch (e) {
    console.log("Erreur log event :", e);
  }
}

// ===============================
// SIDEBAR
// ===============================
function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("open");
  document.querySelector(".overlay")?.classList.toggle("active");
}
window.toggleSidebar = toggleSidebar;

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.querySelector(".overlay")?.classList.remove("active");
}

// ===============================
// CONVERSATIONS (Supabase)
// ===============================
async function loadConversations() {
  const { data, error } = await sb
    .from("conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.log("LOAD CONVERSATIONS ERROR", error);
    conversations = [];
  } else {
    conversations = data || [];
  }

  renderHistory();
}

function renderHistory(list = conversations) {
  const history = document.getElementById("history");
  if (!history) return;

  history.innerHTML = "";

  if (!list.length) {
    history.innerHTML = '<div class="item" style="justify-content:center;color:#94a3b8;">Aucune conversation</div>';
    return;
  }

  list.forEach((conv) => {
    const item = document.createElement("div");
    item.className = "item";
    if (conv.id === currentConversationId) item.style.background = "#dbeafe";

    const title = document.createElement("span");
    title.className = "chatTitle";
    title.textContent = conv.title;
    title.onclick = () => {
      openConversation(conv.id);
      closeSidebar();
    };

    const actions = document.createElement("div");
    actions.className = "chatActions";

    const edit = document.createElement("button");
    edit.textContent = "✏️";
    edit.onclick = async (e) => {
      e.stopPropagation();
      const name = prompt("Nouveau titre", conv.title);
      if (name && name.trim()) {
        await sb.from("conversations").update({ title: name.trim() }).eq("id", conv.id);
        conv.title = name.trim();
        renderHistory(list);
      }
    };

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.onclick = async (e) => {
      e.stopPropagation();
      if (confirm("Supprimer cette conversation ?")) {
        await sb.from("conversations").delete().eq("id", conv.id);
        conversations = conversations.filter((c) => c.id !== conv.id);
        if (currentConversationId === conv.id) {
          currentConversationId = null;
          currentMessages = [];
          document.getElementById("messages").innerHTML = "";
        }
        renderHistory();
      }
    };

    actions.appendChild(edit);
    actions.appendChild(del);
    item.appendChild(title);
    item.appendChild(actions);
    history.appendChild(item);
  });
}

async function createConversation(firstMessageText) {
  const title = firstMessageText.substring(0, 35) || "Nouvelle conversation";

  const { data, error } = await sb
    .from("conversations")
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error) {
    console.log("CREATE CONVERSATION ERROR", error);
    return null;
  }

  conversations.unshift(data);
  currentConversationId = data.id;
  currentMessages = [];
  renderHistory();
  logEvent("chat_created");
  return data.id;
}

function newChat() {
  currentConversationId = null;
  currentMessages = [];
  const box = document.getElementById("messages");
  if (box) {
    box.innerHTML = `
      <div class="welcome">
        <h1>Bienvenue sur NovaAI 🚀</h1>
        <p>Ton assistant IA pour discuter, créer des images, analyser des fichiers et apprendre.</p>
        <div class="suggestions">
          <button onclick="sendQuick('Explique moi une idée simplement')">💡 Explique une idée</button>
          <button onclick="sendQuick('Aide moi à écrire un texte professionnel')">✍️ Écris un texte</button>
          <button onclick="sendQuick('Donne moi une idée de projet')">🚀 Idée projet</button>
        </div>
      </div>`;
  }
  renderHistory();
}
window.newChat = newChat;

async function openConversation(id) {
  currentConversationId = id;

  const { data, error } = await sb
    .from("messages")
    .select("id, role, type, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.log("LOAD MESSAGES ERROR", error);
    currentMessages = [];
  } else {
    currentMessages = data || [];
  }

  const box = document.getElementById("messages");
  box.innerHTML = "";

  currentMessages.forEach((msg) => {
    if (msg.type === "image") {
      addImageToUI(msg.content);
    } else {
      addMessageToUI(msg.content, msg.role === "user" ? "user" : "bot");
    }
  });

  renderHistory();
}

// ===============================
// RECHERCHE (titres + contenu des messages)
// ===============================
let searchTimeout = null;
function setupSearch() {
  const input = document.getElementById("searchHistory");
  if (!input) return;

  input.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    const value = input.value.trim();

    searchTimeout = setTimeout(async () => {
      if (!value) {
        renderHistory();
        return;
      }

      const byTitle = conversations.filter((c) =>
        c.title.toLowerCase().includes(value.toLowerCase())
      );

      const { data: matches } = await sb
        .from("messages")
        .select("conversation_id")
        .ilike("content", `%${value}%`)
        .limit(50);

      const idsFromContent = new Set((matches || []).map((m) => m.conversation_id));
      const byContent = conversations.filter((c) => idsFromContent.has(c.id));

      const merged = [...byTitle, ...byContent].filter(
        (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
      );

      renderHistory(merged);
    }, 300);
  });
}

// ===============================
// AFFICHAGE MESSAGES (UI seulement, pas de sauvegarde ici)
// ===============================
function addMessageToUI(text, type) {
  const box = document.getElementById("messages");
  if (!box) return;

  document.querySelector(".welcome")?.remove();

  const div = document.createElement("div");
  div.className = "msg " + type;
  div.innerHTML = type === "bot" ? cleanMarkdown(text) : escapeHtml(text);

  box.appendChild(div);
  smartScroll();
  return div;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function cleanMarkdown(text) {
  if (window.marked) return marked.parse(text);
  return text.replace(/\n/g, "<br>");
}

function smartScroll() {
  const box = document.getElementById("messages");
  if (!box) return;
  box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
}

// ===============================
// SAUVEGARDE D'UN MESSAGE EN BASE
// ===============================
async function saveMessageToDB(conversationId, role, content, type = "text") {
  await sb.from("messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role,
    type,
    content,
  });
  await sb.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}

// ===============================
// ENVOI MESSAGE (avec streaming)
// ===============================
async function sendMessage() {
  const chatInput = document.getElementById("input");
  if (!chatInput) return;

  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  lastUserMessage = text;

  if (!currentConversationId) {
    const id = await createConversation(text);
    if (!id) {
      addMessageToUI("❌ Impossible de créer la conversation.", "bot");
      return;
    }
  }

  addMessageToUI(text, "user");
  currentMessages.push({ role: "user", type: "text", content: text });
  await saveMessageToDB(currentConversationId, "user", text, "text");
  logEvent("message_sent");

  await requestAIResponse(text);
}
window.sendMessage = sendMessage;

async function requestAIResponse(text) {
  setStopButtonVisible(true);

  const history = currentMessages
    .filter((m) => m.type === "text")
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  abortController = new AbortController();

  const box = document.getElementById("messages");
  const botDiv = document.createElement("div");
  botDiv.className = "msg bot";
  botDiv.textContent = "Nova réfléchit...";
  box.appendChild(botDiv);
  smartScroll();

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history }),
      signal: abortController.signal,
    });

    const contentType = response.headers.get("content-type") || "";

    // ---- Cas image (réponse JSON classique, pas de stream) ----
    if (contentType.includes("application/json")) {
      const data = await response.json();
      botDiv.remove();

      if (data.image) {
        addImageAndSave(data.image);
      } else {
        addMessageToUI(data.reply || "Pas de réponse.", "bot");
        currentMessages.push({ role: "assistant", type: "text", content: data.reply || "" });
        await saveMessageToDB(currentConversationId, "assistant", data.reply || "", "text");
      }
      setStopButtonVisible(false);
      return;
    }

    // ---- Cas streaming SSE ----
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let firstChunk = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        const payload = line.replace("data: ", "").trim();
        if (payload === "[DONE]") continue;

        try {
          const json = JSON.parse(payload);
          if (json.error) {
            fullText = "❌ " + json.error;
            botDiv.innerHTML = fullText;
            continue;
          }
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            if (firstChunk) {
              botDiv.textContent = "";
              firstChunk = false;
            }
            fullText += delta;
            botDiv.innerHTML = cleanMarkdown(fullText);
            smartScroll();
          }
        } catch (e) {
          // ligne SSE incomplète, on ignore
        }
      }
    }

    if (fullText) {
      currentMessages.push({ role: "assistant", type: "text", content: fullText });
      await saveMessageToDB(currentConversationId, "assistant", fullText, "text");
      addRegenerateButton(botDiv, fullText);
    }
  } catch (error) {
    if (error.name === "AbortError") {
      botDiv.innerHTML += "<br><em style='color:#94a3b8'>(arrêté)</em>";
    } else {
      console.log(error);
      botDiv.remove();
      addMessageToUI("❌ Erreur serveur", "bot");
    }
  } finally {
    setStopButtonVisible(false);
    abortController = null;
  }
}

function addRegenerateButton(botDiv, previousText) {
  const btn = document.createElement("button");
  btn.textContent = "🔄 Régénérer";
  btn.className = "regenBtn";
  btn.onclick = async () => {
    btn.remove();
    if (!lastUserMessage) return;
    await requestAIResponse(lastUserMessage);
  };
  botDiv.after(btn);
}

function setStopButtonVisible(visible) {
  const btn = document.getElementById("stopBtn");
  if (!btn) return;
  btn.classList.toggle("hidden", !visible);
}

function stopGeneration() {
  if (abortController) abortController.abort();
}
window.stopGeneration = stopGeneration;

async function addImageAndSave(url) {
  addImageToUI(url);
  currentMessages.push({ role: "assistant", type: "image", content: url });
  await saveMessageToDB(currentConversationId, "assistant", url, "image");
  logEvent("image_generated");
}

function addImageToUI(url) {
  const box = document.getElementById("messages");
  if (!box) return;

  const title = document.createElement("div");
  title.className = "msg bot";
  title.textContent = "✅ Image créée :";
  box.appendChild(title);

  const img = document.createElement("img");
  img.src = url;
  img.className = "generatedImage";
  box.appendChild(img);

  smartScroll();
}

// ===============================
// MENU + (fichier / image)
// ===============================
function openFileMenu() {
  document.getElementById("fileMenu")?.classList.toggle("hidden");
}
window.openFileMenu = openFileMenu;

async function handleImage() {
  const file = document.getElementById("imageUpload").files[0];
  if (!file) return;

  if (!currentConversationId) await createConversation("Analyse d'image");

  addMessageToUI("🖼️ Image envoyée", "user");
  await saveMessageToDB(currentConversationId, "user", "🖼️ Image envoyée", "text");

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const response = await fetch("/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: reader.result.split(",")[1],
          mimeType: file.type,
        }),
      });
      const data = await response.json();
      const reply = data.reply || "Analyse terminée.";
      addMessageToUI(reply, "bot");
      await saveMessageToDB(currentConversationId, "assistant", reply, "text");
    } catch (e) {
      addMessageToUI("❌ Erreur analyse image", "bot");
    }
  };
  reader.readAsDataURL(file);
}
window.handleImage = handleImage;

async function handleFile() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return;

  if (!currentConversationId) await createConversation("Analyse de document");

  const label = "📄 Document envoyé : " + file.name;
  addMessageToUI(label, "user");
  await saveMessageToDB(currentConversationId, "user", label, "text");

  const form = new FormData();
  form.append("file", file);

  try {
    const response = await fetch("/upload", { method: "POST", body: form });
    const data = await response.json();
    const reply = data.reply || "Document analysé.";
    addMessageToUI(reply, "bot");
    await saveMessageToDB(currentConversationId, "assistant", reply, "text");
  } catch (e) {
    addMessageToUI("❌ Erreur document", "bot");
  }
}
window.handleFile = handleFile;

function sendQuick(text) {
  const chatInput = document.getElementById("input");
  if (chatInput) {
    chatInput.value = text;
    sendMessage();
  }
}
window.sendQuick = sendQuick;

// ===============================
// MODE SOMBRE
// ===============================
function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("novaDark", document.body.classList.contains("dark"));
}
window.toggleTheme = toggleTheme;

if (localStorage.getItem("novaDark") === "true") {
  document.body.classList.add("dark");
}

// ===============================
// PARAMETRES
// ===============================
function toggleSettings() {
  document.getElementById("settings")?.classList.toggle("hidden");
}
window.toggleSettings = toggleSettings;

async function clearHistory() {
  if (!confirm("Supprimer TOUTES tes conversations ? Cette action est définitive.")) return;

  for (const conv of conversations) {
    await sb.from("conversations").delete().eq("id", conv.id);
  }
  conversations = [];
  currentConversationId = null;
  currentMessages = [];
  document.getElementById("messages").innerHTML = "";
  renderHistory();
}
window.clearHistory = clearHistory;

// ===============================
// EXPORT
// ===============================
function exportChat() {
  if (!currentMessages.length) {
    alert("Aucune conversation à exporter.");
    return;
  }

  const text = currentMessages
    .map((m) => m.role.toUpperCase() + " : " + m.content)
    .join("\n\n");

  const blob = new Blob([text], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "NovaAI-chat.txt";
  link.click();
}
window.exportChat = exportChat;

// ===============================
// ENTREE CLAVIER
// ===============================
document.getElementById("input")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

document.querySelector(".overlay")?.addEventListener("click", closeSidebar);

// ===============================
// PWA — enregistrement du service worker
// ===============================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.log("SW ERROR", e));
  });
}

// ===============================
// DEMARRAGE
// ===============================
setupSearch();

sb.auth.getSession().then(({ data }) => {
  if (data.session) onAuthenticated(data.session.user);
});

console.log("🚀 NovaAI V11 chargé");
