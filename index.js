const axios = require("axios");
const admin = require("firebase-admin");

// ===== ENV =====
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_KEY = JSON.parse(process.env.FIREBASE_KEY);

// ===== FIREBASE INIT =====
admin.initializeApp({
  credential: admin.credential.cert(FIREBASE_KEY)
});

const db = admin.firestore();

// ===== GET NEWS =====
async function getNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=10&apiKey=${NEWS_API_KEY}`;
  
  const res = await axios.get(url);
  console.log("API Response:", res.data);

  return res.data.articles || [];
}

// ===== GEMINI AI =====
async function generateAI(news) {
  try {
    const prompt = `
Convert this news into JSON format:

Title: ${news.title}
Description: ${news.description}

Rules:
- English + Hindi
- Description minimum 150 words
- Generate 5 UPSC level MCQs

Return ONLY JSON:
{
"NewsTittle_en": "",
"NewsTittle_hi": "",
"NewsDesc_en": "",
"NewsDesc_hi": "",
"MCQ_en": [
  {"question":"","options":["A","B","C","D"],"answer":""}
],
"MCQ_hi": [
  {"question":"","options":["A","B","C","D"],"answer":""}
]
}
`;

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }
    );

    let text =
      res.data.candidates[0].content.parts[0].text;

    // Clean JSON
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return JSON.parse(text);

  } catch (err) {
    console.log("GEMINI ERROR:", err.response?.data || err.message);
    return null;
  }
}

// ===== MAIN =====
async function main() {
  const articles = await getNews();
  let finalData = [];

  for (let news of articles) {
    if (!news.title || !news.description) continue;

    console.log("📰 Processing:", news.title);

    const ai = await generateAI(news);

    if (ai) {
      finalData.push({
        NewsTittle_en: ai.NewsTittle_en,
        NewsTittle_hi: ai.NewsTittle_hi,
        NewsDesc_en: ai.NewsDesc_en,
        NewsDesc_hi: ai.NewsDesc_hi,
        MCQ_en: ai.MCQ_en,
        MCQ_hi: ai.MCQ_hi,
        NewsPic: news.urlToImage || ""
      });
    }
  }

  console.log("Final Data:", finalData.length);

  if (finalData.length === 0) {
    console.log("❌ No AI Data Generated");
    return;
  }

  await db.collection("news").doc("latest").set({
    articles: finalData,
    updatedAt: new Date()
  });

  console.log("🔥 FINAL DATA UPDATED SUCCESSFULLY");
}

main();
