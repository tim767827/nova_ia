/* =====================================
   NOVA AI V6
   APP.JS PARTIE 1/2
===================================== */


// ======================
// UTILISATEUR
// ======================


let userId = localStorage.getItem("novaUser");


if(!userId){

userId = "user_" + Date.now();

localStorage.setItem(
"novaUser",
userId
);

}





// ======================
// HISTORIQUE
// ======================


let chats =
JSON.parse(
localStorage.getItem("novaChats")
)
|| [];


let currentChat = null;
let autoScroll = true;



function saveChats(){

localStorage.setItem(
"novaChats",
JSON.stringify(chats)
);

}







// ======================
// MOBILE SIDEBAR
// ======================


function toggleSidebar(){

const sidebar =
document.getElementById("sidebar");

const overlay =
document.querySelector(".overlay");


if(sidebar){

sidebar.classList.toggle("open");

}


if(overlay){

overlay.style.display =
sidebar.classList.contains("open")
? "block"
: "none";

}

}
window.toggleSidebar = toggleSidebar;







// ======================
// AFFICHAGE HISTORIQUE
// ======================


function renderHistory(){


let history =
document.getElementById("history");


if(!history)return;


history.innerHTML="";



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
   document
.getElementById("sidebar")
?.classList.remove("open");

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









// ======================
// NOUVEAU CHAT
// ======================


function newChat(){


currentChat={


id:Date.now(),


title:"Nouvelle conversation",


messages:[]


};



chats.unshift(currentChat);


saveChats();


renderHistory();



let box =
document.getElementById("messages");


if(box){

box.innerHTML="";

}


}









// ======================
// CHARGER CHAT
// ======================


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


img.src=msg.text;


img.className="generatedImage";


box.appendChild(img);



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



let box =
document.getElementById("messages");



let welcome =
document.querySelector(".welcome");



if(welcome){

welcome.remove();

}




let div =
document.createElement("div");


div.className =
"msg "+type;



if(type==="bot"){

div.innerHTML =
cleanMarkdown(text);


}else{


div.textContent=text;


}



box.appendChild(div);


scroll();



}








function scroll(){


let box =
document.getElementById("messages");


if(box){

box.scrollTop =
box.scrollHeight;

}


}
const messageBox =
document.getElementById("messages");


if(messageBox){

messageBox.addEventListener(
"scroll",
()=>{


autoScroll =
messageBox.scrollTop + messageBox.clientHeight
>=
messageBox.scrollHeight - 80;


});


}







// ======================
// MARKDOWN
// ======================


function cleanMarkdown(text){

return marked.parse(text);

}
/* =====================================
   NOVA AI V6
   APP.JS PARTIE 2/2
===================================== */



// ======================
// MESSAGE RAPIDE
// ======================


function sendQuick(text){


let input =
document.getElementById("input");


input.value=text;


sendMessage();


}









// ======================
// CHAT IA
// ======================


async function sendMessage(){


let input =
document.getElementById("input");


let text =
input.value.trim();



if(!text)return;




if(!currentChat){

newChat();
   document
.getElementById("sidebar")
?.classList.remove("open");

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
text.substring(0,30);


renderHistory();


}




saveChats();


input.value="";






let loading =
document.createElement("div");


loading.className="msg bot";


loading.textContent=
"Nova réfléchit...";



document
.getElementById("messages")
.appendChild(loading);



scroll();







try{


let response =
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




let data =
await response.json();



loading.remove();




typeWriter(

data.reply ||
"Pas de réponse."

);




}catch(error){


console.log(error);



loading.remove();



addMessage(

"❌ Erreur serveur",

"bot"

);



}



}









// ======================
// ECRITURE IA
// ======================


function typeWriter(text){


let div =
document.createElement("div");



div.className =
"msg bot";



document
.getElementById("messages")
.appendChild(div);



let i=0;



let timer =
setInterval(()=>{


div.innerHTML =
cleanMarkdown(
text.substring(0,i)
);



if(autoScroll){

scroll();

}


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



let input =
document.getElementById("imagePrompt");



let prompt =
input.value.trim();



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



let response =
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


}

);





let data =
await response.json();





if(data.image){


let img =
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



}else{


alert(
data.error ||
"Erreur image"
);


}



}catch(e){


alert(
"Erreur création image"
);


}



}









// ======================
// APERCU IMAGE
// ======================


function previewImage(event){



let file =
event.target.files[0];



let preview =
document.getElementById(
"previewImage"
);



if(file && preview){



preview.src =
URL.createObjectURL(file);



preview.classList.remove(
"hidden"
);



}



}





window.previewImage =
previewImage;









// ======================
// ANALYSE IMAGE
// ======================


async function analyzeImage(){



let file =
document
.getElementById("imageUpload")
.files[0];



if(!file)return;



let reader =
new FileReader();





reader.onload = async()=>{



let base64 =
reader.result.split(",")[1];




try{



let response =
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





let data =
await response.json();





addMessage(

data.reply ||
"Pas de réponse",

"bot"

);





}catch(e){



addMessage(

"❌ Erreur analyse image",

"bot"

);



}



};



reader.readAsDataURL(file);



}









async function sendFile(){


let file =
document
.getElementById("fileInput")
.files[0];


if(!file){

alert("Choisis un fichier");

return;

}



addMessage(
"📄 Fichier envoyé : "+file.name,
"user"
);



addMessage(
"⏳ Analyse du fichier en cours...",
"bot"
);




try{


let formData =
new FormData();



formData.append(
"file",
file
);




let response =
await fetch(
"/upload",
{

method:"POST",

body:formData

}

);





let data =
await response.json();





addMessage(

data.reply ||
"Impossible d'analyser le fichier.",

"bot"

);





}
catch(error){


console.log(
"FILE ERROR",
error
);



addMessage(

"❌ Erreur pendant l'analyse du fichier.",

"bot"

);


}



}





// ======================
// EXPORT
// ======================


function exportChat(){



if(!currentChat){

alert(
"Aucune conversation"
);

return;

}



let text =
currentChat.messages

.map(m=>

m.type.toUpperCase()
+" : "
+m.text

)

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
"NovaAI-chat.txt";


link.click();



}









// ======================
// THEME
// ======================


function toggleTheme(){



document.body
.classList.toggle("dark");



localStorage.setItem(

"novaDark",

document.body
.classList.contains("dark")

);



}



if(
localStorage.getItem("novaDark")
==="true"
){


document.body.classList.add("dark");


}









// ======================
// SETTINGS
// ======================


function toggleSettings(){



let box =
document.getElementById(
"settings"
);



if(box){

box.classList.toggle(
"hidden"
);


}


}









// ======================
// SUPPRIMER HISTORIQUE
// ======================


function clearHistory(){



if(!confirm(
"Supprimer tout ?"
))
return;



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









// ======================
// RECHERCHE
// ======================


let search =
document.getElementById(
"searchHistory"
);



if(search){


search.addEventListener(
"input",
()=>{


let value =
search.value.toLowerCase();



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


});


}









// ======================
// DRAG DROP
// ======================


let dropZone =
document.getElementById(
"dropZone"
);



if(dropZone){


dropZone.addEventListener(
"dragover",
e=>{

e.preventDefault();

}

);



dropZone.addEventListener(
"drop",
e=>{


e.preventDefault();



let file =
e.dataTransfer.files[0];



if(file){


let input =
document.getElementById(
"fileInput"
);



let dt =
new DataTransfer();



dt.items.add(file);


input.files =
dt.files;



sendFile();


}



}

);


}









// ======================
// START
// ======================


renderHistory();



if(chats.length){

loadChat(
chats[0].id
);

}









// ======================
// EXPORT GLOBAL
// ======================


window.newChat=newChat;

window.sendMessage=sendMessage;

window.sendQuick=sendQuick;

window.generateImage=generateImage;

window.analyzeImage=analyzeImage;

window.toggleTheme=toggleTheme;

window.toggleSettings=toggleSettings;

window.clearHistory=clearHistory;

window.exportChat=exportChat;

window.sendFile=sendFile;
