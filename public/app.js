```javascript
// ==========================
// UTILISATEUR
// ==========================

let userId = localStorage.getItem("novaUser");

if(!userId){

    userId="user_"+Date.now();

    localStorage.setItem(
        "novaUser",
        userId
    );

}



// ==========================
// VARIABLES
// ==========================

let chats =
JSON.parse(
localStorage.getItem("novaChats")
)||[];


let currentChat=null;



function saveChats(){

localStorage.setItem(
"novaChats",
JSON.stringify(chats)
);

}



// ==========================
// HISTORIQUE
// ==========================

function renderHistory(){

const box=document.getElementById("history");

if(!box)return;


box.innerHTML="";


chats.forEach(chat=>{


let div=document.createElement("div");

div.className="item";


div.innerHTML=`

<span>${chat.title}</span>

<div>

<button onclick="renameChat(${chat.id})">
✏️
</button>

<button onclick="deleteChat(${chat.id})">
🗑
</button>

</div>

`;


div.onclick=()=>loadChat(chat.id);


box.appendChild(div);


});


}





function renameChat(id){

let chat=chats.find(c=>c.id===id);

let name=prompt(
"Nouveau nom",
chat.title
);


if(name){

chat.title=name;

saveChats();

renderHistory();

}

}




function deleteChat(id){

if(!confirm("Supprimer ?"))return;


chats=chats.filter(
c=>c.id!==id
);


if(currentChat?.id===id){

currentChat=null;

messages.innerHTML="";

}


saveChats();

renderHistory();

}




// ==========================
// NOUVEAU CHAT
// ==========================

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





// ==========================
// CHARGER CHAT
// ==========================


function loadChat(id){

currentChat=
chats.find(
c=>c.id===id
);


if(!currentChat)return;


let box=
document.getElementById(
"messages"
);


box.innerHTML="";


currentChat.messages.forEach(m=>{


if(m.type==="image"){


let img=document.createElement("img");

img.src=m.text;

img.className="generatedImage";

box.appendChild(img);


}

else{


addMessage(
m.text,
m.type
);


}


});


scroll();


}





// ==========================
// MESSAGE
// ==========================


function addMessage(text,type){


let box=
document.getElementById(
"messages"
);


let div=document.createElement("div");


div.className=
"msg "+type;


div.innerHTML=
text.replace(
/\n/g,
"<br>"
);


box.appendChild(div);


scroll();


}





function scroll(){

let box=
document.getElementById(
"messages"
);


box.scrollTop=
box.scrollHeight;

}



// ==========================
// CHAT IA
// ==========================


async function sendMessage(){


let input=
document.getElementById(
"input"
);


let text=input.value.trim();


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
currentChat.title==="Nouvelle conversation"
){

currentChat.title=
text.substring(0,25);

}



saveChats();

renderHistory();


input.value="";





let loading=document.createElement("div");

loading.className="msg bot";

loading.innerHTML="🤖 Nova réfléchit...";


document
.getElementById("messages")
.appendChild(loading);





try{


let response=
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



let data=
await response.json();



loading.remove();



typeWriter(
data.reply ||
"Pas de réponse."
);



}

catch(e){


loading.remove();


addMessage(
"❌ Serveur indisponible",
"bot"
);


console.error(e);


}


}




// ==========================
// ECRITURE ANIMEE
// ==========================


function typeWriter(text){


let div=document.createElement("div");


div.className="msg bot";


document
.getElementById("messages")
.appendChild(div);



let i=0;


let timer=setInterval(()=>{


div.innerHTML=
text.substring(0,i)
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


},15);



}




// ==========================
// BOUTONS RAPIDES
// ==========================


function sendQuick(text){

document.getElementById(
"input"
).value=text;


sendMessage();

}





// ==========================
// IMAGE IA
// ==========================


async function generateImage(){


let input=
document.getElementById(
"imagePrompt"
);


let prompt=
input.value.trim();



if(!prompt)return;



if(!currentChat){

newChat();

}



addMessage(
"🎨 "+prompt,
"user"
);



try{


let res=
await fetch(
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


});


let data=
await res.json();



if(data.image){


let img=
document.createElement("img");


img.src=data.image;


img.className=
"generatedImage";


document
.getElementById("messages")
.appendChild(img);



currentChat.messages.push({

text:data.image,

type:"image"

});


saveChats();

scroll();


}



}


catch(e){

alert(
"Erreur image"
);

}


}





// ==========================
// VISION
// ==========================


async function analyzeImage(){


let file=
document
.getElementById("imageUpload")
.files[0];


if(!file)return;



let reader=
new FileReader();



reader.onload=async()=>{


let base64=
reader.result.split(",")[1];



let res=
await fetch(
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


});


let data=
await res.json();


addMessage(
data.reply,
"bot"
);


};



reader.readAsDataURL(file);


}





// ==========================
// THEME
// ==========================


function toggleTheme(){

document.body.classList.toggle(
"dark"
);


localStorage.setItem(
"theme",
document.body.classList.contains("dark")
);


}




if(
localStorage.getItem("theme")==="true"
){

document.body.classList.add("dark");

}





// ==========================
// PARAMETRES
// ==========================


function toggleSettings(){

document
.getElementById("settings")
.classList.toggle(
"hidden"
);

}




function clearHistory(){


if(confirm("Tout supprimer ?")){


chats=[];

currentChat=null;


localStorage.removeItem(
"novaChats"
);


document
.getElementById("messages")
.innerHTML="";


renderHistory();


}


}




// ==========================
// START
// ==========================


renderHistory();


if(chats.length){

loadChat(
chats[0].id
);

}
```
