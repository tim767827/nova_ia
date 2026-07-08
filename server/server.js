const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();


// =========================
// CONFIGURATION
// =========================

const PORT = process.env.PORT || 3000;

const GROQ_KEY = process.env.API_KEY;
const TAVILY_KEY = process.env.TAVILY_KEY;
const HF_KEY = process.env.HF_API_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;


// =========================
// GEMINI
// =========================

const genAI = new GoogleGenerativeAI(
    GEMINI_KEY
);


// =========================
// MIDDLEWARE
// =========================

app.use(cors());

app.use(express.json({
    limit:"25mb"
}));


// =========================
// FRONTEND
// =========================

app.use(express.static(
    path.join(__dirname,"..","public")
));


app.get("/",(req,res)=>{

    res.sendFile(
        path.join(__dirname,"..","public","index.html")
    );

});



// =========================
// MEMOIRE CHAT
// =========================

const userHistories = {};



// =========================
// RECHERCHE INTERNET TAVILY
// =========================


async function searchInternet(query){


try{


console.log(
"🔎 Recherche Tavily :",
query
);



const response = await fetch(

"https://api.tavily.com/search",

{

method:"POST",

headers:{

"Content-Type":"application/json"

},


body:JSON.stringify({

api_key:TAVILY_KEY,

query:query,

search_depth:"advanced",

max_results:6

})


}

);



const data = await response.json();



console.log(
"TAVILY OK"
);



if(!data.results || data.results.length===0){

return "Aucune information trouvée.";

}



return data.results.map(result=>{


return `

SOURCE:

Titre:
${result.title}


Contenu:
${result.content}


Lien:
${result.url}

------------------

`;

}).join("\n");



}

catch(error){


console.log(
"TAVILY ERROR =>",
error
);


return "Impossible de faire la recherche Internet.";

}


}



// =========================
// DETECTION RECHERCHE
// =========================


function needInternet(text){


return (

/actualité|news|internet|aujourd|hier|demain|récent|derni|date|prix|coût|météo|temps|score|match|sport|football|film|série|sortie|politique|président|guerre|technologie|ia|intelligence|bitcoin|crypto|bourse|2025|2026/i

.test(text)

);


}
// =========================
// CHAT GROQ
// =========================


app.post("/chat", async(req,res)=>{


try{


let message = req.body.message;


if(!message){

return res.json({

reply:"Écris un message 🙂"

});

}



// Nettoyage recherche

let searchQuery = message
.replace(/stp|svp|s'il te plaît|peux tu|peux-tu/gi,"")
.trim();



let internet = "";



if(needInternet(message)){


console.log(
"🌍 RECHERCHE ACTIVE"
);


internet = await searchInternet(
searchQuery
);


}



const userId =
req.body.userId || "user1";



if(!userHistories[userId]){

userHistories[userId]=[];

}



const history =
userHistories[userId];



history.push({

role:"user",

content:message

});



if(history.length > 12){

history.shift();

}




const response = await fetch(

"https://api.groq.com/openai/v1/chat/completions",

{

method:"POST",

headers:{


"Content-Type":"application/json",

Authorization:
`Bearer ${GROQ_KEY}`


},


body:JSON.stringify({


model:"llama-3.1-8b-instant",


messages:[


{


role:"system",

content:

`

Tu es NovaAI.

Tu réponds toujours en français.

Tu es un assistant intelligent connecté à Internet.

Utilise les informations Internet quand elles sont fournies.

Ne dis jamais que tu n'as pas Internet.

Ne fabrique jamais de fausses informations.

Si les sources ne permettent pas de répondre,
dis simplement que les informations disponibles
ne suffisent pas.

Réponds clairement et naturellement.

INFORMATIONS INTERNET :

${internet}

`

},


...history


]


})


}


);



const data =
await response.json();



console.log(
"GROQ OK"
);



const reply =
data?.choices?.[0]?.message?.content
||
"Je n'ai pas trouvé de réponse.";




history.push({

role:"assistant",

content:reply

});



res.json({

reply:reply

});



}


catch(error){


console.log(
"CHAT ERROR =>",
error
);


res.json({

reply:"Erreur serveur."

});


}



});






// =========================
// ANALYSE IMAGE GEMINI
// =========================


app.post("/vision", async(req,res)=>{


try{


let image=req.body.image;



if(!image){

return res.json({

reply:"Aucune image."

});

}



image=image.replace(
"data:image/jpeg;base64,",
""
);



const model =
genAI.getGenerativeModel({

model:"gemini-2.5-flash"

});



const result =
await model.generateContent([


{

inlineData:{

data:image,

mimeType:"image/jpeg"

}

},


`

Analyse cette image.

Réponds en français.

Décris les objets,
les personnes,
les textes visibles,
les détails importants.

`

]);



res.json({

reply:
result.response.text()

});



}


catch(error){


console.log(
"GEMINI ERROR =>",
error
);


res.json({

reply:"Erreur analyse image."

});


}



});







// =========================
// GENERATION IMAGE HUGGINGFACE
// =========================


app.post("/generate-image", async(req,res)=>{


try{


const prompt=req.body.prompt;



if(!prompt){

return res.json({

error:"Description manquante."

});

}



const response = await fetch(

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
"HF ERROR =>",
error
);


return res.json({

error:error

});


}



const buffer =
await response.arrayBuffer();



const base64 =
Buffer.from(buffer)
.toString("base64");



res.json({

image:
"data:image/png;base64,"+base64

});



}


catch(error){


console.log(
"IMAGE ERROR =>",
error
);



res.json({

error:"Erreur génération image."

});


}


});







// =========================
// START
// =========================


app.listen(PORT,()=>{


console.log(
"✅ NovaAI serveur lancé sur le port "+PORT
);


});
