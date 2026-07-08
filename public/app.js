let userId=localStorage.getItem("novaUser");

if(!userId){
userId="user_"+Date.now();
localStorage.setItem("novaUser",userId);
}


let chats=JSON.parse(localStorage.getItem("novaChats"))||[];
let currentChat=null;



function saveChats(){
localStorage.setItem("novaChats",JSON.stringify(chats));
}



function renderHistory(){

let box=document.getElementById("history");

box.innerHTML="";

chats.forEach(chat=>{

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




function renameChat(e,id){

e.stopPropagation();

let chat=chats.find(c=>c.id===id);

let name=prompt("Nouveau nom :",chat.title);

if(name&&name.trim()){

chat.title=name.trim();

saveChats();
renderHistory();

}

}



function deleteChat(e,id){

e.stopPropagation();


if(!confirm("Supprimer cette conversation ?"))return;


chats=chats.filter(c=>c.id!==id);


if(currentChat&&currentChat.id===id){

currentChat=null;

document.getElementById("messages").innerHTML="";

}


saveChats();
renderHistory();

}




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




function loadChat(id){

currentChat=chats.find(c=>c.id===id);

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

addMessage(msg.text,msg.type);

}


});

scroll();

}




function addMessage(text,type){

let box=document.getElementById("messages");

let div=document.createElement("div");

div.className="msg "+type;

div.innerHTML=text.replace(/\n/g,"<br>");

box.appendChild(div);

scroll();

}




function scroll(){

let box=document.getElementById("messages");

box.scrollTop=box.scrollHeight;

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


addMessage(text,"user");


currentChat.messages.push({
text:text,
type:"user"
});


if(currentChat.title==="Nouvelle conversation"){

currentChat.title=text.substring(0,25);

}


saveChats();
renderHistory();


input.value="";



let loading=document.createElement("div");

loading.className="msg bot";

loading.textContent="🤖 Nova réfléchit...";

document.getElementById("messages").appendChild(loading);



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


typeWriter(data.reply||"Pas de réponse");


}catch(e){


loading.remove();

addMessage("❌ Erreur serveur","bot");

console.log(e);

}


}




function typeWriter(text){

let div=document.createElement("div");

div.className="msg bot";

document.getElementById("messages").appendChild(div);


let i=0;


let timer=setInterval(()=>{


div.innerHTML=text.substring(0,i).replace(/\n/g,"<br>");

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





async function generateImage(){


let input=document.getElementById("imagePrompt");

let prompt=input.value.trim();


if(!prompt)return;


if(!currentChat){
newChat();
}


addMessage("🎨 "+prompt,"user");



try{


let res=await fetch("/generate-image",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
prompt:prompt
})
});


let data=await res.json();


if(data.image){


let img=document.createElement("img");

img.src=data.image;

img.className="generatedImage";


document.getElementById("messages").appendChild(img);



currentChat.messages.push({
text:data.image,
type:"image"
});


saveChats();

scroll();

}


}catch(e){

alert("Erreur image");

}


}





async function analyzeImage(){


let file=document.getElementById("imageUpload").files[0];


if(!file)return;



let reader=new FileReader();



reader.onload=async()=>{


let base64=reader.result.split(",")[1];


let res=await fetch("/vision",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
image:base64
})
});


let data=await res.json();


addMessage(data.reply||"Aucune analyse","bot");


};


reader.readAsDataURL(file);


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

document.getElementById("settings").classList.toggle("hidden");

}




function clearHistory(){

if(!confirm("Supprimer tout l'historique ?"))return;


chats=[];

currentChat=null;

localStorage.removeItem("novaChats");


document.getElementById("messages").innerHTML="";


renderHistory();

}




renderHistory();


if(chats.length){

loadChat(chats[0].id);

}
