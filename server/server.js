// ===============================
// NOVA AI SERVER
// PARTIE 1/2
// ===============================


const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const fetch = require("node-fetch");

const { GoogleGenerativeAI } = require("@google/generative-ai");


// ===============================
// INITIALISATION
// ===============================


const app = express();


const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_KEY
);


const GROQ_KEY = process.env.API_KEY;
const TAVILY_KEY = process.env.TAVILY_KEY;
const HF_KEY = process.env.HF_API_KEY;



// ===============================
// MIDDLEWARE
// ===============================


app.use(cors());


app.use(express.json({
    limit:"25mb"
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
// MEMOIRE CHAT
// ===============================


const userHistories = {};



// ===============================
// RECHERCHE INTERNET TAVILY
// ===============================


async function searchInternet(query){


    try{


        console.log(
            "🔎 Recherche Tavily :",
            query
        );


        if(!TAVILY_KEY){

            console.log(
                "❌ Pas de clé Tavily"
            );

            return "Recherche internet indisponible.";

        }



        const response = await fetch(

            "https://api.tavily.com/search",

            {

                method:"POST",

                headers:{

                    "Content-Type":"application/json",

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



        const data = await response.json();



        console.log(
            "TAVILY OK"
        );



        if(!data.results || data.results.length===0){


            return "Aucune information trouvée.";

        }




        let results = "";



        data.results.forEach((item,index)=>{


            results += `

RESULTAT ${index + 1}

Titre :
${item.title}

Information :
${item.content}

Source :
${item.url}


`;

        });



        return results;



    }catch(error){


        console.log(
            "TAVILY ERROR =>",
            error
        );


        return "Recherche internet impossible.";

    }


}




// ===============================
// DETECTION BESOIN INTERNET
// ===============================


function needsInternet(text){


    const lower = text.toLowerCase();



    const words = [

        "actualité",
        "actu",
        "news",
        "aujourd",
        "hier",
        "demain",
        "président",
        "présidente",
        "politique",
        "gouvernement",
        "ministre",
        "qui est",
        "où",
        "quand",
        "prix",
        "coût",
        "météo",
        "temps",
        "match",
        "score",
        "résultat",
        "résultats",
        "gagné",
        "gagner",
        "perdu",
        "classement",
        "dernier",
        "dernière",
        "2025",
        "2026",
        "2027"

    ];



    return words.some(word =>
        lower.includes(word)
    );


}




// ===============================
// CHAT GROQ
// ===============================


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



let webInfo = "";



if(needsInternet(message)){


console.log(
"🌍 RECHERCHE ACTIVE"
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



if(history.length > 12){

history.shift();

}




const messages = [


{

role:"system",

content:

`
Tu es NovaAI.

Tu réponds toujours en français.

Tu es une intelligence artificielle utile.

Si des informations internet sont fournies,
elles sont prioritaires.

Utilise uniquement les informations fournies.

Ne dis jamais que tu viens de faire une recherche.

Ne raconte pas que tu n'as pas accès à internet.

Si une information manque,
dis simplement que tu n'as pas trouvé.

Réponds naturellement.
`

}


];



if(webInfo){


messages.push({

role:"system",

content:

`
Informations trouvées sur internet :

${webInfo}

Analyse ces informations et réponds à l'utilisateur.
`

});


}



messages.push(...history);



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



}catch(error){


console.log(
"CHAT ERROR =>",
error
);


res.json({

reply:"Erreur serveur chat."

});


}


});
// ===============================
// ANALYSE IMAGE GEMINI
// ===============================


app.post("/vision", async(req,res)=>{


try{


let image = req.body.image;



if(!image){


return res.json({

reply:"Aucune image reçue."

});


}




image = image.replace(
"data:image/jpeg;base64,",
""
);


image = image.replace(
"data:image/png;base64,",
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

Réponds en français.

Décris les éléments visibles.

Lis les textes présents.

Explique les objets, personnes ou détails importants.

`

]);





const text =
result.response.text();





res.json({

reply:text

});





}catch(error){


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


app.post("/generate-image", async(req,res)=>{


try{


const prompt =
req.body.prompt;



if(!prompt){


return res.json({

error:"Description image manquante."

});


}





if(!HF_KEY){


return res.json({

error:"Clé Hugging Face manquante."

});


}






const response = await fetch(


"https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",


{


method:"POST",


headers:{


"Authorization":
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

"data:image/png;base64," +
imageBase64

});





}catch(error){


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
// TEST SERVEUR
// ===============================


app.get("/test",(req,res)=>{


res.json({

status:"NovaAI fonctionne 🚀"

});


});







// ===============================
// START RENDER
// ===============================


const PORT =
process.env.PORT || 3000;



console.log(
"🚀 Démarrage NovaAI..."
);



app.listen(PORT,()=>{


console.log(

`✅ NovaAI lancé sur le port ${PORT}`

);


});
