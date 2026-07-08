const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");



const app = express();



// =========================
// GEMINI
// =========================


const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_KEY
);



// =========================
// MIDDLEWARE
// =========================


app.use(cors());


app.use(express.json({

    limit:"20mb"

}));



// =========================
// FRONTEND
// =========================


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




// =========================
// API KEYS
// =========================


const GROQ_KEY =
process.env.API_KEY;





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

api_key:
process.env.TAVILY_API_KEY,

query:query,

search_depth:"basic",

max_results:5

})


}

);




const data =
await response.json();




console.log(
"TAVILY RESULT :",
data
);




if(!data.results || data.results.length===0){


return "Aucun résultat trouvé.";


}




return data.results

.map(result=>{


return `

Titre :
${result.title}


Résumé :
${result.content}


Source :
${result.url}

`;


})

.join("\n");



}

catch(error){


console.log(

"SEARCH ERROR =>",

error

);


return "Recherche impossible.";


}


}





// =========================
// MEMOIRE CHAT
// =========================


const userHistories = {};




// =========================
// CHAT GROQ
// =========================


app.post("/chat",async(req,res)=>{


try{


const userMessage =
req.body.message;



console.log(
"MESSAGE REÇU :",
userMessage
);




if(!userMessage){


return res.json({

reply:"Écris un message 🙂"

});


}




const userId =
req.body.userId || "user1";



if(!userHistories[userId]){


userHistories[userId]=[];


}



const history =
userHistories[userId];




let internetResults="";




// Détection recherche


const needSearch =

/actualité|actu|news|internet|cherche|recherche|web|match|score|résultat|résultats|hier|aujourd'hui|prix|météo|dernier|dernière|2025|2026/i

.test(userMessage);





if(needSearch){


console.log(
"🌍 RECHERCHE ACTIVE"
);



internetResults =
await searchInternet(
userMessage
);



}

// =========================
// HISTORIQUE UTILISATEUR
// =========================


history.push({

role:"user",

content:userMessage

});



if(history.length > 12){

history.shift();

}





// =========================
// MESSAGES POUR GROQ
// =========================


const messages = [



{

role:"system",

content:

`
Tu es NovaAI.

Tu réponds toujours en français.

Tu es un assistant IA intelligent.

Si des informations Internet sont fournies,
utilise-les en priorité.

Ne dis jamais que tu as cherché sur Internet.

Réponds naturellement.
`

}


];





if(internetResults){


messages.push({

role:"user",

content:

`
Informations trouvées sur Internet :

${internetResults}


Utilise ces informations pour répondre
à la question de l'utilisateur.
`

});


}





messages.push(...history);






// =========================
// GROQ
// =========================


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

messages:messages

})


}

);





const data =
await response.json();



console.log(
"GROQ :",
data
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

"CHAT ERROR :",

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

Réponds en français.

Décris les objets,
les personnes,
les textes visibles,
et réponds aux questions.
`

]);





res.json({

reply:
result.response.text()

});




}


catch(error){


console.log(

"GEMINI ERROR :",

error

);



res.json({

reply:"Erreur analyse image."

});


}


});








// =========================
// CREATION IMAGE HUGGING FACE
// =========================


app.post("/generate-image",async(req,res)=>{


try{


const prompt =
req.body.prompt;



if(!prompt){


return res.json({

error:"Description manquante."

});


}





const response =
await fetch(

"https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",

{


method:"POST",


headers:{


Authorization:

`Bearer ${process.env.HF_API_KEY}`,


"Content-Type":

"application/json"


},


body:JSON.stringify({

inputs:prompt

})


}


);





console.log(

"HF STATUS :",

response.status

);





if(!response.ok){


const error =
await response.text();


console.log(
"HF ERROR :",
error
);



return res.json({

error:error

});


}





const buffer =
await response.arrayBuffer();





const image =
Buffer.from(buffer)
.toString("base64");





res.json({

image:

"data:image/png;base64,"+image

});



}



catch(error){


console.log(

"IMAGE ERROR :",

error

);



res.json({

error:"Erreur création image."

});


}



});








// =========================
// START
// =========================


const PORT =
process.env.PORT || 3000;



app.listen(PORT,()=>{


console.log(

`✅ NovaAI lancé sur le port ${PORT}`

);


});
