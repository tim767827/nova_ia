// =====================================
// NOVA AI APP.JS V4
// PARTIE 1/2
// =====================================


let userId=localStorage.getItem("novaUser");


if(!userId){

userId="user_"+Date.now();

localStorage.setItem(
"novaUser",
userId
);

}




let chats=JSON.parse(
localStorage.getItem("novaChats")
)||[];


let currentChat=null;





// =====================================
// SAUVEGARDE
// =====================================


function saveChats(){

localStorage.setItem(
"novaChats",
JSON.stringify(chats)
);

}





// =====================================
// HISTORIQUE
// =====================================


function renderHistory(){


let history=document.getElementById("history");


if(!history)return;



history.innerHTML="";



let search=
document.getElementById("searchHistory")
?.value
.toLowerCase()
||"";



chats
.filter(chat=>
chat.title
.toLowerCase()
.includes(search)
)
.forEach(chat=>{


let item=document.createElement("div");

item.className="item";



let title=document.createElement("span");

title.textContent=chat.title;


title.onclick=()=>loadChat(chat.id);





let actions=document.createElement("div");



let edit=document.createElement("button");

edit.textContent="✏️";


edit.onclick=(e)=>{

e.stopPropagation();


let name=prompt(
"Nouveau titre :",
chat.title
);


if(name){

chat.title=name.trim();

saveChats();

renderHistory();

}

};





let trash=document.createElement("button");

trash.textContent="🗑️";


trash.onclick=(e)=>{

e.stopPropagation();


deleteChat(chat.id);

};





actions.appendChild(edit);

actions.appendChild(trash);



item.appendChild(title);

item.appendChild(actions);



history.appendChild(item);



});


}






document
.getElementById("searchHistory")
?.addEventListener(
"input",
renderHistory
);








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


document.getElementById("messages").innerHTML="";

}








function deleteChat(id){


if(!confirm(
"Supprimer cette conversation ?"
))
return;



chats=
chats.filter(
c=>c.id!==id
);



if(currentChat?.id===id){

currentChat=null;

}



saveChats();

renderHistory();


document.getElementById("messages").innerHTML="";

}









function loadChat(id){


currentChat=
chats.find(
c=>c.id===id
);



if(!currentChat)return;



let box=document.getElementById("messages");


box.innerHTML="";



currentChat.messages.forEach(msg=>{


if(msg.type==="image"){


let img=document.createElement("img");

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


scroll();

}









// =====================================
// MESSAGE
// =====================================



function cleanMarkdown(text){


return text

.replace(/\*\*(.*?)\*\*/g,"<b>$1</b>")

.replace(/\*(.*?)\*/g,"<i>$1</i>")

.replace(/`(.*?)`/g,"<code>$1</code>")

.replace(/\n/g,"<br>");

}







function addMessage(text,type){


let box=document.getElementById("messages");


let div=document.createElement("div");


div.className=
"msg "+type;



div.innerHTML=
cleanMarkdown(text);




if(type==="bot"){


let copy=document.createElement("button");


copy.className="copyBtn";


copy.textContent="📋";


copy.onclick=()=>{


navigator.clipboard.writeText(text);


copy.textContent="✅";


setTimeout(()=>{

copy.textContent="📋";

},1000);


};



div.appendChild(copy);


}



box.appendChild(div);


scroll();


}






function scroll(){


let box=document.getElementById("messages");


box.scrollTop=
box.scrollHeight;


}






// =====================================
// REPONSES RAPIDES
// =====================================



function sendQuick(text){


document.getElementById("input").value=text;


sendMessage();


}








// =====================================
// CHAT IA
// =====================================



async function sendMessage(){


let input=
document.getElementById("input");


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
text
.substring(0,30)
.replace(/[^\wÀ-ÿ ]/g,"")
.trim();


}



saveChats();

renderHistory();


input.value="";





let loading=document.createElement("div");


loading.className="msg bot";


loading.textContent="🤖 Nova écrit...";



document
.getElementById("messages")
.appendChild(loading);



try{


let response=
await fetch("/chat",{


method:"POST",


headers:{

"Content-Type":
"application/json"

},


body:JSON.stringify({

message:text,

userId:userId

})


});



let data=
await response.json();



loading.remove();



typeWriter(
data.reply ||
"Pas de réponse."
);



}catch(error){


loading.remove();


addMessage(
"❌ Erreur serveur",
"bot"
);


console.log(error);


}


}
// =====================================
// ECRITURE IA
// =====================================


function typeWriter(text){


let div=document.createElement("div");


div.className="msg bot";


document
.getElementById("messages")
.appendChild(div);



let i=0;



let timer=setInterval(()=>{


div.innerHTML=
cleanMarkdown(
text.substring(0,i)
);



let copy=document.createElement("button");


copy.className="copyBtn";


copy.textContent="📋";


copy.onclick=()=>{

navigator.clipboard.writeText(text);

copy.textContent="✅";

};



div.appendChild(copy);



i++;


scroll();



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







// =====================================
// CREATION IMAGE
// =====================================



async function generateImage(){



let input=
document.getElementById("imagePrompt");


let prompt=
input.value.trim();



if(!prompt){

alert("Décris une image");

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


let res=
await fetch("/generate-image",{


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


let img=document.createElement("img");


img.src=data.image;


img.className="generatedImage";



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


alert("Erreur création image");


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



sendVisionFile(file);



}








function previewFile(file){



let reader=
new FileReader();



reader.onload=()=>{


let img=
document.getElementById("previewImage");



if(img){


img.src=reader.result;


img.classList.remove(
"hidden"
);


}



};



reader.readAsDataURL(file);


}









async function sendVisionFile(file){


previewFile(file);



let reader=
new FileReader();



reader.onload=async()=>{


let base64=
reader.result.split(",")[1];



try{


let res=
await fetch("/vision",{


method:"POST",


headers:{

"Content-Type":
"application/json"

},


body:JSON.stringify({

image:base64,

mimeType:file.type

})


});



let data=
await res.json();



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


dropZone.style.color=
"white";


}

);



dropZone.addEventListener(
"dragleave",
()=>{


dropZone.style.background="";


dropZone.style.color="";


}

);



dropZone.addEventListener(
"drop",
e=>{


e.preventDefault();



let file=
e.dataTransfer.files[0];



if(file){

sendVisionFile(file);

}



}

);



}







// =====================================
// EXPORT
// =====================================



function exportChat(){


if(!currentChat){

alert("Aucune conversation");

return;

}



let content=
currentChat.messages
.map(m=>{

return m.type.toUpperCase()
+
" : "
+
m.text;

})
.join("\n\n");



let blob=
new Blob(
[content],
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
// PARAMETRES
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








function toggleSettings(){


let box=
document.getElementById(
"settings"
);



if(box){

box.classList.toggle(
"hidden"
);

}


}







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



document
.getElementById("messages")
.innerHTML="";



renderHistory();



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



// rendre les fonctions visibles au HTML

window.newChat=newChat;

window.sendMessage=sendMessage;

window.sendQuick=sendQuick;

window.generateImage=generateImage;

window.analyzeImage=analyzeImage;

window.toggleTheme=toggleTheme;

window.toggleSettings=toggleSettings;

window.clearHistory=clearHistory;

window.exportChat=exportChat;
