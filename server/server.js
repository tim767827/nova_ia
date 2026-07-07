const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// FRONT
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});


// =========================
// 🔑 API KEYS
// =========================

const API_KEY = process.env.API_KEY;
const HF_API_KEY = process.env.HF_API_KEY;


/* =========================
   🧠 MEMOIRE SIMPLE
========================= */

const userHistories = {};


/* =========================
   🤖 CHAT ROUTE GROQ
========================= */

app.post("/chat", async (req, res) => {

  try {

    const userMessage = req.body.message;
    const userId = req.body.userId || "default";


    if (!userMessage) {
      return res.json({
        reply: "Écris un message 🙂"
      });
    }


    if (!userHistories[userId]) {
      userHistories[userId] = [];
    }


    const history = userHistories[userId];


    history.push({
      role: "user",
      content: userMessage
    });


    if (history.length > 12) {
      history.shift();
    }



    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Authorization: `Bearer ${API_KEY}`

        },


        body: JSON.stringify({

          model: "llama-3.1-8b-instant",

          messages: [

            {
              role: "system",
              content:
              "Tu es NovaAI. Tu réponds toujours uniquement en français."
            },

            ...history

          ]

        })

      }
    );


    const data = await response.json();


    console.log("GROQ RESPONSE =>", data);


    const reply =
    data?.choices?.[0]?.message?.content;



    history.push({

      role:"assistant",

      content:reply

    });



    res.json({

      reply: reply || "IA n'a pas répondu 😕"

    });



  } catch(err){

    console.log("CHAT ERROR =>",err);

    res.json({

      reply:"Erreur serveur 😕"

    });

  }

});





/* =========================
   👁️ ANALYSE IMAGE
========================= */

app.post("/vision", async (req,res)=>{


  try{


    const image = req.body.image;


    if(!image){

      return res.json({

        reply:"Aucune image reçue."

      });

    }



    const response = await fetch(

   "https://router.huggingface.co/hf-inference/models/Salesforce/blip-image-captioning-base",

      {

        method:"POST",

        headers:{

          Authorization:`Bearer ${HF_API_KEY}`,

          "Content-Type":"application/json"

        },


        body:JSON.stringify({

          inputs:image

        })

      }

    );



    const data = await response.json();



    console.log("VISION RESPONSE =>",data);



    res.json({

      reply:
      data[0]?.generated_text ||
      "Je n'arrive pas à analyser cette image."

    });



  }catch(err){


    console.log("VISION ERROR =>",err);


    res.json({

      reply:"Erreur analyse image."

    });


  }


});





/* =========================
   🚀 SERVER START
========================= */

const PORT = process.env.PORT || 3000;


app.listen(PORT,()=>{

console.log(`✅ Server running on port ${PORT}`);

});
