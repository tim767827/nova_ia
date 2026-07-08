// ===============================
// NOVA AI SERVER
// PARTIE 1/2
// ===============================


const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();


// IA
const { GoogleGenerativeAI } = require("@google/generative-ai");


// Recherche Internet
const { search } = require("tavily-search");


// ===============================
// CONFIGURATION IA
// ===============================


const app = express();


const PORT = process.env.PORT || 3000;


// Clés API

const GROQ_KEY = process.env.API_KEY;

const GEMINI_KEY = process.env.GEMINI_KEY;

const HF_KEY = process.env.HF_API_KEY;

const TAVILY_KEY = process.env.TAVILY_KEY;



// Gemini

const genAI = new GoogleGenerativeAI(
    GEMINI_KEY
);



// ===============================
// MIDDLEWARE
// ===============================


app.use(cors());


app.use(express.json({
    limit:"30mb"
}));



// ===============================
// FRONTEND
// ===============================


app.use(express.static(
    path.join(__dirname,"..","public")
));



app.get("/",(req,res)=>{

    res.sendFile(
        path.join(__dirname,"..","public","index.html")
    );

});



// ===============================
// MEMOIRE DES DISCUSSIONS
// ===============================


const userHistories = {};




// ===============================
// DETECTION RECHERCHE INTERNET
// ===============================


function needsInternet(text){


    return /


    qui|
    quel|
    quelle|
    combien|
    résultat|
    score|
    match|
    actualité|
    news|
    aujourd'hui|
    hier|
    demain|
    président|
    ministre|
    prix|
    météo|
    cours|
    crypto|
    bourse|
    dernier|
    dernière|
    2025|
    2026|
    récent|
    récente|
    maintenant


    /ix.test(text);


}





// ===============================
// RECHERCHE INTERNET TAVILY
// ===============================


async function searchInternet(query){


    try{


        console.log(
            "🔎 Recherche Internet :",
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
            "🌍 TAVILY OK"
        );



        if(!data.results || data.results.length===0){


            return "Aucune information trouvée.";


        }



        return data.results.map(r=>{


            return `

SOURCE :
${r.title}

LIEN :
${r.url}

INFORMATION :
${r.content}

---------------------

`;

        }).join("");



    }

    catch(error){


        console.log(
            "TAVILY ERROR =>",
            error
        );


        return "Impossible de rechercher sur Internet.";

    }


}

// ===============================
// CHAT GROQ
// ===============================


app.post("/chat", async(req,res)=>{


try{


const message = req.body.message;


const userId = req.body.userId || "default";



if(!message){


return res.json({

reply:"Écris un message 🙂"

});


}




let internet = "";



// Recherche seulement si nécessaire

if(needsInternet(message)){


console.log(
"🌍 RECHERCHE ACTIVE"
);



internet = await searchInternet(
message
);


console.log(
"📚 INFORMATIONS WEB AJOUTÉES"
);


}




// Création mémoire utilisateur


if(!userHistories[userId]){


userHistories[userId]=[];


}



const history = userHistories[userId];



history.push({

role:"user",

content:message

});




// Limite mémoire

if(history.length > 20){

history.shift();

}




// Appel GROQ


const response = await fetch(

"https://api.groq.com/openai/v1/chat/completions",

{


method:"POST",


headers:{


"Content-Type":"application/json",


Authorization:`Bearer ${GROQ_KEY}`


},


body:JSON.stringify({


model:"llama-3.1-8b-instant",



messages:[



{

role:"system",

content:`

Tu es NovaAI.

Tu es une intelligence artificielle française.

RÈGLES :

- Réponds toujours en français.
- Utilise les informations Internet fournies quand elles existent.
- Ne dis jamais que tu n'as pas accès à Internet.
- Ne refuse jamais de répondre à cause de ta connaissance limitée.
- Pour les informations récentes, utilise les données Internet.
- Pour les matchs, donne le score, les buteurs et les minutes si disponibles.
- Si les informations Internet ne donnent pas la réponse, explique-le clairement.

Sois naturel et précis.

`

},



{

role:"system",

content:`

Informations Internet actuelles :

${internet}

`

},



...history



]


})

}

);





const data = await response.json();




console.log(
"🤖 GROQ OK"
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

reply:"Erreur serveur IA."

});


}



});









// ===============================
// ANALYSE IMAGE GEMINI
// ===============================



app.post("/vision",async(req,res)=>{


try{


let image=req.body.image;



if(!image){


return res.json({

reply:"Aucune image reçue."

});


}




image=image.replace(
/^data:image\/\w+;base64,/,
""
);





const model = genAI.getGenerativeModel({

model:"gemini-2.5-flash"

});





const result = await model.generateContent([


{

inlineData:{


data:image,


mimeType:"image/jpeg"


}

},



`

Analyse cette image.

Décris ce que tu vois.

Lis les textes.

Explique les objets.

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

reply:"Erreur analyse image."

});


}


});









// ===============================
// GENERATION IMAGE HUGGING FACE
// ===============================



app.post("/generate-image",async(req,res)=>{


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


Authorization:`Bearer ${HF_KEY}`,

"Content-Type":"application/json"


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

error:error

});


}





const buffer =
await response.arrayBuffer();




const base64 =
Buffer.from(buffer).toString("base64");





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









// ===============================
// LANCEMENT SERVEUR
// ===============================



app.listen(PORT,()=>{


console.log(
"🚀 NovaAI serveur lancé sur le port",
PORT
);


});
