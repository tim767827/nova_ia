// =====================================
// NOVA AI SERVER V6
// PARTIE 1/3
// =====================================


// IMPORTS

const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");
const rateLimit = require("express-rate-limit");

require("dotenv").config();


const {
    GoogleGenerativeAI
} = require("@google/generative-ai");



// =====================================
// CONFIGURATION
// =====================================


const app = express();


const PORT =
process.env.PORT || 3000;



const GROQ_KEY =
process.env.API_KEY;


const GEMINI_KEY =
process.env.GEMINI_KEY;


const TAVILY_KEY =
process.env.TAVILY_KEY;


const HF_KEY =
process.env.HF_API_KEY;



console.log(
"🚀 NovaAI démarrage..."
);


console.log(
"GROQ :",
GROQ_KEY ? "OK" : "ABSENTE"
);



const genAI =
new GoogleGenerativeAI(
GEMINI_KEY
);



// =====================================
// MIDDLEWARE
// =====================================


app.use(cors());


app.use(express.json({

limit:"20mb"

}));



const limiter = rateLimit({

windowMs:60 * 1000,

max:50,

message:{

error:
"Trop de requêtes."

}

});


app.use(limiter);



// =====================================
// FRONTEND
// =====================================


app.use(
express.static(
path.join(
__dirname,
"..",
"public"
)
)
);



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
// MEMOIRE NOVAAI V6
// =====================================


const userHistories = {};



function getHistory(userId){


if(!userHistories[userId]){


userHistories[userId] = [];


}


return userHistories[userId];


}




function saveMessage(
userId,
role,
content
){


const history =
getHistory(userId);



history.push({

role:role,

content:content

});



if(history.length > 30){


history.splice(
0,
history.length - 30
);


}


}





function getRecentHistory(userId){


const history =
getHistory(userId);



return history.slice(-20);


}




// =====================================
// RECHERCHE INTERNET
// =====================================


async function searchInternet(query){


try{


if(!TAVILY_KEY){


return "";

}



const response =
await fetch(

"https://api.tavily.com/search",

{


method:"POST",


headers:{


"Content-Type":
"application/json",


"Authorization":
`Bearer ${TAVILY_KEY}`


},


body:JSON.stringify({

query:query,

search_depth:"advanced",

max_results:5

})


}

);



const data =
await response.json();



if(!data.results){


return "";

}



return data.results.map(

item =>

`

Titre :
${item.title}


Résumé :
${item.content}


Lien :
${item.url}


`

).join("\n");



}catch(error){


console.log(
"TAVILY ERROR",
error
);


return "";


}


}





// =====================================
// DETECTION RECHERCHE
// =====================================


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



const lower =
text.toLowerCase();



return words.some(

word =>
lower.includes(word)

);


}
// =====================================
// CHAT IA NOVAAI V6
// =====================================


app.post("/chat",async(req,res)=>{


try{


const message =
req.body.message;


const userId =
req.body.userId || "guest";



if(!message){


return res.json({

reply:
"Écris-moi un message 🙂"

});


}




// Sauvegarde message utilisateur

saveMessage(
userId,
"user",
message
);



let webInfo="";



if(needsInternet(message)){


console.log(
"🌍 Recherche internet activée"
);


webInfo =
await searchInternet(message);


}




const messages=[


{

role:"system",

content:`

Tu es NovaAI 🚀.

Tu es un assistant IA premium français.

Règles :

- Réponds toujours en français.
- Sois professionnel et naturel.
- Utilise Markdown proprement.
- Utilise des titres ## si nécessaire.
- Utilise des listes pour organiser.
- Explique simplement les sujets complexes.
- Donne des exemples utiles.
- Ne mets jamais de **** autour des mots.
- Ne crée jamais de fausses informations.
- Si tu ne sais pas, dis-le.
- Ne prétends jamais avoir réalisé une action impossible.

Style :

- Clair.
- Moderne.
- Amical.
- Expert.

Tu aides pour :

- programmation
- création de projets
- rédaction
- apprentissage
- analyse
- idées
- organisation

Tu représentes NovaAI 🚀.

`

}


];





if(webInfo){


messages.push({

role:"system",

content:`

Informations trouvées sur internet :

${webInfo}


Utilise uniquement ces informations.

`

});


}





messages.push(

...getRecentHistory(userId)

);





if(!GROQ_KEY){


return res.json({

reply:
"⚠️ Clé Groq absente."

});


}





const response =
await fetch(

"https://api.groq.com/openai/v1/chat/completions",

{


method:"POST",


headers:{


"Content-Type":
"application/json",


Authorization:
`Bearer ${GROQ_KEY}`


},


body:JSON.stringify({


model:
"llama-3.3-70b-versatile",


messages,


temperature:0.5


})


}

);






const data =
await response.json();





if(data.error){


console.log(
"GROQ ERROR",
data.error
);



return res.json({

reply:
"⚠️ Le service IA est momentanément indisponible."

});


}






let reply =

data?.choices?.[0]?.message?.content

||

"Je n'ai pas trouvé de réponse.";





// Nettoyage réponse

reply =
reply
.replace(/\*\*\*/g,"")
.trim();






// Sauvegarde IA

saveMessage(

userId,

"assistant",

reply

);






res.json({

reply:reply

});






}catch(error){


console.log(

"CHAT ERROR",

error

);



res.json({

reply:
"❌ Erreur serveur NovaAI."

});


}


});





// =====================================
// VISION IMAGE
// =====================================


app.post("/vision",async(req,res)=>{


try{


const image =
req.body.image;



const mimeType =
req.body.mimeType ||
"image/jpeg";




if(!image){


return res.json({

reply:
"Aucune image reçue."

});


}






const model =
genAI.getGenerativeModel({

model:
"gemini-2.5-flash"

});






const result =
await model.generateContent([



{

inlineData:{


data:image,


mimeType:mimeType


}


},



`

Analyse cette image.

Réponds en français.

Décris les éléments importants.

Lis les textes visibles.

Explique clairement.

`

]);






res.json({

reply:
result.response.text()

});






}catch(error){


console.log(

"VISION ERROR",

error

);



res.json({

reply:
"Impossible d'analyser cette image."

});


}


});
// =====================================
// GENERATION IMAGE HUGGING FACE
// =====================================


app.post("/generate-image",async(req,res)=>{


try{


const prompt =
req.body.prompt;



if(!prompt){


return res.json({

error:
"Description manquante."

});


}




if(!HF_KEY){


return res.json({

error:
"Clé image absente."

});


}






const response =
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


const error =
await response.text();


console.log(
"HF ERROR",
error
);



return res.json({

error:
"Erreur génération image."

});


}






const buffer =
await response.arrayBuffer();



const base64 =
Buffer.from(buffer)
.toString("base64");





res.json({

image:
"data:image/png;base64,"+base64,


message:
"Image créée avec succès 🚀"

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
// TESTS
// =====================================


app.get("/test",(req,res)=>{


res.json({

status:
"NovaAI V6 fonctionne 🚀"

});


});






app.get("/health",(req,res)=>{


res.status(200).json({

status:
"online",


version:
"V6"

});


});






// =====================================
// ERREUR FAVICON
// =====================================


app.get("/favicon.ico",(req,res)=>{


res.status(204).end();


});






// =====================================
// DEMARRAGE
// =====================================


app.listen(PORT,()=>{


console.log(

`🚀 NovaAI V6 lancé sur le port ${PORT}`

);


});