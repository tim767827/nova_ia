// =====================================
// NOVA AI SERVER V3
// PARTIE 1/2
// =====================================

const express=require("express");
const cors=require("cors");
const path=require("path");
const fetch=require("node-fetch");
const rateLimit=require("express-rate-limit");
const fs=require("fs");

require("dotenv").config();

const {GoogleGenerativeAI}=require("@google/generative-ai");


// =====================================
// CONFIG
// =====================================

const app=express();

const PORT=process.env.PORT||3000;


const GROQ_KEY=process.env.API_KEY;
const GEMINI_KEY=process.env.GEMINI_KEY;
const TAVILY_KEY=process.env.TAVILY_KEY;
const HF_KEY=process.env.HF_API_KEY;



const genAI=new GoogleGenerativeAI(GEMINI_KEY);



console.log("🚀 Démarrage NovaAI V3");



// =====================================
// MIDDLEWARE
// =====================================

app.use(cors());


app.use(express.json({
limit:"15mb"
}));



const limiter=rateLimit({

windowMs:60*1000,

max:50,

message:{
error:"Trop de requêtes. Réessaie plus tard."
}

});


app.use(limiter);



// =====================================
// FRONTEND
// =====================================

app.use(express.static(
path.join(__dirname,"..","public")
));


app.get("/",(req,res)=>{

res.sendFile(
path.join(
__dirname,
"..",
"public",
"index.html"
)
);

});



// =====================================
// MEMOIRE NOVA
// =====================================


const memoryFile=
path.join(
__dirname,
"memory.json"
);



let userHistories={};



if(fs.existsSync(memoryFile)){

try{

userHistories=
JSON.parse(
fs.readFileSync(memoryFile,"utf8")
);

}catch{

userHistories={};

}

}



function saveMemory(){

fs.writeFileSync(
memoryFile,
JSON.stringify(
userHistories,
null,
2
)
);

}




// =====================================
// OUTILS
// =====================================


function cleanText(text){

if(!text)return "";

return String(text)
.trim()
.substring(0,4000);

}




function needsInternet(text){

const words=[

"actualité",
"news",
"aujourd'hui",
"hier",
"demain",
"prix",
"météo",
"score",
"match",
"résultat",
"politique",
"président",
"2025",
"2026"

];


text=text.toLowerCase();


return words.some(
w=>text.includes(w)
);

}




// =====================================
// RECHERCHE TAVILY
// =====================================


async function searchInternet(query){


try{


if(!TAVILY_KEY){

return "Recherche internet indisponible.";

}



let response=await fetch(

"https://api.tavily.com/search",

{

method:"POST",

headers:{

"Content-Type":"application/json",

"Authorization":
`Bearer ${TAVILY_KEY}`

},

body:JSON.stringify({

query,

search_depth:"advanced",

max_results:5

})

}

);



let data=await response.json();



if(!data.results){

return "Aucun résultat.";

}



return data.results.map(
(r,i)=>`

SOURCE ${i+1}

Titre:
${r.title}

Résumé:
${r.content}

Lien:
${r.url}

`
).join("\n");



}catch(error){


console.log(
"TAVILY ERROR",
error
);


return "Recherche impossible.";

}


}




// =====================================
// CHAT IA
// =====================================


app.post("/chat",async(req,res)=>{


try{


let message=
cleanText(
req.body.message
);


let userId=
req.body.userId||
"guest";



if(!message){

return res.json({

reply:
"Écris-moi un message 🙂"

});

}




if(!userHistories[userId]){

userHistories[userId]=[];

}



let history=
userHistories[userId];



history.push({

role:"user",

content:message

});



if(history.length>20){

history.shift();

}




let messages=[{


role:"system",

content:`

Tu es NovaAI 🚀.

Assistant IA professionnel français.

Règles:

- Réponds en français.
- Sois clair et utile.
- Structure les réponses.
- Utilise Markdown.
- N'invente jamais.
- Explique simplement.
- Reste professionnel.

`

}];





if(needsInternet(message)){


let web=
await searchInternet(message);


messages.push({

role:"system",

content:
"Informations web:\n"+web

});


}





messages.push(
...history
);





if(!GROQ_KEY){

return res.json({

reply:
"API Groq manquante."

});

}





let response=await fetch(

"https://api.groq.com/openai/v1/chat/completions",

{

method:"POST",

headers:{

"Content-Type":"application/json",

Authorization:
`Bearer ${GROQ_KEY}`

},

body:JSON.stringify({

model:
"llama-3.3-70b-versatile",

messages,

temperature:0.7

})

}

);



let data=await response.json();



let reply=

data?.choices?.[0]?.message?.content

||

"Je n'ai pas trouvé de réponse.";





history.push({

role:"assistant",

content:reply

});



saveMemory();



res.json({

reply

});



}catch(error){


console.log(
"CHAT ERROR",
error
);



res.json({

reply:
"Erreur serveur NovaAI."

});


}


});
// =====================================
// ANALYSE IMAGE GEMINI
// =====================================


app.post("/vision",async(req,res)=>{


try{


const image=req.body.image;


const mimeType=
req.body.mimeType||
"image/jpeg";



if(!image){

return res.json({

reply:
"Aucune image reçue."

});

}



if(!GEMINI_KEY){

return res.json({

reply:
"Clé Gemini manquante."

});

}




const model=
genAI.getGenerativeModel({

model:
"gemini-2.5-flash"

});




const result=
await model.generateContent([

{

inlineData:{

data:image,

mimeType:mimeType

}

},

`

Tu es NovaAI Vision.

Analyse cette image en français.

Donne:

- ce que tu vois
- les éléments importants
- les textes visibles
- une explication claire

`

]);



const text=
result.response.text();



res.json({

reply:text

});



}catch(error){


console.log(
"GEMINI VISION ERROR",
error
);


res.json({

reply:
"Impossible d'analyser cette image."

});


}


});






// =====================================
// CREATION IMAGE HUGGING FACE
// =====================================


app.post("/generate-image",async(req,res)=>{


try{


const prompt=
cleanText(
req.body.prompt
);



if(!prompt){

return res.json({

error:
"Description manquante."

});

}




if(!HF_KEY){

return res.json({

error:
"Clé image manquante."

});

}




const response=
await fetch(

"https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",

{

method:"POST",

headers:{

Authorization:
`Bearer ${HF_KEY}`,

"Content-Type":
"application/json"

},


body:JSON.stringify({

inputs:prompt

})

}

);





if(!response.ok){


console.log(
await response.text()
);


return res.json({

error:
"Erreur génération image."

});


}




const buffer=
await response.arrayBuffer();



const base64=
Buffer.from(buffer)
.toString("base64");





res.json({

image:
"data:image/png;base64,"+base64,

message:
"Image créée 🚀"

});




}catch(error){


console.log(
"IMAGE ERROR",
error
);



res.json({

error:
"Erreur création image."

});


}


});







// =====================================
// SUPPRIMER MEMOIRE
// =====================================


app.post("/clear-memory",async(req,res)=>{


try{


const userId=
req.body.userId||
"guest";



delete userHistories[userId];


saveMemory();



res.json({

success:true,

message:
"Mémoire supprimée."

});



}catch(error){


res.json({

success:false

});


}


});







// =====================================
// INFORMATIONS SERVEUR
// =====================================


app.get("/test",(req,res)=>{


res.json({

status:
"NovaAI V3 fonctionne 🚀"

});


});





app.get("/health",(req,res)=>{


res.status(200).json({

status:
"online",

service:
"NovaAI",

version:
"V3"

});


});







// =====================================
// ERREUR GENERALE
// =====================================


app.use((err,req,res,next)=>{


console.log(
"SERVER ERROR",
err
);


res.status(500).json({

error:
"Erreur interne NovaAI."

});


});







// =====================================
// DEMARRAGE
// =====================================


app.listen(PORT,()=>{


console.log(

`✅ NovaAI V3 lancé sur le port ${PORT}`

);


});
