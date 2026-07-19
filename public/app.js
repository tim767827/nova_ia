/* ==========================================
   NOVA AI V10 PREMIUM — app.js
   + Connexion visiteurs (Supabase)
   + Suivi d'événements pour le dashboard admin
========================================== */


// ===============================
// SUPABASE
// ===============================

const SUPABASE_URL = "https://fokziksapqquupnibjau.supabase.co";
const SUPABASE_KEY = "sb_publishable_xdzZ4xtdJiv5koMxgZ8wzA_C1wCpV70";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// ===============================
// UTILISATEUR / VARIABLES
// ===============================

let userId = null;      // id du compte connecté (Supabase), null tant que non connecté
let chats = [];
let currentChat = null;
let authMode = "login"; // "login" ou "signup"


// ===============================
// SAUVEGARDE (une clé par utilisateur, pour ne pas mélanger les comptes sur un même appareil)
// ===============================

function saveChats(){

    if(!userId) return;

    localStorage.setItem(
        "novaChats_" + userId,
        JSON.stringify(chats)
    );

}


// ===============================
// ECRAN DE CONNEXION / INSCRIPTION
// ===============================

function toggleAuthMode(){

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


async function submitAuth(){

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const errorBox = document.getElementById("authError");

    errorBox.textContent = "";

    if(!email || !password){
        errorBox.textContent = "Remplis l'email et le mot de passe.";
        return;
    }

    let result;

    if(authMode === "login"){

        result = await sb.auth.signInWithPassword({ email, password });

    } else {

        result = await sb.auth.signUp({ email, password });

    }

    if(result.error){
        errorBox.textContent = result.error.message;
        return;
    }

    if(authMode === "signup" && !result.data.session){
        errorBox.textContent = "Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.";
        return;
    }

    onAuthenticated(result.data.session.user);

}
window.submitAuth = submitAuth;


function logout(){

    sb.auth.signOut().then(()=>{
        location.reload();
    });

}
window.logout = logout;


async function onAuthenticated(user){

    userId = user.id;

    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("appRoot").classList.remove("hidden");

    chats = JSON.parse(
        localStorage.getItem("novaChats_" + userId)
    ) || [];

    renderHistory();

    if(chats.length){
        loadChat(chats[0].id);
    }

    startHeartbeat();

}


// ===============================
// "CONNECTÉ EN CE MOMENT" (dashboard admin)
// ===============================

function startHeartbeat(){
    updateLastSeen();
    setInterval(updateLastSeen, 30000); // toutes les 30 secondes tant que l'onglet est ouvert
}

async function updateLastSeen(){
    if(!userId) return;
    await sb.from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", userId);
}


// ===============================
// EVENEMENTS (dashboard admin)
// ===============================

async function logEvent(type){
    if(!userId) return;
    try{
        await sb.from("events").insert({ user_id: userId, type: type });
    }catch(e){
        console.log("Erreur log event :", e);
    }
}


// ===============================
// SIDEBAR
// ===============================


function toggleSidebar(){

    const sidebar =
    document.getElementById("sidebar");


    const overlay =
    document.querySelector(".overlay");


    if(sidebar){

        sidebar.classList.toggle("open");

    }


    if(overlay){

        overlay.classList.toggle("active");

    }


}


window.toggleSidebar =
toggleSidebar;






function closeSidebar(){


    const sidebar =
    document.getElementById("sidebar");


    const overlay =
    document.querySelector(".overlay");



    if(sidebar){

        sidebar.classList.remove("open");

    }


    if(overlay){

        overlay.classList.remove("active");

    }


}







// ===============================
// HISTORIQUE
// ===============================


function renderHistory(){


    const history =
    document.getElementById("history");


    if(!history)return;



    history.innerHTML="";



    chats.forEach(chat=>{


        const item =
        document.createElement("div");


        item.className="item";



        const title =
        document.createElement("span");


        title.className="chatTitle";


        title.textContent =
        chat.title;



        title.onclick=()=>{

            loadChat(chat.id);

            closeSidebar();

        };





        const actions =
        document.createElement("div");


        actions.className =
        "chatActions";






        const edit =
        document.createElement("button");


        edit.textContent="✏️";



        edit.onclick=(e)=>{


            e.stopPropagation();



            let name =
            prompt(
                "Nouveau titre",
                chat.title
            );



            if(name){


                chat.title =
                name.trim();


                saveChats();

                renderHistory();


            }


        };






        const del =
        document.createElement("button");


        del.textContent="🗑️";



        del.onclick=(e)=>{


            e.stopPropagation();



            if(confirm(
                "Supprimer cette conversation ?"
            )){


                chats =
                chats.filter(
                    c=>c.id!==chat.id
                );



                if(currentChat?.id===chat.id){

                    currentChat=null;

                }



                saveChats();

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









// ===============================
// NOUVEAU CHAT
// ===============================


function newChat(){


    currentChat={


        id:Date.now(),


        title:"Nouvelle conversation",


        messages:[]


    };



    chats.unshift(
        currentChat
    );



    saveChats();


    renderHistory();


    logEvent("chat_created");



    const box =
    document.getElementById("messages");



    if(box){

        box.innerHTML="";

    }


}


window.newChat =
newChat;









// ===============================
// CHARGER CHAT
// ===============================


function loadChat(id){


    currentChat =
    chats.find(
        c=>c.id===id
    );



    if(!currentChat)return;



    const box =
    document.getElementById("messages");



    box.innerHTML="";



    currentChat.messages.forEach(msg=>{


        if(msg.type==="image"){


            addImage(
                msg.text,
                false
            );


        }

        else{


            addMessage(
                msg.text,
                msg.type,
                false
            );


        }


    });


}








// ===============================
// AFFICHER MESSAGE
// ===============================


function addMessage(
text,
type,
scroll=true
){


    const box =
    document.getElementById("messages");



    if(!box)return;



    const welcome =
    document.querySelector(".welcome");



    if(welcome){

        welcome.remove();

    }




    const div =
    document.createElement("div");



    div.className =
    "msg " + type;




    if(type==="bot"){


        div.innerHTML =
        cleanMarkdown(text);


    }

    else{


        div.textContent =
        text;


    }



    box.appendChild(div);



    if(scroll){

        smartScroll();

    }



}








// ===============================
// MARKDOWN
// ===============================


function cleanMarkdown(text){


    if(window.marked){

        return marked.parse(text);

    }


    return text.replace(
        /\n/g,
        "<br>"
    );


}








// ===============================
// SCROLL
// ===============================


function smartScroll(){


    const box =
    document.getElementById("messages");



    if(!box)return;



    box.scrollTo({

        top:box.scrollHeight,

        behavior:"smooth"

    });


}


// ===============================
// ENVOI MESSAGE
// ===============================


async function sendMessage(){


    const chatInput =
    document.getElementById("input");


    if(!chatInput)return;



    const text =
    chatInput.value.trim();



    if(!text)return;



    if(!currentChat){

        newChat();

    }



    addMessage(
        text,
        "user"
    );



    currentChat.messages.push({

        text:text,

        type:"user"

    });



    if(
        currentChat.title ===
        "Nouvelle conversation"
    ){


        currentChat.title =
        text.substring(0,35);


        renderHistory();


    }



    saveChats();

    logEvent("message_sent");



    chatInput.value="";




    // MESSAGE CHARGEMENT IA


    let loading =
    document.createElement("div");



    loading.className =
    "msg bot";



    loading.id =
    "novaLoading";


    loading.textContent =
    "Nova réfléchit...";



    document
    .getElementById("messages")
    .appendChild(loading);



    smartScroll();




    try{


        const response =
        await fetch(
            "/chat",
            {

                method:"POST",

                headers:{

                    "Content-Type":
                    "application/json"

                },


                body:JSON.stringify({

                    message:text,

                    userId:userId

                })

            }

        );



        const data =
        await response.json();




        loading.remove();




        // ==========================
        // IMAGE
        // ==========================


        if(data.image){


            showImageLoading();



            setTimeout(()=>{


                removeImageLoading();



                addImage(
                    data.image
                );


            },500);



        }



        // ==========================
        // TEXTE NORMAL
        // ==========================


        else{


            typeWriter(
                data.reply ||
                "Pas de réponse."
            );


        }



    }



    catch(error){


        console.log(error);



        if(loading){

            loading.remove();

        }



        addMessage(
            "❌ Erreur serveur",
            "bot"
        );


    }



}


window.sendMessage =
sendMessage;









// ===============================
// IMAGE EN CREATION
// ===============================


function showImageLoading(){


    const box =
    document.getElementById("messages");



    if(!box)return;



    const div =
    document.createElement("div");



    div.className =
    "msg bot";


    div.id =
    "imageLoading";



    div.textContent =
    "🖼️ Image en cours de création...";



    box.appendChild(div);



    smartScroll();


}






function removeImageLoading(){


    const loading =
    document.getElementById(
        "imageLoading"
    );



    if(loading){

        loading.remove();

    }


}








// ===============================
// AJOUT IMAGE
// ===============================


function addImage(
url,
save=true
){


    const box =
    document.getElementById("messages");



    if(!box)return;




    const title =
    document.createElement("div");



    title.className =
    "msg bot";



    title.textContent =
    "✅ Image créée :";



    box.appendChild(title);







    const img =
    document.createElement("img");



    img.src=url;



    img.className =
    "generatedImage";



    box.appendChild(img);




    if(
        save &&
        currentChat
    ){


        currentChat.messages.push({

            text:url,

            type:"image"

        });


        saveChats();

        logEvent("image_generated");


    }



    smartScroll();


}









// ===============================
// ECRITURE IA
// ===============================


function typeWriter(text){



    const div =
    document.createElement("div");



    div.className =
    "msg bot";



    document
    .getElementById("messages")
    .appendChild(div);




    let index=0;



    const timer =
    setInterval(()=>{



        div.innerHTML =
        cleanMarkdown(
            text.substring(
                0,
                index
            )
        );



        index++;



        smartScroll();




        if(index > text.length){


            clearInterval(timer);



            if(currentChat){


                currentChat.messages.push({

                    text:text,

                    type:"bot"

                });



                saveChats();


            }



        }



    },15);


}









// ===============================
// MENU +
// ===============================


function openFileMenu(){


    const menu =
    document.getElementById("fileMenu");



    if(menu){

        menu.classList.toggle(
            "hidden"
        );

    }


}



window.openFileMenu =
openFileMenu;









// ===============================
// IMAGE UPLOAD
// ===============================


async function handleImage(){


    const file =
    document
    .getElementById("imageUpload")
    .files[0];



    if(!file)return;



    addMessage(
        "🖼️ Image envoyée",
        "user"
    );



    const reader =
    new FileReader();



    reader.onload=async()=>{


        try{


            const response =
            await fetch(
                "/vision",
                {

                    method:"POST",

                    headers:{

                        "Content-Type":
                        "application/json"

                    },


                    body:JSON.stringify({

                        image:
                        reader.result.split(",")[1],

                        mimeType:file.type

                    })

                }

            );



            const data =
            await response.json();



            addMessage(

                data.reply ||
                "Analyse terminée.",

                "bot"

            );



        }


        catch(e){


            addMessage(
                "❌ Erreur analyse image",
                "bot"
            );


        }


    };



    reader.readAsDataURL(file);


}



window.handleImage =
handleImage;








// ===============================
// DOCUMENT
// ===============================


async function handleFile(){


    const file =
    document
    .getElementById("fileInput")
    .files[0];



    if(!file)return;



    addMessage(

        "📄 Document envoyé : "
        +file.name,

        "user"

    );



    const form =
    new FormData();



    form.append(
        "file",
        file
    );



    try{


        const response =
        await fetch(
            "/upload",
            {

                method:"POST",

                body:form

            }

        );



        const data =
        await response.json();



        addMessage(

            data.reply ||
            "Document analysé.",

            "bot"

        );



    }


    catch(e){


        addMessage(
            "❌ Erreur document",
            "bot"
        );


    }


}



window.handleFile =
handleFile;








// ===============================
// REPONSES RAPIDES
// ===============================


function sendQuick(text){


    const chatInput =
    document.getElementById("input");



    if(chatInput){


        chatInput.value=text;


        sendMessage();


    }


}



window.sendQuick =
sendQuick;


// ===============================
// MODE SOMBRE
// ===============================


function toggleTheme(){


    document.body
    .classList
    .toggle("dark");



    localStorage.setItem(

        "novaDark",

        document.body
        .classList
        .contains("dark")

    );


}


window.toggleTheme =
toggleTheme;







if(
    localStorage.getItem("novaDark")
    ==="true"
){


    document.body
    .classList
    .add("dark");


}








// ===============================
// PARAMETRES
// ===============================


function toggleSettings(){


    const settings =
    document.getElementById(
        "settings"
    );



    if(settings){


        settings.classList.toggle(
            "hidden"
        );


    }


}



window.toggleSettings =
toggleSettings;









// ===============================
// EFFACER HISTORIQUE
// ===============================


function clearHistory(){



    if(
        !confirm(
            "Supprimer tout l'historique ?"
        )
    ){

        return;

    }




    chats=[];


    currentChat=null;



    localStorage.removeItem(
        "novaChats_" + userId
    );



    const box =
    document.getElementById(
        "messages"
    );



    if(box){

        box.innerHTML="";

    }



    renderHistory();



}



window.clearHistory =
clearHistory;









// ===============================
// EXPORT CHAT
// ===============================


function exportChat(){



    if(!currentChat){


        alert(
            "Aucune conversation"
        );


        return;

    }




    let text =
    currentChat.messages
    .map(message=>{


        return (

            message.type
            .toUpperCase()
            +
            " : "
            +
            message.text

        );


    })
    .join("\n\n");





    const blob =
    new Blob(

        [text],

        {
            type:
            "text/plain"
        }

    );





    const link =
    document.createElement(
        "a"
    );



    link.href =
    URL.createObjectURL(
        blob
    );



    link.download =
    "NovaAI-chat.txt";



    link.click();


}



window.exportChat =
exportChat;









// ===============================
// RECHERCHE HISTORIQUE
// ===============================


const historySearch =
document.getElementById(
    "searchHistory"
);



if(historySearch){



    historySearch.addEventListener(

        "input",

        ()=>{


            const value =
            historySearch.value
            .toLowerCase();




            document
            .querySelectorAll(
                ".item"
            )
            .forEach(item=>{



                item.style.display =

                item.textContent
                .toLowerCase()
                .includes(value)

                ?

                "flex"

                :

                "none";



            });



        }

    );



}









// ===============================
// ENTREE CLAVIER
// ===============================


const messageInput =
document.getElementById(
    "input"
);



if(messageInput){



    messageInput.addEventListener(

        "keydown",

        event=>{


            if(
                event.key==="Enter"
                &&
                !event.shiftKey
            ){


                event.preventDefault();


                sendMessage();


            }



        }

    );



}









// ===============================
// FERMETURE MENU AVEC OVERLAY
// ===============================


const overlay =
document.querySelector(
    ".overlay"
);



if(overlay){


    overlay.onclick=()=>{

        closeSidebar();

    };


}









// ===============================
// DEMARRAGE APPLICATION
// (attend que la session Supabase soit vérifiée
//  avant d'afficher quoi que ce soit)
// ===============================


sb.auth.getSession().then(({ data })=>{

    if(data.session){
        onAuthenticated(data.session.user);
    }
    // sinon : on reste sur l'écran de connexion (#authScreen), rien à faire ici

});


console.log(
    "🚀 NovaAI V10 chargé"
);
