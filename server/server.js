// =========================
// IMPORTS
// =========================

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const fetch = require("node-fetch");

const { GoogleGenerativeAI } = require("@google/generative-ai");


// =========================
// CONFIG
// =========================

const app = express();

const PORT = process.env.PORT || 3000;


const GROQ_KEY = process.env.API_KEY;

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
        path.join(__dirname,"..","public","index.html")
    );

});



// =========================
// RECHERCHE TAVILY
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
                    process.env.TAVILY_KEY,


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



        if(!data.results ||
           data.results.length === 0){


            return "Aucun résultat trouvé.";


        }




        return data.results

        .map(result=>{


            return `

Titre :
${result.title}


Informations :
${result.content}


Source :
${result.url}


`;

        })


        .join("\n");



    }


    catch(error){


        console.log(

            "TAVILY ERROR =>",

            error.message

        );


        return "Aucune recherche disponible.";

    }


}





// =========================
// MEMOIRE CHAT
// =========================


const userHistories = {};





// =========================
// CHAT GROQ
// =========================


app.post("/chat", async(req,res)=>{


try{


const message = req.body.message;


const userId =
req.body.userId || "user1";



if(!message){


return res.json({

reply:"Écris un message."

});


}



// Création mémoire

if(!userHistories[userId]){


    userHistories[userId] = [];


}



const history =
userHistories[userId];




// =========================
// DETECTION RECHERCHE
// =========================


let webInfo = "";



const needSearch =

/actualité|actu|aujourd'hui|hier|dernier|dernière|président|gouvernement|match|score|résultat|prix|météo|température|2024|2025|2026|nouveau|nouvelle|information|news|qui est/i

.test(message);





if(needSearch){


console.log(
"🌍 RECHERCHE ACTIVE"
);



webInfo = await searchInternet(message);



}




history.push({

role:"user",

content:message

});





if(history.length > 12){

history.shift();

}





const systemPrompt = `

Tu es NovaAI.

Tu réponds toujours en français.

Tu es une intelligence artificielle utile.

Si des informations internet sont fournies,
elles sont prioritaires sur ta mémoire.

Ne dis jamais :
"je n'ai pas accès à internet"
ou
"je ne peux pas savoir"

Si une information manque, explique-le simplement.

Réponds naturellement.

`;





const messages = [

{
role:"system",
content:`

Tu es NovaAI.

Tu dois répondre en français.

IMPORTANT :

Les informations INTERNET fournies ci-dessous sont prioritaires.

Tu dois utiliser ces informations pour répondre.

Ne dis jamais :
"je n'ai pas accès à internet"
"je n'ai pas de données"
"je ne peux pas savoir"

Si une information internet existe, utilise-la directement.

Réponds simplement et clairement.

`
},


];



// INTERNET AVANT HISTORIQUE

if(webInfo){

messages.push({

role:"system",

content:

`
RESULTATS INTERNET :

${webInfo}

Ces résultats sont fiables.
Utilise-les pour répondre à la question.
`

});

}



// ensuite seulement la conversation

messages.push(...history);


messages.push({

role:"system",

content:

`

Informations trouvées sur internet :

${webInfo}


Utilise ces informations pour répondre précisément.

`

});


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


messages:messages,


temperature:0.3


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

"Erreur réponse IA.";





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


let image = req.body.image;



if(!image){


return res.json({

reply:"Aucune image reçue."

});


}



// Nettoyage base64

image = image.replace(
(/^data:image\/\w+;base64,/),
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

Analyse cette image en français.

Décris ce que tu vois.

Lis les textes présents.

Explique les objets, lieux, personnes ou éléments importants.

Si l'utilisateur pose une question sur l'image,
réponds précisément.

`

]);





const text =
result.response.text();





res.json({

reply:text

});





}



catch(error){


console.log(

"GEMINI ERROR =>",

error.message

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


const prompt =
req.body.prompt;




if(!prompt){


return res.json({

error:"Description image manquante."

});


}





console.log(

"🎨 IMAGE :",

prompt

);





const response = await fetch(


"https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",


{


method:"POST",


headers:{


Authorization:

`Bearer ${process.env.HF_API_KEY}`,


"Content-Type":"application/json"


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



const errorText =
await response.text();



console.log(

"HF ERROR =>",

errorText

);



return res.json({

error:errorText

});


}






const buffer =
await response.arrayBuffer();





const imageBase64 =

Buffer.from(buffer)

.toString("base64");






res.json({


image:

"data:image/png;base64,"

+ imageBase64



});





}



catch(error){



console.log(

"IMAGE ERROR =>",

error.message

);




res.json({

error:"Erreur génération image."

});


}



});









// =========================
// START SERVER
// =========================



app.listen(PORT,()=>{


console.log(

`✅ NovaAI serveur lancé sur ${PORT}`

);


});
