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

// 🔥 SHORT SUMMARY PROMPT
function createPrompt(title, desc) {
  return `
Generate UPSC-style SHORT news summary in JSON:

{
"NewsTitle_en":"",
"NewsTitle_hi":"",
"NewsDesc_en":"(max 60-80 words, crisp summary)",
"NewsDesc_hi":"(short Hindi summary)",
"GS_Tag":"",
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
- Description should be SHORT (60-80 words max)
- Generate 2–5 MCQs (dynamic)
- UPSC level (concept + fact)
- Hindi natural hona chahiye
- ONLY JSON
`;
}

// 🔥 fallback (better summary)
function fallbackNews(article) {
  return {
    NewsTitle_en: article.title,
    NewsTitle_hi: article.title,
    NewsDesc_en: (article.description || "No description").slice(0, 120),
    NewsDesc_hi: "यह हाल की एक महत्वपूर्ण घटना का संक्षिप्त विवरण है।",
    GS_Tag: "GS2",
    MCQ_en: [],
    MCQ_hi: [],
    NewsPic: article.urlToImage || article.url || ""
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
        await delay(2500);

        const prompt = createPrompt(article.title, article.description || "");
        const aiText = await callGemini(prompt);

        parsed = extractJSON(aiText);
      }

      if (!parsed) {
        console.log("⚠️ Using fallback...");
        parsed = fallbackNews(article);
      }

      // 🔥 IMAGE FIX (important)
      parsed.NewsPic =
        article.urlToImage ||
        article.image ||
        (article.url && `https://image.thum.io/get/${article.url}`) || // auto screenshot fallback
        "";

      results.push(parsed);
    }

    console.log("✅ FINAL COUNT:", results.length);

    // 🔥 DELETE OLD DATA
    const snapshot = await db.collection("TrendingNews").get();

    const deleteBatch = db.batch();
    snapshot.docs.forEach((doc) => {
      deleteBatch.delete(doc.ref);
    });

    await deleteBatch.commit();
    console.log("🗑 Old news deleted");

    // 🔥 ADD NEW DATA
    const addBatch = db.batch();

    results.forEach((news) => {
      const ref = db.collection("TrendingNews").doc();
      addBatch.set(ref, news);
    });

    await addBatch.commit();

    console.log("🔥 SUCCESS: Firestore Updated (Short Summary + Image)");

  } catch (err) {
    console.log("❌ ERROR:", err.message);
  }
}

run();
