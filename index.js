const axios = require("axios");
const admin = require("firebase-admin");

// 🔥 Firebase Init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🔥 APIs
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// 👉 Fetch Top Global News
async function getNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=10&apiKey=${NEWS_API_KEY}`;
  const res = await axios.get(url);

  console.log("API Response:", res.data.status, res.data.totalResults);

  return res.data.articles || [];
}

// 👉 Gemini AI Generator
async function generateAI(content) {
  try {
    const prompt = `
Convert this news into:

1. English Title
2. Hindi Title
3. English Description (minimum 150 words)
4. Hindi Description (minimum 150 words)
5. 3 UPSC-style MCQs in English (with 4 options + correct answer)
6. 3 UPSC-style MCQs in Hindi (with 4 options + correct answer)

News:
${content}

Return ONLY JSON:
{
"NewsTitle_en":"",
"NewsTitle_hi":"",
"NewsDesc_en":"",
"NewsDesc_hi":"",
"MCQ_en":[],
"MCQ_hi":[]
}
`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }
    );

    let text =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 🔥 Clean JSON (important)
    text = text.replace(/```json|```/g, "").trim();

    return JSON.parse(text);
  } catch (err) {
    console.log("GEMINI ERROR:", err.response?.data || err.message);
    return null;
  }
}

// 👉 Main Runner
async function run() {
  const news = await getNews();

  if (!news.length) {
    console.log("❌ No News Found");
    return;
  }

  let finalData = [];

  for (let article of news) {
    if (!article.title || !article.description) continue;

    console.log("📰 Processing:", article.title);

    const ai = await generateAI(
      article.title + ". " + article.description
    );

    if (!ai) continue;

    finalData.push({
      NewsTitle_en: ai.NewsTitle_en || "",
      NewsTitle_hi: ai.NewsTitle_hi || "",
      NewsDesc_en: ai.NewsDesc_en || "",
      NewsDesc_hi: ai.NewsDesc_hi || "",
      MCQ_en: ai.MCQ_en || [],
      MCQ_hi: ai.MCQ_hi || [],
      NewsPic: article.urlToImage || "",
      updatedAt: new Date(),
    });
  }

  console.log("Final Data:", finalData.length);

  if (finalData.length === 0) {
    console.log("❌ No AI Data Generated");
    return;
  }

  // 🔥 Upload to Firestore
  await db.collection("news").doc("latest").set({
    articles: finalData,
    updatedAt: new Date(),
  });

  console.log("🔥 FINAL DATA UPDATED SUCCESSFULLY");
}

// 🚀 Run
run();
