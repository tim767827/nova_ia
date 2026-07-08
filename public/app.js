let userId=localStorage.getItem("novaUser");

if(!userId){
userId="user_"+Date.now();
localStorage.setItem("novaUser",userId);
}


let chats=JSON.parse(localStorage.getItem("novaChats"))||[];
let currentChat=null;



function saveChats(){
localStorage.setItem(
"novaChats",
JSON.stringify(chats)
);
}




function renderHistory(){

let box=document.getElementById("history");

box.innerHTML="";


let search=document.getElementById("searchHistory")?.value.toLowerCase()||"";


chats
.filter(c=>c.title.toLowerCase().includes(search))
.forEach(chat=>{


let div=document.createElement("div");

div.className="item";


div.innerHTML=`

<span>${chat.title}</span>

<div>

<button onclick="renameChat(event,${chat.id})">✏️</button>

<button onclick="deleteChat(event,${chat.id})">🗑️</button>

</div>

`;


div.onclick=()=>loadChat(chat.id);


box.appendChild(div);


});


}





document.getElementById("searchHistory")
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


chats.unshift(currentChat);

saveChats();

renderHistory();


document.getElementById("messages").innerHTML="";

}





function renameChat(e,id){

e.stopPropagation();


let chat=chats.find(c=>c.id===id);


let name=prompt(
"Nouveau nom :",
chat.title
);


if(name){

chat.title=name;

saveChats();

renderHistory();

}

}





function deleteChat(e,id){

e.stopPropagation();


if(!confirm("Supprimer ?"))return;


chats=chats.filter(
c=>c.id!==id
);


currentChat=null;


saveChats();

renderHistory();

document.getElementById("messages").innerHTML="";


}





function loadChat(id){

currentChat=
chats.find(c=>c.id===id);


let box=document.getElementById("messages");

box.innerHTML="";


currentChat.messages.forEach(m=>{


if(m.type==="image"){

let img=document.createElement("img");

img.src=m.text;

img.className="generatedImage";

box.appendChild(img);


}else{

addMessage(
m.text,
m.type
);

}


});


scroll();

}







function addMessage(text,type){


let box=document.getElementById("messages");


let div=document.createElement("div");

div.className="msg "+type;


div.innerHTML=text.replace(
/\n/g,
"<br>"
);



if(type==="bot"){


let btn=document.createElement("button");

btn.className="copyBtn";

btn.innerHTML="📋";

btn.onclick=()=>{

navigator.clipboard.writeText(text);

btn.innerHTML="✅";

setTimeout(()=>btn.innerHTML="📋",1000);

};


div.appendChild(btn);

}



box.appendChild(div);

scroll();


}






function sendQuick(text){

document.getElementById("input").value=text;

sendMessage();

}





async function sendMessage(){


let input=document.getElementById("input");

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

text,

type:"user"

});



if(currentChat.title==="Nouvelle conversation"){

currentChat.title=text.substring(0,30);

}



saveChats();

renderHistory();


input.value="";



let loading=document.createElement("div");

loading.className="msg bot";

loading.textContent="🤖 Nova écrit...";


document.getElementById("messages")
.appendChild(loading);



try{


let res=await fetch("/chat",{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

message:text,

userId:userId

})

});



let data=await res.json();


loading.remove();



typeWriter(
data.reply||"Pas de réponse"
);



}catch(e){


loading.remove();

addMessage(
"❌ Erreur serveur",
"bot"
);


}

}





function formatText(text){

return text
.replace(/\*\*(.*?)\*\*/g,"<b>$1</b>")
.replace(/\*(.*?)\*/g,"<i>$1</i>")
.replace(/`(.*?)`/g,"<code>$1</code>")
.replace(/\n/g,"<br>");

}



function typeWriter(text){

let div=document.createElement("div");

div.className="msg bot";


document.getElementById("messages")
.appendChild(div);


let i=0;


let timer=setInterval(()=>{


div.innerHTML=
formatText(text.substring(0,i))
+
`<button class="copyBtn" onclick="navigator.clipboard.writeText(\`${text}\`)">📋</button>`;



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

currentChat.messages.push({

text,

type:"bot"

});


saveChats();


}



},15);


}







async function generateImage(){


let prompt=
document.getElementById("imagePrompt")
.value.trim();



if(!prompt)return;



try{


let res=await fetch(
"/generate-image",
{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

prompt

})

});


let data=await res.json();



if(data.image){


let img=document.createElement("img");

img.src=data.image;

img.className="generatedImage";


document.getElementById("messages")
.appendChild(img);



currentChat.messages.push({

text:data.image,

type:"image"

});


saveChats();

scroll();


}



}catch{

alert("Erreur image");

}


}






async function analyzeImage(){


let file=
document.getElementById("imageUpload")
.files[0];


if(!file)return;



let reader=new FileReader();



reader.onload=async()=>{


let base64=
reader.result.split(",")[1];



let preview=
document.getElementById("previewImage");


preview.src=reader.result;

preview.classList.remove("hidden");



let res=await fetch(
"/vision",
{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

image:base64,

mimeType:file.type

})

});



let data=await res.json();


addMessage(
data.reply,
"bot"
);


};



reader.readAsDataURL(file);


}






function exportChat(){


if(!currentChat)return;


let text=
currentChat.messages
.map(m=>m.type+": "+m.text)
.join("\n\n");



let blob=
new Blob(
[text],
{
type:"text/plain"
}
);



let a=document.createElement("a");

a.href=
URL.createObjectURL(blob);


a.download="NovaAI-chat.txt";


a.click();


}







function toggleTheme(){

document.body.classList.toggle("dark");


localStorage.setItem(
"dark",
document.body.classList.contains("dark")
);


}



if(localStorage.getItem("dark")==="true"){

document.body.classList.add("dark");

}





function toggleSettings(){

document
.getElementById("settings")
.classList.toggle("hidden");

}





function clearHistory(){


if(!confirm("Tout supprimer ?"))
return;


chats=[];

currentChat=null;


localStorage.removeItem("novaChats");


document.getElementById("messages")
.innerHTML="";


renderHistory();


}





// DRAG DROP IMAGE


let drop=document.getElementById("dropZone");


drop?.addEventListener(
"dragover",
e=>e.preventDefault()
);



drop?.addEventListener(
"drop",
e=>{


e.preventDefault();


let file=e.dataTransfer.files[0];


if(file){


document.getElementById("imageUpload")
.files=e.dataTransfer.files;


analyzeImage();


}


});





renderHistory();


if(chats.length){

loadChat(chats[0].id);

}
