// =====================================
// NOVA AI SERVER V2
// PARTIE 1/2
// =====================================


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
// INITIALISATION
// =====================================


const app = express();



const PORT =
process.env.PORT || 3000;



// =====================================
// VARIABLES API
// =====================================


const GEMINI_KEY =
process.env.GEMINI_KEY;


const GROQ_KEY =
process.env.API_KEY;


const TAVILY_KEY =
process.env.TAVILY_KEY;


const HF_KEY =
process.env.HF_API_KEY;



// =====================================
// VERIFICATION CONFIGURATION
// =====================================


console.log("🚀 Vérification NovaAI...");


if(!GROQ_KEY)
console.log("❌ API_KEY Groq absente");


if(!GEMINI_KEY)
console.log("❌ GEMINI_KEY absente");


if(!TAVILY_KEY)
console.log("⚠️ TAVILY_KEY absente");


if(!HF_KEY)
console.log("⚠️ HF_API_KEY absente");





const genAI =
new GoogleGenerativeAI(
    GEMINI_KEY
);





// =====================================
// MIDDLEWARE
// =====================================


app.use(cors());


app.use(express.json({

    limit:"10mb"

}));




// Protection anti spam


const limiter = rateLimit({

    windowMs:60 * 1000,

    max:40,

    message:{

        error:
        "Trop de requêtes. Réessaie dans quelques secondes."

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
// MEMOIRE TEMPORAIRE
// =====================================


const userHistories = {};





// =====================================
// RECHERCHE INTERNET TAVILY
// =====================================


async function searchInternet(query){


    try{


        if(!TAVILY_KEY){


            return "Recherche internet indisponible.";

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


                query,


                search_depth:
                "advanced",


                max_results:5


            })


        });



        const data =
        await response.json();




        if(!data.results){


            return "Aucun résultat trouvé.";

        }



        let text="";



        data.results.forEach(
        (item,index)=>{


            text += `

SOURCE ${index+1}

Titre :
${item.title}

Résumé :
${item.content}

Lien :
${item.url}


`;

        });



        return text;



    }catch(error){


        console.log(
            "TAVILY ERROR",
            error
        );


        return "Recherche impossible.";

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

reply:"Écris-moi un message 🙂"

});


}




let webInfo="";



if(needsInternet(message)){


console.log(
"🌍 Recherche internet activée"
);


webInfo =
await searchInternet(message);


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




if(history.length>15){

history.shift();

}





const messages=[

{


role:"system",


content:`

Tu es NovaAI 🚀.

Tu es un assistant IA premium français.

Ton comportement :

- Réponds toujours en français.
- Sois clair, utile et professionnel.
- Explique simplement les sujets complexes.
- Structure tes réponses avec des listes quand nécessaire.
- Ne crée jamais de fausses informations.
- Si tu n'es pas sûr, dis-le clairement.
- Ne prétends jamais avoir fait une action impossible.
- Aide l'utilisateur avec patience.

Tu représentes la marque NovaAI.

`

}


];





if(webInfo){



messages.push({

role:"system",

content:`

Informations provenant d'une recherche internet :

${webInfo}

Utilise uniquement ces informations.

`

});


}





messages.push(
...history
);







if(!GROQ_KEY){


return res.json({

reply:
"Clé IA Groq manquante."

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


temperature:0.7


})


}

);





const data =
await response.json();




const reply =

data?.choices?.[0]?.message?.content

||

"Je n'ai pas trouvé de réponse.";





history.push({

role:"assistant",

content:reply

});





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


app.post("/vision", async(req,res)=>{


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

Décris ce que tu vois.

Lis les textes présents.

Explique les éléments importants.

`




]);






const text =
result.response.text();





res.json({

reply:text

});





}catch(error){



console.log(
"GEMINI ERROR",
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


app.post("/generate-image", async(req,res)=>{


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
"Clé image manquante."

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
"Erreur création image."

});


}





const buffer =
await response.arrayBuffer();




const base64 =
Buffer.from(buffer)
.toString("base64");






res.json({

image:

"data:image/png;base64,"+
base64,


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
"Erreur génération image."

});



}



});










// =====================================
// TESTS
// =====================================



app.get("/test",(req,res)=>{


res.json({

status:
"NovaAI fonctionne 🚀"

});


});





app.get("/health",(req,res)=>{


res.status(200).json({

status:
"online",

service:
"NovaAI"


});


});







// =====================================
// DEMARRAGE
// =====================================



console.log(
"🚀 Démarrage NovaAI..."
);



app.listen(PORT,()=>{


console.log(

`✅ NovaAI lancé sur port ${PORT}`

);


});
