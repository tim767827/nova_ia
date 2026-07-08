// ===============================
// NOVA AI SERVER - PARTIE 1/2
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
// MEMOIRE DES CHATS
// ===============================


const userHistories = {};



// ===============================
// RECHERCHE TAVILY
// ===============================


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

                    "Content-Type":"application/json",

                    "Authorization":
                    `Bearer ${TAVILY_KEY}`

                },


                body:JSON.stringify({

                    query:query,

                    search_depth:"basic",

                    max_results:5

                })

            }
        );



        const data = await response.json();



        console.log(
            "TAVILY OK"
        );



        if(!data.results || data.results.length===0){

            return "Aucun résultat internet trouvé.";

        }



        return data.results.map(item=>{


            return `

Titre :
${item.title}


Information :
${item.content}


Source :
${item.url}

`;

        }).join("\n\n");



    }catch(error){


        console.log(
            "TAVILY ERROR =>",
            error
        );


        return "Impossible de faire la recherche internet.";

    }


}






// ===============================
// DETECTION RECHERCHE INTERNET
// ===============================


function needsInternet(text){

    return /actualité|actu|news|aujourd'hui|hier|demain|président|présidente|politique|gouvernement|chef|qui est|où est|quand|prix|coût|météo|temps|match|score|résultat|résultats|gagné|gagner|perdu|classement|dernier|dernière|2025|2026/i.test(text);

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




let webInfo = "";



if(needsInternet(message)){


console.log(
"🌍 RECHERCHE ACTIVE"
);



webInfo = await searchInternet(message);



}






if(!userHistories[userId]){


userHistories[userId]=[];

}



const history = userHistories[userId];




history.push({

role:"user",

content:message

});



if(history.length > 12){

history.shift();

}






const messages=[


{

role:"system",

content:`

Tu es NovaAI.

Tu réponds toujours en français.

Tu es une IA utile et précise.

IMPORTANT :

Si des informations INTERNET sont fournies,
elles sont prioritaires.

Utilise ces informations.

Ne dis jamais que tu n'as pas accès à internet.

Ne prétends pas connaître une information
si elle n'est pas présente.

Réponds naturellement sans parler de ta recherche.

`

}


];




if(webInfo){


messages.push({

role:"system",

content:

`

INFORMATIONS INTERNET :

${webInfo}


Utilise ces informations pour répondre.

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



const data = await response.json();



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

Décris ce que tu vois.

Lis les textes présents.

Explique les objets,
les personnes et les détails importants.

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


const prompt = req.body.prompt;



if(!prompt){


return res.json({

error:"Description image manquante."

});


}





const response = await fetch(


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





const imageBase64 =
Buffer.from(buffer)
.toString("base64");






res.json({

image:

"data:image/png;base64," 
+
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
// START
// ===============================


const PORT =
process.env.PORT || 3000;



app.listen(PORT,()=>{


console.log(

`✅ NovaAI lancé sur le port ${PORT}`

);


});



});
