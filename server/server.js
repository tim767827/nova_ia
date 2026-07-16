// =====================================
// NOVA AI SERVER V7
// PARTIE 1/3
// =====================================


// =====================================
// IMPORTS
// =====================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

require("dotenv").config();


const {
    GoogleGenerativeAI
} = require("@google/generative-ai");



// =====================================
// CONFIG
// =====================================


const app = express();


const PORT =
process.env.PORT || 3000;



// API KEYS

const GROQ_KEY =
process.env.GROQ_KEY || process.env.API_KEY;


const GEMINI_KEY =
process.env.GEMINI_KEY;


const HF_KEY =
process.env.HF_API_KEY;


const TAVILY_KEY =
process.env.TAVILY_KEY;



console.log("🚀 NovaAI V7 démarrage");


console.log(
"GROQ:",
GROQ_KEY ? "OK" : "ABSENTE"
);


console.log(
"GEMINI:",
GEMINI_KEY ? "OK" : "ABSENTE"
);


console.log(
"HUGGING FACE:",
HF_KEY ? "OK" : "ABSENTE"
);



let genAI = null;


if(GEMINI_KEY){

genAI =
new GoogleGenerativeAI(
GEMINI_KEY
);

}



// =====================================
// MIDDLEWARE
// =====================================


app.use(cors());


app.use(express.json({

limit:"25mb"

}));



const limiter =
rateLimit({

windowMs:
60 * 1000,


max:
60,


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
// UPLOAD
// =====================================


const upload =
multer({

storage:
multer.memoryStorage(),


limits:{

fileSize:
15 * 1024 * 1024

}

});





// =====================================
// MEMOIRE NOVAAI
// =====================================


const userHistories = {};



function getHistory(userId){


if(!userHistories[userId]){


userHistories[userId]=[];

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

role,
content

});



if(history.length > 40){


history.splice(
0,
history.length-40
);


}


}




function getRecentHistory(userId){


return getHistory(userId)
.slice(-20);


}





// =====================================
// RECHERCHE INTERNET TAVILY
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


Authorization:
`Bearer ${TAVILY_KEY}`

},


body:JSON.stringify({

query,


search_depth:
"advanced",


max_results:
5

})


}

);





const data =
await response.json();




if(!data.results){

return "";

}




return data.results.map(item=>`

Titre:
${item.title}


Résumé:
${item.content}


Source:
${item.url}


`).join("\n");



}

catch(error){


console.log(
"TAVILY ERROR",
error
);


return "";


}


}





// =====================================
// DETECTION INTERNET
// =====================================


function needsInternet(text){


const words=[


"actualité",
"news",
"aujourd'hui",
"prix",
"météo",
"score",
"match",
"résultat",
"président",
"2026",
"2025"


];



const lower =
text.toLowerCase();



return words.some(

w=>
lower.includes(w)

);


}




// =====================================
// FIN PARTIE 1
// =====================================// =====================================
// NOVA AI SERVER V7
// PARTIE 2/3
// =====================================



// =====================================
// CHAT NOVAAI
// =====================================


app.post("/chat", async(req,res)=>{


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




saveMessage(
userId,
"user",
message
);



let webInfo="";



if(needsInternet(message)){


console.log(
"🌍 Recherche internet"
);


webInfo =
await searchInternet(message);


}




const messages=[



{


role:"system",


content:`

Tu es NovaAI 🚀.

Assistant IA français premium.

Réponds toujours en français.

Style:
- professionnel
- clair
- naturel
- moderne

Utilise Markdown propre.

Aide pour:
programmation,
création de projets,
apprentissage,
rédaction,
analyse.

Ne fabrique jamais d'informations.

`

}



];





if(webInfo){


messages.push({

role:"system",

content:

`
Informations internet:

${webInfo}

Utilise uniquement ces données.
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


temperature:
0.5


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
"⚠️ IA indisponible actuellement."

});


}





let reply =
data?.choices?.[0]?.message?.content
||
"Pas de réponse.";



reply =
reply
.replace(/\*\*\*/g,"")
.trim();




saveMessage(

userId,

"assistant",

reply

);



res.json({

reply

});





}

catch(error){


console.log(
"CHAT ERROR",
error
);



res.json({

reply:
"❌ Erreur NovaAI."

});


}


});






// =====================================
// GEMINI VISION
// =====================================



async function askGeminiVision(
image,
mimeType
){


const models=[
"gemini-2.5-flash",
"gemini-2.0-flash-lite"
];



for(const modelName of models){


try{


const model =
genAI.getGenerativeModel({

model:
modelName

});




const result =
await model.generateContent([


{


inlineData:{


data:image,


mimeType

}


},



`
Analyse cette image.

Réponds en français.

Décris:
- objets
- textes visibles
- informations importantes

`

]);




return result.response.text();



}

catch(error){


console.log(

"GEMINI RETRY:",
modelName,

error.status

);


await new Promise(
r=>setTimeout(r,10000)
);


}



}



throw new Error(
"Gemini indisponible"
);


}




app.post("/vision",async(req,res)=>{


try{


if(!genAI){


return res.json({

reply:
"Clé Gemini absente."

});


}



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



const reply =
await askGeminiVision(
image,
mimeType
);



res.json({

reply

});



}

catch(error){


console.log(
"VISION ERROR",
error
);



res.json({

reply:
"Impossible d'analyser cette image actuellement."

});


}


});






// =====================================
// GENERATION IMAGE NOVAAI V7
// =====================================


app.post("/generate-image", async(req,res)=>{


try{


req.setTimeout(120000);



const prompt =
req.body.prompt;



if(!prompt){


return res.json({

error:
"Description manquante."

});


}





console.log(
"🎨 Génération image:",
prompt
);





const imageURL =

"https://image.pollinations.ai/prompt/" +

encodeURIComponent(prompt)

+

"?width=1024&height=1024&nologo=true";







// Vérification que l'image existe


const check =
await fetch(imageURL);



if(!check.ok){


console.log(
"IMAGE API ERROR",
check.status
);


return res.json({

error:
"Le générateur image est indisponible."

});


}







const buffer =
await check.arrayBuffer();




const base64 =
Buffer.from(buffer)
.toString("base64");






res.json({

image:

"data:image/jpeg;base64,"+base64,


message:

"Image créée avec succès 🚀"


});





}

catch(error){



console.log(

"IMAGE ERROR",

error

);



res.json({

error:
"Erreur génération image."

});



}



});



// =====================================
// FIN PARTIE 2
// =====================================// =====================================
// NOVA AI SERVER V7
// PARTIE 3/3
// =====================================



// =====================================
// ANALYSE DOCUMENTS
// =====================================


app.post(
"/upload",
upload.single("file"),
async(req,res)=>{


try{


if(!req.file){


return res.json({

reply:
"Aucun fichier reçu."

});


}




let text="";


const file =
req.file;



const type =
file.mimetype;




// TXT

if(
type==="text/plain"
){


text =
file.buffer.toString(
"utf-8"
);


}




// PDF

else if(
type==="application/pdf"
){


const data =
await pdfParse(
file.buffer
);


text =
data.text;


}





// DOCX

else if(
type.includes(
"wordprocessingml"
)){


const result =
await mammoth.extractRawText({

buffer:
file.buffer

});


text =
result.value;


}





else{


return res.json({

reply:
"Format non supporté. Utilise TXT, PDF ou DOCX."

});


}







if(!text.trim()){


return res.json({

reply:
"Le fichier est vide."

});


}






// Protection taille

text =
text.substring(
0,
15000
);







if(!GROQ_KEY){


return res.json({

reply:
"Clé Groq absente."

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


messages:[


{


role:"system",

content:

`

Tu es NovaAI.

Analyse les documents.

Fais des résumés propres.

Utilise Markdown.

Explique simplement.

`

},



{


role:"user",

content:

`

Analyse ce document :

${text}


Donne:

- résumé
- points importants
- informations utiles

`

}


],


temperature:
0.4


})


}

);





const data =
await response.json();





const reply =
data?.choices?.[0]?.message?.content
||
"Impossible d'analyser le fichier.";






res.json({

reply

});





}

catch(error){


console.log(

"UPLOAD ERROR",

error

);



res.json({

reply:
"Erreur analyse fichier."

});


}



});








// =====================================
// TESTS
// =====================================



app.get("/test",(req,res)=>{


res.json({

status:
"NovaAI V7 fonctionne 🚀"

});


});







app.get("/health",(req,res)=>{


res.status(200).json({

status:
"online",


version:
"V7",


time:
new Date()

});


});








// =====================================
// FAVICON
// =====================================


app.get("/favicon.ico",(req,res)=>{


res.status(204).end();


});








// =====================================
// ERREURS GENERALES
// =====================================



app.use((err,req,res,next)=>{


console.log(
"SERVER ERROR",
err
);



res.status(500).json({

error:
"Erreur serveur NovaAI."

});


});








// =====================================
// START SERVER RENDER
// =====================================



app.listen(
PORT,
()=>{


console.log(

`🚀 NovaAI V7 lancé sur le port ${PORT}`

);


}
);
