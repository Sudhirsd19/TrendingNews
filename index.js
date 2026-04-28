const axios = require("axios");

async function listModels() {
  const res = await axios.get(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
  );

  console.log(JSON.stringify(res.data, null, 2));
}

listModels();
