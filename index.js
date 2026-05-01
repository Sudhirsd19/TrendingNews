const axios = require("axios");
const admin = require("firebase-admin");

// 🔑 ENV KEYS
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

// 🔥 Firebase Init
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

// 🔥 JSON Extract
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

// 🔥 PROMPT (TRENDING + SUMMARY + MCQ)
function createPrompt(title, desc) {
  return `
Generate UPSC-style CURRENT AFFAIRS news in JSON:

{
"NewsTitle_en":"",
"NewsTitle_hi":"",
"Summary_en":"(2-3 lines short summary)",
"Summary_hi":"",
"NewsDesc_en":"(100-120 words explanation)",
"NewsDesc_hi":"",
"GS_Tag":"GS1/GS2/GS3",
"MCQ_en":[
  {
    "question":"",
    "options":["","","",""],
    "answer":""
  }
],
"MCQ_hi":[
  {
    "question":"",
    "options":["","","",""],
    "answer":""
  }
]
}

News:
Title: ${title}
Description: ${desc}

IMPORTANT:
- Generate 2-5 MCQs
- Cover facts + concepts + impact
- Summary must be short
- Description should be crisp (not long)
- Hindi natural
- ONLY JSON
`;
}

// 🔥 fallback
function fallbackNews(article) {
  return {
    NewsTitle_en: article.title,
    NewsTitle_hi: article.title,
    Summary_en: article.description || "Top global news event.",
    Summary_hi: "यह एक महत्वपूर्ण वैश्विक समाचार है।",
    NewsDesc_en: article.description || "No description available.",
    NewsDesc_hi: "विवरण उपलब्ध नहीं है।",
    GS_Tag: "GS2",
    MCQ_en: [],
    MCQ_hi: [],
    NewsPic: article.urlToImage || "https://via.placeholder.com/300"
  };
}

// 🚀 MAIN
async function run() {
  try {

    // 🔥 GLOBAL TRENDING NEWS (IMPORTANT CHANGE)
    const newsRes = await axios.get(
      https://newsapi.org/v2/top-headlines?language=en&pageSize=30&apiKey=${NEWS_API_KEY}`
    );

    const articles = newsRes.data.articles;

    const results = [];
    const usedTitles = new Set();

    for (let i = 0; i < articles.length; i++) {
      if (results.length >= TARGET_NEWS) break;

      const article = articles[i];

      if (!article.title || usedTitles.has(article.title)) continue;

      // ❌ ignore useless news
      if (!article.description) continue;

      usedTitles.add(article.title);

      console.log(`📰 ${results.length + 1}:`, article.title);

      let parsed = null;

      if (USE_AI && GEMINI_API_KEY) {
        await delay(2500);

        const prompt = createPrompt(article.title, article.description);
        const aiText = await callGemini(prompt);

        parsed = extractJSON(aiText);
      }

      if (!parsed) {
        console.log("⚠️ Using fallback...");
        parsed = fallbackNews(article);
      }

      // 🔥 IMAGE FIX (IMPORTANT)
      parsed.NewsPic =
        article.urlToImage ||
        parsed.NewsPic ||
        "https://via.placeholder.com/300";

      results.push(parsed);
    }

    console.log("✅ FINAL COUNT:", results.length);

    // 🔥 DELETE OLD
    const snapshot = await db.collection("TrendingNews").get();
    const deleteBatch = db.batch();

    snapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();

    console.log("🗑 Old news deleted");

    // 🔥 ADD NEW
    const addBatch = db.batch();

    results.forEach(news => {
      const ref = db.collection("TrendingNews").doc();
      addBatch.set(ref, news);
    });

    await addBatch.commit();

    console.log("🔥 SUCCESS: Firestore Updated");

  } catch (err) {
    console.log("❌ ERROR:", err.message);
  }
}

run();
