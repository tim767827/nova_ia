// =====================================
// NOVA AI SERVER V8
// PARTIE 1/3
// RENDER READY
// =====================================


// =====================================
// IMPORTS
// =====================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const cheerio = require("cheerio");
const Tesseract = require("tesseract.js");

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


const TAVILY_KEY =
process.env.TAVILY_KEY;



console.log("🚀 NovaAI V8 démarrage");


console.log(
"GROQ:",
GROQ_KEY ? "OK" : "ABSENTE"
);


console.log(
"GEMINI:",
GEMINI_KEY ? "OK" : "ABSENTE"
);


console.log(
"TAVILY:",
TAVILY_KEY ? "OK" : "ABSENTE"
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


app.use(
express.json({
    limit:"50mb"
})
);



const limiter =
rateLimit({

    windowMs:
    60 * 1000,

    max:
    80,

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
// UPLOAD DOCUMENTS
// =====================================


const upload = multer({
    storage: multer.memoryStorage(),
    limits:{
        fileSize:50 * 1024 * 1024
    }
});



// =====================================
// MEMOIRE
// =====================================


const userHistories = {};



function getHistory(id){

if(!userHistories[id]){

userHistories[id]=[];

}

return userHistories[id];

}



function saveMessage(
id,
role,
content
){

const history =
getHistory(id);


history.push({

role,
content

});


if(history.length > 50){

history.shift();

}


}





function getRecentHistory(id){

return getHistory(id)
.slice(-13);

}




// =====================================
// RECHERCHE WEB TAVILY
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



return data.results.map(x=>`

Titre:
${x.title}

Résumé:
${x.content}

Lien:
${x.url}

`).join("\n\n");



}

catch(e){

console.log(
"TAVILY ERROR",
e
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
"prix",
"météo",
"score",
"match",
"2025",
"2026"

];


return words.some(

x =>
text
.toLowerCase()
.includes(x)

);


}



// =====================================
// EXTRACTION DOCUMENTS
// =====================================


async function extractText(file){


const type =
file.mimetype;


const name =
file.originalname.toLowerCase();



// TXT

if(
type==="text/plain"
||
name.endsWith(".txt")
){

return file.buffer.toString("utf8");

}



// PDF

if(
type==="application/pdf"
||
name.endsWith(".pdf")
){

const data =
await pdfParse(
file.buffer
);

return data.text;

}




// WORD

if(
name.endsWith(".docx")
){

const result =
await mammoth.extractRawText({

buffer:
file.buffer

});


return result.value;

}





// EXCEL

if(
name.endsWith(".xlsx")
||
name.endsWith(".xls")
){

const workbook =
XLSX.read(
file.buffer,
{
type:"buffer"
}
);


let text="";


workbook.SheetNames.forEach(sheet=>{

text +=
XLSX.utils
.sheet_to_csv(
workbook.Sheets[sheet]
);

});


return text;

}





// CSV

if(
name.endsWith(".csv")
){

return file.buffer.toString("utf8");

}





// JSON

if(
name.endsWith(".json")
){

return file.buffer.toString("utf8");

}




// HTML

if(
name.endsWith(".html")
||
name.endsWith(".htm")
){

const $ =
cheerio.load(
file.buffer.toString()
);


return $.text();

}




return "";

}





// =====================================
// FIN PARTIE 1/3
// =====================================// =====================================
// NOVA AI SERVER V8
// PARTIE 2/3
// CHAT + VISION + IMAGE
// =====================================



// =====================================
// CHAT NOVAAI GROQ
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


webInfo =
await searchInternet(message);


}




const messages=[


{

role:"system",

content:`

Tu es NovaAI V8 🚀, un assistant IA premium.

Tu réponds comme un assistant professionnel moderne.

RÈGLES DE RÉDACTION :

- Réponds toujours en français sauf si l'utilisateur demande une autre langue.
- Écris avec une orthographe et une grammaire parfaites.
- Fais des réponses agréables à lire.
- Ne fais jamais de gros blocs de texte.
- Utilise des titres quand c'est utile.
- Utilise des listes à puces pour organiser les informations.
- Mets les éléments importants en **gras**.
- Utilise Markdown proprement.
- Ajoute des exemples quand cela aide.
- Explique simplement les choses complexes.
- Adapte la longueur à la demande.
- Ne répète pas inutilement la question.

STYLE :

- naturel
- intelligent
- chaleureux
- professionnel
- précis

FORMAT :

Pour expliquer une idée :
1. Résumé rapide
2. Explication
3. Exemple

Pour un tutoriel :
1. Étapes numérotées
2. Conseils
3. Résultat attendu

Pour du code :
- explique brièvement
- utilise toujours des blocs de code Markdown

Ne dis jamais que tu es limité.
Ne fabrique jamais d'informations.
Si tu ne sais pas, dis-le clairement.

Tu es NovaAI, pas un simple chatbot.
`

}


];





if(webInfo){


messages.push({

role:"system",

content:

`
Informations trouvées sur internet:

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
"⚠️ GROQ_KEY absente."

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
0.7
max_tokens:
4096
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
"Erreur IA Groq."

});


}





const reply =
data?.choices?.[0]?.message?.content
||
"Pas de réponse.";





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
"Erreur NovaAI."

});


}


});







// =====================================
// GEMINI VISION
// =====================================


async function analyzeImage(
image,
mimeType
){



if(!genAI){

throw new Error(
"Gemini absent"
);

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

mimeType

}

},



`

Analyse cette image.

Réponds en français.

Donne:

- objets visibles
- texte présent
- informations importantes
- explication simple

`

]);





return result.response.text();



}





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
"Aucune image."

});

}





const reply =
await analyzeImage(
image,
mimeType
);





res.json({

reply

});



}

catch(e){


console.log(
"VISION ERROR",
e
);



res.json({

reply:
"Impossible d'analyser l'image."

});


}


});







// =====================================
// GENERATION IMAGE FLUX
// =====================================



app.post("/generate-image",async(req,res)=>{


try{


const prompt =
req.body.prompt;



if(!prompt){


return res.json({

error:
"Prompt manquant."

});


}



let finalPrompt =
prompt;



// amélioration avec Groq


if(GROQ_KEY){



try{


const improve =
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
Améliore ce prompt pour une image IA.
Ajoute:
- détails
- lumière
- caméra
- style cinéma
- qualité.

Réponds uniquement avec le prompt.
`

},


{

role:"user",

content:prompt

}


]

})


}

);



const data =
await improve.json();



finalPrompt =
data?.choices?.[0]?.message?.content
||
prompt;



}

catch(e){


console.log(
"PROMPT ERROR"
);


}


}




const imageURL =

"https://image.pollinations.ai/prompt/"

+

encodeURIComponent(finalPrompt)

+

"?model=flux&width=1024&height=1024&nologo=true";





res.json({

image:imageURL,

prompt:finalPrompt

});



}

catch(e){


res.json({

error:
"Erreur image."

});


}


});





// =====================================
// FIN PARTIE 2/3
// =====================================// =====================================
// NOVA AI SERVER V8
// PARTIE 3/3
// DOCUMENTS + START SERVER
// =====================================



app.post(
"/upload",
upload.single("file"),
async(req,res)=>{

try{


if(!req.file){

return res.json({
reply:"Aucun fichier reçu."
});

}



let text="";

const file=req.file;

const name=file.originalname.toLowerCase();



// PDF

if(name.endsWith(".pdf")){

const data =
await pdfParse(file.buffer);

text=data.text;

}



// TXT

else if(name.endsWith(".txt")){

text =
file.buffer.toString("utf8");

}



// DOCX

else if(name.endsWith(".docx")){


const result =
await mammoth.extractRawText({

buffer:file.buffer

});


text=result.value;


}



// Excel

else if(
name.endsWith(".xlsx")
||
name.endsWith(".xls")
){


const workbook =
XLSX.read(
file.buffer,
{
type:"buffer"
}
);


workbook.SheetNames.forEach(sheet=>{


text +=

XLSX.utils.sheet_to_csv(
workbook.Sheets[sheet]
);


});


}



// CSV

else if(name.endsWith(".csv")){


text =
file.buffer.toString("utf8");


}




else{


return res.json({

reply:
"Format non supporté. Utilise PDF TXT DOCX XLSX CSV."

});


}





if(!text.trim()){


return res.json({

reply:
"Le fichier est vide."

});


}




text=text.substring(0,30000);





const response =
await fetch(

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


messages:[

{

role:"system",

content:

Tu es NovaAI, expert en analyse documentaire.

Analyse le document fourni.

Réponds avec cette structure :

# Résumé

Résumé clair et court.

# Points importants

Liste des informations essentielles.

# Analyse

Explique les éléments importants.

# Conclusion

Donne une synthèse finale.

Utilise un français professionnel et facile à comprendre.
},


{

role:"user",

content:

`
Voici le document :

${text}

`

}

],

temperature:0.3


})

}

);





const data =
await response.json();





res.json({

reply:

data?.choices?.[0]?.message?.content
||
"Erreur analyse."


});




}
catch(error){


console.log(
"UPLOAD ERROR",
error
);


res.json({

reply:
"Erreur pendant l'analyse du fichier."

});


}


});






// =====================================
// OCR IMAGE DOCUMENT
// =====================================


app.post(
"/ocr",
upload.single("file"),
async(req,res)=>{


try{


if(!req.file){


return res.json({

reply:
"Aucune image."

});


}




const result =
await Tesseract.recognize(

req.file.buffer,

"fra"

);



const text =
result.data.text;



if(!text){


return res.json({

reply:
"Aucun texte trouvé."

});


}





if(!GROQ_KEY){


return res.json({

reply:
"OCR OK mais IA absente."

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
Analyse ce texte OCR.
Résume et explique.
`

},


{

role:"user",

content:text

}


]

})


}

);





const data =
await response.json();



res.json({

reply:

data?.choices?.[0]?.message?.content
||
text

});



}

catch(e){


console.log(
"OCR ERROR",
e
);


res.json({

reply:
"Erreur OCR."

});


}


});








// =====================================
// TESTS
// =====================================


app.get("/test",(req,res)=>{


res.json({

status:
"NovaAI V8 fonctionne 🚀"

});


});






app.get("/health",(req,res)=>{


res.status(200).json({

status:
"online",


version:
"V8",


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
// ERREUR GENERALE
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
// START RENDER
// =====================================


app.listen(

PORT,

()=>{


console.log(

`🚀 NovaAI V8 lancé sur port ${PORT}`

);


}

);
