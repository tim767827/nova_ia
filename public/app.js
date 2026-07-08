// =====================================
// NOVA AI APP V5
// PARTIE 1/3
// =====================================


// ======================
// UTILISATEUR
// ======================


let userId =
localStorage.getItem("novaUser");



if(!userId){

userId=
"user_"+Date.now();

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
||
[];



let currentChat=null;





function saveChats(){


localStorage.setItem(

"novaChats",

JSON.stringify(chats)

);


}








// ======================
// HISTORIQUE AFFICHAGE
// ======================



function renderHistory(){


let history=
document.getElementById(
"history"
);



if(!history)return;



history.innerHTML="";



chats.forEach(chat=>{



let item=
document.createElement("div");


item.className="item";





let title=
document.createElement("span");


title.className="chatTitle";


title.textContent=
chat.title;



title.onclick=()=>{

loadChat(chat.id);

};







let actions=
document.createElement("div");


actions.className="chatActions";







let edit=
document.createElement("button");


edit.className="editBtn";


edit.textContent="✏️";



edit.onclick=(e)=>{


e.stopPropagation();



let name=
prompt(
"Nouveau titre :",
chat.title
);



if(name && name.trim()){


chat.title=
name.trim();


saveChats();

renderHistory();


}



};









let trash=
document.createElement("button");


trash.className="trashBtn";


trash.textContent="🗑️";



trash.onclick=(e)=>{


e.stopPropagation();



if(confirm(
"Supprimer cette conversation ?"
)){



chats=
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



let messages=
document.getElementById(
"messages"
);



if(messages){


messages.innerHTML="";


}



}








// ======================
// CHARGER CHAT
// ======================



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





currentChat.messages.forEach(msg=>{


if(msg.type==="image"){


let img=
document.createElement("img");


img.src=
msg.text;


img.className=
"generatedImage";


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
// AJOUT MESSAGE
// ======================



function addMessage(text,type){



let box=
document.getElementById(
"messages"
);



let div=
document.createElement("div");



div.className=
"msg "+type;




if(type==="bot"){


div.innerHTML=
cleanMarkdown(text);


}else{


div.textContent=
text;


}





box.appendChild(div);



scroll();



}








// ======================
// SCROLL
// ======================


function scroll(){


let box=
document.getElementById(
"messages"
);



if(box){

box.scrollTop=
box.scrollHeight;

}



}








// ======================
// BOUTONS RAPIDES
// ======================



function sendQuick(text){



let input=
document.getElementById(
"input"
);



input.value=text;



sendMessage();



}
// =====================================
// NETTOYAGE MARKDOWN
// =====================================


function cleanMarkdown(text){


return text


.replace(
/```([\s\S]*?)```/g,
"<pre><code>$1</code></pre>"
)


.replace(
/^### (.*$)/gim,
"<h3>$1</h3>"
)


.replace(
/^## (.*$)/gim,
"<h2>$1</h2>"
)


.replace(
/^# (.*$)/gim,
"<h1>$1</h1>"
)


.replace(
/\*\*(.*?)\*\*/g,
"<b>$1</b>"
)


.replace(
/\*(.*?)\*/g,
"<i>$1</i>"
)


.replace(
/^- (.*$)/gim,
"• $1"
)


.replace(
/\n/g,
"<br>"
);



}









// =====================================
// CHAT IA
// =====================================



async function sendMessage(){



let input=
document.getElementById(
"input"
);



let text=
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


currentChat.title=
text.substring(0,30);


renderHistory();


}




saveChats();




input.value="";







let loading=
document.createElement("div");


loading.className=
"msg bot";


loading.textContent=
"Nova réfléchit...";



document
.getElementById("messages")
.appendChild(loading);



scroll();







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






}catch(error){



console.log(error);



loading.remove();



addMessage(

"❌ Erreur serveur",

"bot"

);



}



}








// =====================================
// ECRITURE IA
// =====================================



function typeWriter(text){



let div=
document.createElement("div");



div.className=
"msg bot";



document
.getElementById("messages")
.appendChild(div);





let i=0;



let timer=
setInterval(()=>{



div.innerHTML=
cleanMarkdown(
text.substring(0,i)
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









// =====================================
// CREATION IMAGE
// =====================================



async function generateImage(){



let input=
document.getElementById(
"imagePrompt"
);



let prompt=
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



let response=
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





let data=
await response.json();







if(data.image){



let img=
document.createElement("img");



img.src=
data.image;



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





}catch(error){


console.log(error);


alert(
"Erreur création image"
);


}



}








// =====================================
// ANALYSE IMAGE
// =====================================



async function analyzeImage(){



let file=
document
.getElementById("imageUpload")
.files[0];



if(!file)return;





let reader=
new FileReader();





reader.onload=
async()=>{



let base64=
reader.result.split(",")[1];





try{



let response=
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





let data=
await response.json();





addMessage(

data.reply ||
"Pas de réponse",

"bot"

);





}catch(error){



addMessage(

"❌ Erreur analyse image",

"bot"

);


}



};





reader.readAsDataURL(file);



}
// =====================================
// EXPORT CHAT
// =====================================


function exportChat(){


if(!currentChat){


alert(
"Aucune conversation"
);


return;


}



let text=
currentChat.messages
.map(msg=>{


return (

msg.type.toUpperCase()

+

" : "

+

msg.text

);


})
.join("\n\n");





let blob=
new Blob(

[text],

{

type:"text/plain"

}

);





let link=
document.createElement("a");



link.href=
URL.createObjectURL(blob);



link.download=
"NovaAI-conversation.txt";



link.click();



}








// =====================================
// MODE SOMBRE
// =====================================



function toggleTheme(){


document.body.classList.toggle(
"dark"
);



localStorage.setItem(

"novaDark",

document.body.classList.contains(
"dark"
)

);


}






if(
localStorage.getItem("novaDark")
==="true"
){


document.body.classList.add(
"dark"
);


}








// =====================================
// PARAMETRES
// =====================================



function toggleSettings(){


let settings=
document.getElementById(
"settings"
);



if(settings){


settings.classList.toggle(
"hidden"
);


}



}








// =====================================
// SUPPRESSION HISTORIQUE
// =====================================



function clearHistory(){



if(!confirm(
"Supprimer tout l'historique ?"
))
return;





chats=[];


currentChat=null;



localStorage.removeItem(
"novaChats"
);





let box=
document.getElementById(
"messages"
);



if(box){

box.innerHTML="";

}



renderHistory();



}








// =====================================
// RECHERCHE HISTORIQUE
// =====================================



let search=
document.getElementById(
"searchHistory"
);



if(search){



search.addEventListener(
"input",
()=>{



let value=
search.value.toLowerCase();



document
.querySelectorAll(".item")
.forEach(item=>{



item.style.display=
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








// =====================================
// DRAG DROP IMAGE
// =====================================



let dropZone=
document.getElementById(
"dropZone"
);



if(dropZone){



dropZone.addEventListener(
"dragover",
e=>{


e.preventDefault();



dropZone.style.background=
"#2563eb";



}
);



dropZone.addEventListener(
"dragleave",
()=>{


dropZone.style.background=
"";


}
);



dropZone.addEventListener(
"drop",
e=>{


e.preventDefault();



let file=
e.dataTransfer.files[0];



if(file){



let input=
document.getElementById(
"imageUpload"
);



let data=
new DataTransfer();



data.items.add(file);



input.files=
data.files;



analyzeImage();



}



}

);



}









// =====================================
// DEMARRAGE
// =====================================



renderHistory();



if(chats.length){


loadChat(
chats[0].id
);


}








// =====================================
// CONNEXION HTML
// =====================================



window.newChat=
newChat;


window.sendMessage=
sendMessage;


window.sendQuick=
sendQuick;


window.generateImage=
generateImage;


window.analyzeImage=
analyzeImage;


window.toggleTheme=
toggleTheme;


window.toggleSettings=
toggleSettings;


window.clearHistory=
clearHistory;


window.exportChat=
exportChat;