const axios = require("axios");
const admin = require("firebase-admin");

// ====== CONFIG ======
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GROQ_API_KEY = process.env.OPENAI_KEY; // same secret name use kar sakte ho
const FIREBASE_KEY = JSON.parse(process.env.FIREBASE_KEY);

// ====== FIREBASE INIT ======
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_KEY)
});

const db = admin.firestore();

// ====== GET NEWS ======
async function getNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=10&apiKey=${NEWS_API_KEY}`;
  
  const res = await axios.get(url);
  console.log("API Response:", res.data);

  return res.data.articles || [];
}

// ====== GROQ AI FUNCTION ======
async function generateAI(news) {
  try {
    const prompt = `
Convert this news into JSON format:

Title: ${news.title}
Description: ${news.description}

Return JSON:
{
"NewsTittle_en": "",
"NewsTittle_hi": "",
"NewsDesc_en": "minimum 150 words",
"NewsDesc_hi": "minimum 150 words",
"MCQ_en": [
  {
    "question": "",
    "options": ["A","B","C","D"],
    "answer": ""
  }
],
"MCQ_hi": [
  {
    "question": "",
    "options": ["A","B","C","D"],
    "answer": ""
  }
]
}
`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",   // ✅ WORKING MODEL (IMPORTANT)
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let text = response.data.choices[0].message.content;

    // JSON clean
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return JSON.parse(text);

  } catch (err) {
    console.log("AI ERROR:", err.response?.data || err.message);
    return null;
  }
}

// ====== MAIN FUNCTION ======
async function main() {
  const articles = await getNews();

  let finalData = [];

  for (let news of articles) {
    console.log("📰 Processing:", news.title);

    const aiData = await generateAI(news);

    if (aiData) {
      finalData.push({
        NewsTittle_en: aiData.NewsTittle_en,
        NewsTittle_hi: aiData.NewsTittle_hi,
        NewsDesc_en: aiData.NewsDesc_en,
        NewsDesc_hi: aiData.NewsDesc_hi,
        MCQ_en: aiData.MCQ_en,
        MCQ_hi: aiData.MCQ_hi,
        NewsPic: news.urlToImage || ""
      });
    }
  }

  console.log("Final Data:", finalData.length);

  if (finalData.length === 0) {
    console.log("❌ No AI Data Generated");
    return;
  }

  // ===== FIREBASE UPDATE =====
  await db.collection("news").doc("latest").set({
    articles: finalData,
    updatedAt: new Date()
  });

  console.log("🔥 FINAL DATA UPDATED SUCCESSFULLY");
}

main();
