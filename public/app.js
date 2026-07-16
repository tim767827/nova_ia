/* ==========================================
   NOVA AI V8 PREMIUM
   APP.JS PARTIE 1/3
   CHAT UNIQUE
========================================== */


// ===============================
// UTILISATEUR
// ===============================


let userId = localStorage.getItem("novaUser");


if(!userId){

    userId = "user_" + Date.now();

    localStorage.setItem(
        "novaUser",
        userId
    );

}




// ===============================
// HISTORIQUE
// ===============================


let chats =
JSON.parse(
    localStorage.getItem("novaChats")
)
|| [];


let currentChat = null;




function saveChats(){

    localStorage.setItem(
        "novaChats",
        JSON.stringify(chats)
    );

}





// ===============================
// SIDEBAR MOBILE
// ===============================


function toggleSidebar(){

    const sidebar =
    document.getElementById("sidebar");


    if(sidebar){

        sidebar.classList.toggle("open");

    }


}



window.toggleSidebar = toggleSidebar;







// ===============================
// HISTORIQUE AFFICHAGE
// ===============================


function renderHistory(){


    const history =
    document.getElementById("history");


    if(!history)return;



    history.innerHTML = "";



    chats.forEach(chat=>{


        let item =
        document.createElement("div");


        item.className="item";



        let title =
        document.createElement("span");


        title.className="chatTitle";


        title.textContent =
        chat.title;



        title.onclick=()=>{

            loadChat(chat.id);

            closeSidebar();

        };





        let actions =
        document.createElement("div");


        actions.className="chatActions";





        let edit =
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







        let del =
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


                    document
                    .getElementById("messages")
                    .innerHTML="";


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
// SIDEBAR FERMETURE MOBILE
// ===============================


function closeSidebar(){


    let sidebar =
    document.getElementById("sidebar");


    if(sidebar){

        sidebar.classList.remove("open");

    }


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




    let box =
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



    let box =
    document.getElementById("messages");



    box.innerHTML="";



    currentChat.messages.forEach(msg=>{


        if(msg.type==="image"){



            let img =
            document.createElement("img");


            img.src =
            msg.text;


            img.className =
            "generatedImage";


            box.appendChild(img);



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
// MESSAGE AFFICHAGE
// ===============================



function addMessage(
text,
type,
scroll=true
){



    let box =
    document.getElementById("messages");



    if(!box)return;



    let welcome =
    document.querySelector(".welcome");



    if(welcome){

        welcome.remove();

    }




    let div =
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


    return text
    .replace(/\n/g,"<br>");



}






// ===============================
// SCROLL INTELLIGENT
// ===============================



function smartScroll(){


    let box =
    document.getElementById("messages");


    if(!box)return;



    let distance =
    box.scrollHeight -
    box.scrollTop -
    box.clientHeight;



    // seulement si l'utilisateur est déjà en bas

    if(distance < 150){


        box.scrollTo({

            top:box.scrollHeight,

            behavior:"smooth"

        });


    }



}/* ==========================================
   NOVA AI V8 PREMIUM
   APP.JS PARTIE 2/3
   CHAT + IMAGE + DOCUMENT
========================================== */



// ===============================
// ENVOI MESSAGE IA
// ===============================


async function sendMessage(){


    const input =
    document.getElementById("input");


    if(!input)return;



    const text =
    input.value.trim();



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



    if(currentChat.title==="Nouvelle conversation"){


        currentChat.title =
        text.substring(0,35);


        renderHistory();


    }



    saveChats();



    input.value="";





let loading =
document.createElement("div");


loading.className =
"msg bot";


loading.textContent =
"Nova réfléchit...";



    document
    .getElementById("messages")
    .appendChild(loading);




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



const data = await response.json();


addMessage(data.reply,"bot");



if(data.image){


    let imageLoading =
    document.createElement("div");


    imageLoading.className =
    "msg bot";


    imageLoading.id =
    "imageLoading";


    imageLoading.textContent =
    "🖼️ Image en cours de création...";


    document
    .getElementById("messages")
    .appendChild(imageLoading);



    smartScroll();



    // affiche l'image après réception

    addImage(data.image);



    // enlève le texte de chargement

    imageLoading.remove();



}

        loading.remove();



        typeWriter(

            data.reply ||
            "Pas de réponse."

        );




    }


    catch(error){


        console.log(error);


        loading.remove();



        addMessage(

            "❌ Erreur serveur",

            "bot"

        );


    }



}




window.sendMessage =
sendMessage;




function addImage(url){


const box=document.querySelector(".messages");


const img=document.createElement("img");


img.src=url;


img.className="generatedImage";


let title =
document.createElement("p");

title.textContent =
"✅ Image créée :";


title.className =
"msg bot";


box.appendChild(title);

box.appendChild(img);



box.scrollTop =
box.scrollHeight;


}



// ===============================
// ECRITURE IA FLUIDE
// ===============================



function typeWriter(text){



    let div =
    document.createElement("div");



    div.className =
    "msg bot";



    document
    .getElementById("messages")
    .appendChild(div);




    let index=0;



    let timer =
    setInterval(()=>{



        div.innerHTML =
        cleanMarkdown(
            text.substring(
                0,
                index
            )
        );



        smartScroll();



        index++;



        if(index > text.length){



            clearInterval(timer);



            currentChat.messages.push({

                text:text,

                type:"bot"

            });



            saveChats();



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




    reader.onload = async()=>{


        const base64 =
        reader.result.split(",")[1];




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

                        image:base64,

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
// DOCUMENT UPLOAD
// ===============================



async function handleFile(){


    const file =
    document
    .getElementById("fileInput")
    .files[0];



    if(!file)return;




    addMessage(

        "📄 Document envoyé : "+file.name,

        "user"

    );




    const formData =
    new FormData();



    formData.append(

        "file",

        file

    );




    try{


        const response =
        await fetch(

            "/upload",

            {

                method:"POST",

                body:formData

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
// ENVOI RAPIDE
// ===============================



function sendQuick(text){


    const input =
    document.getElementById("input");



    if(input){


        input.value=text;


        sendMessage();


    }



}



window.sendQuick =
sendQuick;/* ==========================================
   NOVA AI V8 PREMIUM
   APP.JS PARTIE 3/3
   OPTIONS + START
========================================== */



// ===============================
// THEME SOMBRE
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


    const box =
    document.getElementById("settings");



    if(box){

        box.classList.toggle(
            "hidden"
        );

    }


}



window.toggleSettings =
toggleSettings;









// ===============================
// SUPPRIMER HISTORIQUE
// ===============================



function clearHistory(){



    if(!confirm(
        "Supprimer tout l'historique ?"
    ))return;




    chats=[];


    currentChat=null;



    localStorage.removeItem(
        "novaChats"
    );



    const box =
    document.getElementById("messages");



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
    .map(m=>{


        return (

            m.type.toUpperCase()
            +" : "
            +m.text

        );


    })
    .join("\n\n");





    let blob =
    new Blob(
        [text],
        {
            type:"text/plain"
        }
    );



    let link =
    document.createElement("a");



    link.href =
    URL.createObjectURL(blob);



    link.download =
    "NovaAI-conversation.txt";



    link.click();



}



window.exportChat =
exportChat;









// ===============================
// RECHERCHE HISTORIQUE
// ===============================



const search =
document.getElementById(
    "searchHistory"
);



if(search){



    search.addEventListener(

        "input",

        ()=>{


            const value =
            search.value
            .toLowerCase();




            document
            .querySelectorAll(".item")
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



const input =
document.getElementById(
    "input"
);



if(input){



    input.addEventListener(

        "keydown",

        e=>{


            if(
                e.key==="Enter"
                &&
                !e.shiftKey
            ){


                e.preventDefault();


                sendMessage();


            }


        }


    );


}









// ===============================
// START APPLICATION
// ===============================



renderHistory();




if(chats.length){



    loadChat(
        chats[0].id
    );



}






// ===============================
// VERIFICATION MARKDOWN
// ===============================



console.log(
    "🚀 NovaAI V8 chargé"
);
