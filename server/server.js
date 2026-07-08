const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { search } = require("duck-duck-scrape");


const app = express();



// =========================
// GEMINI
// =========================

const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_KEY
);



// =========================
// OUTILS RECHERCHE INTERNET
// =========================


function sleep(ms){

    return new Promise(resolve => 
        setTimeout(resolve, ms)
    );

}


let lastSearchTime = 0;



async function searchInternet(query){


    try{


        const now = Date.now();



        // Anti spam recherche

        if(now - lastSearchTime < 5000){

            console.log(
                "⏳ Recherche trop rapide"
            );

            await sleep(5000);

        }


        lastSearchTime = Date.now();



        console.log(
            "🔎 Recherche DuckDuckGo :",
            query
        );



        // Pause avant requête

        await sleep(3000);



        const results = await search(query);



        if(!results.results || results.results.length === 0){


            return "Aucun résultat trouvé.";


        }




        const text = results.results
        .slice(0,5)
        .map(result => {


            return `

Titre :
${result.title}


Résumé :
${result.description}


Source :
${result.url}

`;

        })
        .join("\n");



        console.log(
            "✅ Résultats trouvés"
        );



        return text;



    }

    catch(error){


        console.log(
            "SEARCH ERROR =>",
            error
        );


        return "Impossible de faire la recherche Internet.";


    }


}





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
// CLE GROQ
// =========================


const API_KEY =
process.env.API_KEY;




// =========================
// MEMOIRE CHAT
// =========================


const userHistories = {};




// =========================
// CHAT GROQ
// =========================


app.post("/chat", async(req,res)=>{


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
req.body.userId || "default";




let internetResults = "";



// Détection recherche


const needSearch =

/actualité|actu|news|internet|web|cherche|recherche|hier|aujourd'hui|météo|temps|score|match|résultat|résultats|qui a gagné|prix|crypto|bourse|dernier|dernière|2025|2026/i

.test(userMessage);



if(needSearch){


console.log(
"🌍 RECHERCHE ACTIVE"
);



internetResults =
await searchInternet(
    userMessage
);



console.log(
"RESULTATS WEB :",
internetResults
);


}




if(!userHistories[userId]){


userHistories[userId]=[];


}



const history =
userHistories[userId];



history.push({

role:"user",

content:userMessage

});



if(history.length > 12){

history.shift();

}
// =========================
// PREPARATION MESSAGES GROQ
// =========================


const messages = [


{

role:"system",

content:
`
Tu es NovaAI.

Tu réponds toujours en français.

Tu es un assistant intelligent.

Si des informations Internet sont fournies,
elles sont prioritaires.

Utilise-les pour répondre précisément.

Ne dis pas que tu as cherché sur Internet.
`

}


];



// Ajout recherche Internet

if(internetResults){


messages.push({

role:"user",

content:
`
Voici les informations trouvées sur Internet :

${internetResults}

Réponds à la question de l'utilisateur
avec ces informations.
`

});


}



messages.push(...history);





// =========================
// APPEL GROQ
// =========================


const response = await fetch(

"https://api.groq.com/openai/v1/chat/completions",

{


method:"POST",


headers:{


"Content-Type":"application/json",


Authorization:
`Bearer ${API_KEY}`


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
"GROQ =>",
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

"CHAT ERROR =>",

error

);



res.json({

reply:"Erreur serveur chat."

});


}



});






// =========================
// ANALYSE IMAGE GEMINI
// =========================


app.post("/vision", async(req,res)=>{


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
Analyse cette image en français.

Décris ce que tu vois.

Lis les textes.

Explique les objets,
les personnes,
les lieux.

Réponds aux questions.
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

error

);



res.json({

reply:"Erreur analyse image."

});


}


});







// =========================
// GENERATION IMAGE HUGGING FACE
// =========================


app.post("/generate-image", async(req,res)=>{


try{


const prompt =
req.body.prompt;



if(!prompt){


return res.json({

error:"Aucune description."

});


}




const response =
await fetch(


"https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",


{


method:"POST",


headers:{


"Authorization":
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


const errorText =
await response.text();



console.log(

"HF ERROR :",

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
"data:image/png;base64," + imageBase64

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
// START SERVER
// =========================


const PORT =
process.env.PORT || 3000;



app.listen(PORT,()=>{


console.log(

`✅ NovaAI serveur lancé sur ${PORT}`

);


});
