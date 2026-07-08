const { search } = require("duck-duck-scrape");
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const { search } = require("duck-duck-scrape");


// =========================
// RECHERCHE INTERNET
// =========================

async function searchInternet(query){

    try{

        const results = await search(query, {
            safeSearch: false
        });


        if(!results.results.length){

            return "Aucun résultat trouvé.";

        }


        return results.results
            .slice(0,5)
            .map(result => {

                return `
Titre : ${result.title}

Description :
${result.description}

Lien :
${result.url}

`;

            })
            .join("\n");


    }catch(error){

        console.log(
            "SEARCH ERROR =>",
            error
        );

        return "Recherche impossible.";

    }

}

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_KEY
);


const app = express();


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
// API KEYS
// =========================

const API_KEY = process.env.API_KEY;


// =========================
// MEMOIRE CHAT
// =========================

const userHistories = {};



// =========================
// CHAT GROQ
// =========================

app.post("/chat", async(req,res)=>{


try{


const userMessage = req.body.message;
  let internetResults = "";

const needSearch =
/actualité|news|internet|aujourd'hui|hier|météo|temps|score|match|résultat|prix|cours|crypto|bourse|dernier|dernière|2025|2026/i
.test(userMessage);


if(needSearch){

    console.log(
        "🌍 Recherche Internet :",
        userMessage
    );


    internetResults = await searchInternet(
        userMessage
    );

}

const userId = req.body.userId || "default";


if(!userMessage){

return res.json({

reply:"Écris un message 🙂"

});

}



if(!userHistories[userId]){

userHistories[userId]=[];

}



const history = userHistories[userId];


history.push({

role:"user",

content:userMessage

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

Authorization:`Bearer ${API_KEY}`

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

Si des informations Internet sont fournies,
utilise-les pour répondre.

Ne parle pas de ta recherche.
Réponds naturellement.
`

},

...history

]

})

}

);



const data = await response.json();


console.log(
"GROQ =>",
data
);



const reply =
data?.choices?.[0]?.message?.content ||
"Je n'ai pas répondu.";



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


let image = req.body.image;



if(!image){

return res.json({

reply:"Aucune image reçue."

});

}




// enlève le début base64

image = image.replace(
"data:image/jpeg;base64,",
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


"Analyse cette image en français. Décris ce que tu vois, lis les textes présents, explique les objets, les personnes et réponds aux questions."



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
// GENERATION IMAGE
// =========================

app.post("/generate-image", async (req,res)=>{

  try {

    const prompt = req.body.prompt;


    if(!prompt){

      return res.json({
        error:"Aucune description donnée."
      });

    }


    const response = await fetch(

      "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",

      {
        method:"POST",

        headers:{

          "Authorization":`Bearer ${process.env.HF_API_KEY}`,
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

      const errorText = await response.text();

      console.log(
        "HF ERROR :",
        errorText
      );


      return res.json({

        error:errorText

      });

    }


    const buffer = await response.arrayBuffer();


    const imageBase64 =
      Buffer.from(buffer).toString("base64");


    res.json({

      image:
      "data:image/png;base64," + imageBase64

    });


  }


  catch(error){

    console.log(
      "IMAGE GENERATION ERROR =>",
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
`✅ Server running on port ${PORT}`
);


});
