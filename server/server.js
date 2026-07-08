const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();


const { GoogleGenerativeAI } = require("@google/generative-ai");



const app = express();



// ============================
// CONFIG API
// ============================

const GROQ_KEY = process.env.API_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const HF_KEY = process.env.HF_API_KEY;
const TAVILY_KEY = process.env.TAVILY_KEY;



const genAI = new GoogleGenerativeAI(
    GEMINI_KEY
);



// ============================
// MIDDLEWARE
// ============================

app.use(cors());


app.use(express.json({
    limit:"30mb"
}));



// ============================
// FRONTEND
// ============================

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




// ============================
// MEMOIRE
// ============================

const userHistories = {};




// ============================
// AMELIORATION RECHERCHE IA
// ============================

async function improveSearch(query){


try{


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
Tu es un moteur de recherche.

Transforme la demande utilisateur
en une recherche Internet précise.

Retourne uniquement la phrase
à rechercher.

Pas d'explication.
`

},


{

role:"user",

content:query

}


]

})

}

);



const data = await response.json();



return data
?.choices?.[0]
?.message
?.content || query;



}

catch(error){


console.log(
"SEARCH IA ERROR",
error
);


return query;


}


}






// ============================
// RECHERCHE TAVILY
// ============================


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

max_results:5

})


}

);



const data = await response.json();



console.log(
"TAVILY OK"
);



if(!data.results){

return "Aucun résultat trouvé.";

}




return data.results.map(result=>`


Titre:
${result.title}


Information:
${result.content}


Source:
${result.url}



`).join("\n");



}


catch(error){


console.log(
"TAVILY ERROR =>",
error
);


return "Recherche Internet impossible.";


}



}






// ============================
// DETECTION RECHERCHE
// ============================


function needsInternet(text){


return /actualité|news|internet|dernier|dernière|aujourd'hui|hier|demain|récent|prix|coût|météo|temps|score|résultat|classement|2025|2026|qui est|quand|où|nouveau|nouvelle/i
.test(text);


}
 
// ============================
// CHAT GROQ
// ============================


app.post("/chat", async(req,res)=>{


try{


const message = req.body.message;

const userId =
req.body.userId || "default";



if(!message){

return res.json({

reply:"Écris un message 🙂"

});

}




let internet = "";



// Recherche automatique

if(needsInternet(message)){


console.log(
"🌍 RECHERCHE ACTIVE"
);



const searchQuery =
await improveSearch(message);



console.log(
"🔎 Recherche optimisée :",
searchQuery
);



internet =
await searchInternet(searchQuery);



}





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

Tu peux utiliser des recherches Internet.

Si des informations Internet sont fournies,
utilise-les.

Ne dis jamais que tu as cherché.

Pour les informations récentes,
base-toi sur les données fournies.

Sois précis et naturel.

Informations Internet :

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
"Je n'ai pas réussi à répondre.";



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

reply:
"Erreur serveur NovaAI."

});

}


});






// ============================
// ANALYSE IMAGE GEMINI
// ============================


app.post("/vision",async(req,res)=>{


try{


let image =
req.body.image;



if(!image){

return res.json({

reply:"Aucune image reçue."

});

}




image =
image.replace(
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

Décris ce que tu vois.

Lis les textes présents.

Explique les objets.

Réponds aux questions.

Réponds en français.
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

reply:
"Erreur analyse image."

});


}



});







// ============================
// GENERATION IMAGE HUGGINGFACE
// ============================


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


const err =
await response.text();


console.log(
"HF ERROR",
err
);



return res.json({

error:err

});


}




const buffer =
await response.arrayBuffer();



const base64 =
Buffer
.from(buffer)
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

error:
"Erreur génération image."

});


}


});







// ============================
// START
// ============================


const PORT =
process.env.PORT || 3000;



app.listen(PORT,()=>{


console.log(
"✅ NovaAI serveur lancé sur le port "
+PORT
);


});
