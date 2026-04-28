const axios = require("axios");

// 🔐 ENV
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_KEY = JSON.parse(process.env.FIREBASE_KEY);

// 🔥 Firebase Setup
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_KEY),
  });
}

const db = admin.firestore();

// 🧠 Gemini AI Function
async function generateAI(prompt) {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }
    );

    return res.data.candidates[0].content.parts[0].text;
  } catch (err) {
    console.error("❌ GEMINI ERROR:", err.response?.data || err.message);
    return null;
  }
}

// 📰 Fetch News
async function fetchNews() {
  try {
    const res = await axios.get(
      `https://newsapi.org/v2/top-headlines?language=en&pageSize=10&apiKey=${NEWS_API_KEY}`
    );

    console.log("API Response:", res.data.status, res.data.totalResults);
    return res.data.articles;
  } catch (err) {
    console.error("❌ NEWS API ERROR:", err.message);
    return [];
  }
}

// 🔥 Main Processing
async function run() {
  const articles = await fetchNews();

  if (!articles.length) {
    console.log("❌ No News Found");
    return;
  }

  const finalData = [];

  for (let i = 0; i < articles.length; i++) {
    const news = articles[i];

    if (!news.title || !news.description) continue;

    console.log(`📰 Processing: ${news.title}`);

    const prompt = `
You are a UPSC content creator.

News:
Title: ${news.title}
Description: ${news.description}

Generate strictly JSON:

{
  "NewsTitle_en": "",
  "NewsTitle_hi": "",
  "NewsDesc_en": "",
  "NewsDesc_hi": "",
  "MCQ_en": [
    {
      "question": "",
      "options": ["", "", "", ""],
      "answer": ""
    }
  ],
  "MCQ_hi": [
    {
      "question": "",
      "options": ["", "", "", ""],
      "answer": ""
    }
  ]
}

Rules:
- Description must be minimum 150 words (EN + HI)
- MCQs should be UPSC level (minimum 3 each)
- No explanation, only JSON output
`;

    const aiText = await generateAI(prompt);

    if (!aiText) continue;

    try {
      const json = JSON.parse(aiText);

      finalData.push({
        ...json,
        NewsPic: news.urlToImage || "",
        createdAt: new Date().toISOString(),
      });

    } catch (e) {
      console.log("❌ JSON PARSE ERROR");
      console.log(aiText);
    }
  }

  console.log("Final Data:", finalData.length);

  // 🔥 Upload to Firebase
  for (let item of finalData) {
    await db.collection("TrendingNews").add(item);
  }

  if (finalData.length > 0) {
    console.log("🔥 FINAL DATA UPDATED SUCCESSFULLY");
  } else {
    console.log("❌ No AI Data Generated");
  }
}

// 🚀 Run
run();
