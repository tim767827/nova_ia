// ======================
// IDENTIFIANT UTILISATEUR
// ======================

let userId = localStorage.getItem("novaUser");

if (!userId) {

    userId = "user_" + Date.now();

    localStorage.setItem(
        "novaUser",
        userId
    );

}


// ======================
// HISTORIQUE
// ======================

let chats = JSON.parse(
    localStorage.getItem("novaChats")
) || [];

let currentChat = null;



function saveChats(){

    localStorage.setItem(
        "novaChats",
        JSON.stringify(chats)
    );

}



// ======================
// AFFICHAGE HISTORIQUE
// ======================


function renderHistory(){

    const history=document.getElementById(
        "history"
    );


    if(!history) return;


    history.innerHTML="";


    chats.forEach(chat=>{


        const item=document.createElement("div");

        item.className="item";



        const title=document.createElement("span");

        title.className="chatTitle";

        title.textContent=chat.title;



        title.onclick=()=>loadChat(chat.id);



        const actions=document.createElement("div");

        actions.className="chatActions";



        const edit=document.createElement("button");

        edit.className="editBtn";

        edit.textContent="✏️";



        edit.onclick=(e)=>{


            e.stopPropagation();


            let name=prompt(
                "Nouveau nom :",
                chat.title
            );


            if(name && name.trim()){

                chat.title=name.trim();

                saveChats();

                renderHistory();

            }


        };



        const trash=document.createElement("button");

        trash.className="trashBtn";

        trash.textContent="🗑️";



        trash.onclick=(e)=>{


            e.stopPropagation();



            if(confirm("Supprimer cette conversation ?")){


                chats=chats.filter(
                    c=>c.id!==chat.id
                );



                if(currentChat?.id===chat.id){

                    currentChat=null;

                    document.getElementById(
                        "messages"
                    ).innerHTML="";

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



// ======================
// NOUVEAU CHAT
// ======================


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


    document.getElementById(
        "messages"
    ).innerHTML="";


}



// ======================
// CHARGER CHAT
// ======================


function loadChat(id){


    currentChat=chats.find(
        c=>c.id===id
    );


    if(!currentChat)return;



    const messages=document.getElementById(
        "messages"
    );


    messages.innerHTML="";



    currentChat.messages.forEach(msg=>{


        if(msg.type==="image"){


            const img=document.createElement("img");

            img.src=msg.text;

            img.className="generatedImage";


            messages.appendChild(img);



        }else{


            addMessage(
                msg.text,
                msg.type
            );


        }


    });


}



// ======================
// MESSAGE
// ======================


function addMessage(text,type){


    const div=document.createElement("div");


    div.className="msg "+type;


    div.innerHTML=text.replace(
        /\n/g,
        "<br>"
    );


    document.getElementById(
        "messages"
    ).appendChild(div);


    scroll();


}



// ======================
// SCROLL
// ======================


function scroll(){

    const box=document.getElementById(
        "messages"
    );


    box.scrollTop=box.scrollHeight;


}



// ======================
// BOUTONS RAPIDES
// ======================


function sendQuick(text){

    document.getElementById(
        "input"
    ).value=text;


    sendMessage();

}



// ======================
// CHAT IA
// ======================


async function sendMessage(){


    const input=document.getElementById(
        "input"
    );


    const text=input.value.trim();



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

        currentChat.title=text.substring(
            0,
            25
        );

    }



    saveChats();

    renderHistory();



    input.value="";



    const thinking=document.createElement("div");


    thinking.className="msg bot";


    thinking.textContent="Nova réfléchit...";


    document.getElementById(
        "messages"
    ).appendChild(thinking);



    try{


        const res=await fetch(
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



        const data=await res.json();


        thinking.remove();



        typeWriter(
            data.reply ||
            "Je n'ai pas reçu de réponse."
        );



    }catch(error){


        thinking.remove();


        addMessage(
            "❌ Erreur serveur",
            "bot"
        );


        console.error(error);


    }


}



// ======================
// ECRITURE IA
// ======================


function typeWriter(text){


    const div=document.createElement("div");


    div.className="msg bot";


    document.getElementById(
        "messages"
    ).appendChild(div);



    let i=0;



    const timer=setInterval(()=>{


        div.innerHTML=text
        .substring(0,i)
        .replace(
            /\n/g,
            "<br>"
        );


        scroll();


        i++;



        if(i>=text.length){


            clearInterval(timer);



            currentChat.messages.push({

                text:text,

                type:"bot"

            });


            saveChats();


        }



    },10);


}



// ======================
// CREATION IMAGE
// ======================


async function generateImage(){


    const input=document.getElementById(
        "imagePrompt"
    );


    const prompt=input.value.trim();



    if(!prompt){

        alert(
            "Décris une image"
        );

        return;

    }



    if(!currentChat){

        newChat();

    }



    addMessage(
        "🎨 Création : "+prompt,
        "user"
    );



    try{


        const response=await fetch(
            "/generate-image",
            {

                method:"POST",

                headers:{
                    "Content-Type":
                    "application/json"
                },


                body:JSON.stringify({

                    prompt:prompt

                })

            }
        );



        const data=await response.json();



        if(data.image){


            const img=document.createElement("img");


            img.src=data.image;


            img.className="generatedImage";


            document.getElementById(
                "messages"
            ).appendChild(img);



            currentChat.messages.push({

                text:data.image,

                type:"image"

            });



            saveChats();


            scroll();


        }else{


            alert(
                data.error ||
                "Erreur image"
            );


        }


    }catch(error){


        console.error(error);


        alert(
            "Erreur création image"
        );


    }


}



// ======================
// VISION
// ======================


async function analyzeImage(){


    const file=document.getElementById(
        "imageUpload"
    ).files[0];



    if(!file)return;



    const reader=new FileReader();



    reader.onload=async()=>{


        const base64=
        reader.result.split(",")[1];



        const res=await fetch(
            "/vision",
            {

                method:"POST",

                headers:{
                    "Content-Type":
                    "application/json"
                },


                body:JSON.stringify({

                    image:base64

                })

            }
        );



        const data=await res.json();



        addMessage(
            data.reply,
            "bot"
        );


    };



    reader.readAsDataURL(file);


}



// ======================
// PARAMETRES
// ======================


function toggleTheme(){

    document.body.classList.toggle(
        "dark"
    );

}



function toggleSettings(){

    document.getElementById(
        "settings"
    ).classList.toggle(
        "hidden"
    );

}



// ======================
// SUPPRIMER HISTORIQUE
// ======================


function clearHistory(){


    if(confirm(
        "Supprimer tout l'historique ?"
    )){


        localStorage.removeItem(
            "novaChats"
        );


        chats=[];

        currentChat=null;


        document.getElementById(
            "messages"
        ).innerHTML="";


        renderHistory();


    }


}



// ======================
// DEMARRAGE
// ======================


renderHistory();


if(chats.length){

    loadChat(
        chats[0].id
    );

}
