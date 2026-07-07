// ======================
// Historique
// ======================

let chats = JSON.parse(localStorage.getItem("novaChats")) || [];
let currentChat = null;

function saveChats() {
  localStorage.setItem("novaChats", JSON.stringify(chats));
}

function renderHistory() {

  const history = document.getElementById("history");
  history.innerHTML = "";

  chats.forEach(chat => {

    const item = document.createElement("div");
    item.className = "item";

    const title = document.createElement("span");
    title.className = "chatTitle";
    title.textContent = chat.title;
    title.onclick = () => loadChat(chat.id);

    // Conteneur des boutons
    const actions = document.createElement("div");
    actions.className = "chatActions";

    // Bouton Renommer
    const edit = document.createElement("button");
    edit.className = "editBtn";
    edit.innerHTML = "✏️";

    edit.onclick = (e) => {

      e.stopPropagation();

      const nouveauNom = prompt("Nouveau nom de la conversation :", chat.title);

      if (nouveauNom && nouveauNom.trim() !== "") {

        chat.title = nouveauNom.trim();

        saveChats();
        renderHistory();

      }

    };

    // Bouton Supprimer
    const trash = document.createElement("button");
    trash.className = "trashBtn";
    trash.innerHTML = "🗑️";

    trash.onclick = (e) => {

      e.stopPropagation();

      if (confirm("Supprimer cette conversation ?")) {

        chats = chats.filter(c => c.id !== chat.id);

        if (currentChat && currentChat.id === chat.id) {

          currentChat = null;
          document.getElementById("messages").innerHTML = "";

        }

        saveChats();
        renderHistory();

      }

    };

    actions.appendChild(edit);
    actions.appendChild(trash);

    item.appendChild(title);
    item.appendChild(actions);

    history.appendChild(item);

  });

}
function newChat() {

  currentChat = {
    id: Date.now(),
    title: "Nouvelle conversation",
    messages: []
  };

  chats.unshift(currentChat);

  saveChats();
  renderHistory();

  document.getElementById("messages").innerHTML = "";
}

function loadChat(id) {

  currentChat = chats.find(c => c.id === id);

  document.getElementById("messages").innerHTML = "";

  currentChat.messages.forEach(msg => {
    addMessage(msg.text, msg.type);
  });

}

function clearChat() {
  newChat();
}

// ======================
// Messages
// ======================

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

// ======================
// Envoi message
// ======================

async function sendMessage() {

  const input = document.getElementById("input");

  const text = input.value.trim();

  if (!text) return;

  if (!currentChat) {
    newChat();
  }

  addMessage(text, "user");

  currentChat.messages.push({
    text,
    type: "user"
  });

  if (currentChat.title === "Nouvelle conversation") {
    currentChat.title = text.substring(0, 25);
  }

  saveChats();
  renderHistory();

  input.value = "";

  const thinking = document.createElement("div");

  thinking.className = "msg bot";

  thinking.textContent = "Nova réfléchit...";

  document.getElementById("messages").appendChild(thinking);

  scroll();

  const res = await fetch("/chat", {

    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({

      message: text,

      userId: "user1"

    })

  });

  const data = await res.json();

  thinking.remove();

  typeWriter(data.reply);

}

// ======================
// Typing effect
// ======================

function typeWriter(text) {

  const div = document.createElement("div");

  div.className = "msg bot";

  document.getElementById("messages").appendChild(div);

  let i = 0;

  const interval = setInterval(() => {
div.innerHTML = text.substring(0,i)
.replace(/\n/g,"<br><br>");

    i++;

    scroll();

    if (i >= text.length) {

      clearInterval(interval);

      currentChat.messages.push({

        text,

        type: "bot"

      });

      saveChats();

    }

  }, 10);

}

// ======================
// Paramètres
// ======================

function toggleTheme() {

  document.body.classList.toggle("dark");

}

function toggleSettings() {

  document.getElementById("settings").classList.toggle("hidden");

}

// ======================
// Démarrage
// ======================

renderHistory();

if (chats.length) {

  loadChat(chats[0].id);

}
const imageUpload = document.getElementById("imageUpload");

imageUpload.addEventListener("change", () => {

    const file = imageUpload.files[0];

    if(!file) return;

    const img = document.createElement("img");

    img.src = URL.createObjectURL(file);

    img.style.maxWidth = "250px";
    img.style.borderRadius = "12px";

    document.getElementById("messages").appendChild(img);

});
async function analyzeImage(){

    const fileInput = document.getElementById("imageUpload");

    const file = fileInput.files[0];

    if(!file){
        alert("Choisis une image");
        return;
    }


    addMessage("📷 Image envoyée à NovaAI", "user");


    const reader = new FileReader();


    reader.onload = async function(){

        const imageBase64 = reader.result.split(",")[1];


        const res = await fetch("/vision", {

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                image:imageBase64

            })

        });


        const data = await res.json();


        addMessage(data.reply,"bot");

    };


    reader.readAsDataURL(file);

}
async function generateImage(){

    const prompt = document.getElementById("imagePrompt").value;


    if(!prompt){

        alert("Écris une description d'image");

        return;

    }


    console.log("Création image :", prompt);



    const response = await fetch("/generate-image", {

        method:"POST",

        headers:{

            "Content-Type":"application/json"

        },


        body:JSON.stringify({

            prompt:prompt

        })

    });



    const data = await response.json();



    console.log("IMAGE RESULT :", data);



    if(data.image){

      const img = document.getElementById("generatedImage");

img.src = data.image;

img.style.display="block";

    }

    else{

        alert(data.error || "Erreur image");

    }


}
