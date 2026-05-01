const axios = require("axios");
const admin = require("firebase-admin");

// 🔑 ENV
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 🔥 Firebase JSON file (BEST METHOD)
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

console.log("🔥 Firebase Connected");
console.log("🔑 GEMINI KEY:", GEMINI_API_KEY ? "FOUND" : "NOT FOUND");

const TARGET_NEWS = 10;
const USE_AI = true;

// 🔥 Delay
const delay = ms => new Promise(res => setTimeout(res, ms));

// 🔥 JSON extract
function extractJSON(text) {
  try {
    if (!text) return null;
    const clean = text.replace(/```json|```/g, "").trim();
    const match = clean.match(/{[\s\S]*}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

// 🔥 Gemini API
async function callGemini(prompt, retry = 2) {
  try {
    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent",
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        }
      }
    );

    return res.data.candidates?.[0]?.content?.parts?.[0]?.text;

  } catch (err) {
    console.log("⚠️ Gemini Error:", err.response?.data?.error?.message || err.message);

    if (retry > 0) {
      await delay(3000);
      return callGemini(prompt, retry - 1);
    }

    return null;
  }
}

// 🔥 Prompt
function createPrompt(title, desc) {
  return `
Generate UPSC-style news strictly in JSON:

{
"NewsTitle_en":"",
"NewsTitle_hi":"",
"NewsDesc_en":"",
"NewsDesc_hi":"",
"GS_Tag":"",
"MCQ_en":[{"question":"","options":["","","",""],"answer":""}],
"MCQ_hi":[{"question":"","options":["","","",""],"answer":""}]
}

Title: ${title}
Description: ${desc}

ONLY JSON
`;
}

// 🔥 fallback
function fallbackNews(article) {
  return {
    NewsTitle_en: article.title,
    NewsTitle_hi: article.title,
    NewsDesc_en: article.description || "No description",
    NewsDesc_hi: "यह एक महत्वपूर्ण समाचार है।",
    GS_Tag: "GS2",
    MCQ_en: [],
    MCQ_hi: [],
    NewsPic: article.urlToImage || ""
  };
}

// 🚀 MAIN
async function run() {
  try {
    const newsRes = await axios.get(
      `https://newsapi.org/v2/top-headlines?language=en&pageSize=30&apiKey=${NEWS_API_KEY}`
    );

    const articles = newsRes.data.articles;

    const results = [];
    const usedTitles = new Set();

    for (let i = 0; i < articles.length; i++) {
      if (results.length >= TARGET_NEWS) break;

      const article = articles[i];
      if (!article.title || usedTitles.has(article.title)) continue;

      usedTitles.add(article.title);

      console.log(`📰 ${results.length + 1}:`, article.title);

      let parsed = null;

      if (USE_AI && GEMINI_API_KEY) {
        await delay(2000);

        const prompt = createPrompt(article.title, article.description || "");
        const aiText = await callGemini(prompt);
        parsed = extractJSON(aiText);
      }

      if (!parsed) {
        console.log("⚠️ Using fallback...");
        parsed = fallbackNews(article);
      }

      parsed.NewsPic = article.urlToImage || "";

      results.push(parsed);
    }

    console.log("✅ FINAL COUNT:", results.length);

    // 🔥 FIREBASE UPLOAD
    const batch = db.batch();

    results.forEach((news) => {
      const ref = db.collection("TrendingNews").doc();
      batch.set(ref, news);
    });

    await batch.commit();

    console.log("🔥 SUCCESS: Firestore Updated");

  } catch (err) {
    console.log("❌ ERROR:", err.message);
  }
}

run();
