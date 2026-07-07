const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();


// =========================
// MIDDLEWARE
// =========================

app.use(cors());

app.use(express.json({
  limit: "20mb"
}));


// =========================
// FRONTEND
// =========================

app.use(express.static(
  path.join(__dirname, "..", "public")
));


app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "..", "public", "index.html")
  );

});



// =========================
// API KEYS
// =========================

const API_KEY = process.env.API_KEY;

const HF_API_KEY = process.env.HF_API_KEY;



// =========================
// MEMOIRE SIMPLE
// =========================

const userHistories = {};



// =========================
// CHAT GROQ
// =========================

app.post("/chat", async (req,res)=>{


try{


const userMessage = req.body.message;

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
"Tu es NovaAI. Tu réponds toujours uniquement en français."

},


...history


]


})


}

);



const data = await response.json();



console.log(
"GROQ RESPONSE =>",
data
);



const reply =
data?.choices?.[0]?.message?.content;



history.push({

role:"assistant",

content:reply

});



res.json({

reply:
reply || "IA n'a pas répondu 😕"

});



}

catch(err){


console.log(
"CHAT ERROR =>",
err
);



res.json({

reply:"Erreur serveur 😕"

});


}



});







app.post("/vision", async (req, res) => {

  try {

    let image = req.body.image;

    if (!image) {
      return res.json({
        reply: "Aucune image reçue."
      });
    }


    // remet le format image complet
    if (!image.startsWith("data:image")) {
      image = "data:image/jpeg;base64," + image;
    }


    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {

        method:"POST",

        headers:{
          "Content-Type":"application/json",
          Authorization:`Bearer ${HF_API_KEY}`
        },


        body:JSON.stringify({

          model:"Qwen/Qwen2.5-VL-7B-Instruct",

          messages:[

            {

              role:"user",

              content:[

                {

                  type:"text",

                  text:
                  "Décris cette image en français. Lis le texte visible, explique les objets, les personnes et réponds aux questions sur cette image."

                },


                {

                  type:"image_url",

                  image_url:{
                    url:image
                  }

                }

              ]

            }

          ],


          max_tokens:500

        })

      }
    );


    const data = await response.json();


    console.log("QWEN IMAGE =>",data);



    res.json({

      reply:
      data?.choices?.[0]?.message?.content ||
      "Je n'ai pas réussi à analyser l'image."

    });



  } catch(error){

    console.log("VISION ERROR",error);

    res.json({

      reply:"Erreur analyse image."

    });

  }

});




// =========================
// START SERVER
// =========================


const PORT = process.env.PORT || 3000;


app.listen(PORT,()=>{


console.log(
`✅ Server running on port ${PORT}`
);


});
