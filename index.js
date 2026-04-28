const axios = require("axios");
const admin = require("firebase-admin");

// 🔐 ENV
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_KEY = JSON.parse(process.env.FIREBASE_KEY);

// 🔥 Firebase Init
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_KEY),
  });
}

const db = admin.firestore();

// 🧠 Gemini AI (Retry + Fallback)
async function generateAI(prompt) {
  const models = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash"
  ];

  for (let model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🤖 ${model} | Attempt ${attempt}`);

        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            contents: [{ parts: [{ text: prompt }] }]
          }
        );

        let text = res.data.candidates[0].content.parts[0].text;

        // 🔥 Clean JSON
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return text;

      } catch (err) {
        console.log(`⚠️ Retry failed`);

        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  return null;
}

// 📰 Fetch News
async function fetchNews() {
  try {
    const res = await axios.get(
      `https://newsapi.org/v2/top-headlines?language=en&pageSize=10&apiKey=${NEWS_API_KEY}`
    );

    console.log("API:", res.data.status, res.data.totalResults);
    return res.data.articles;

  } catch (err) {
    console.log("❌ News Error:", err.message);
    return [];
  }
}

// 🚀 Main
async function run() {
  const articles = await fetchNews();

  if (!articles.length) {
    console.log("❌ No News Found");
    return;
  }

  const finalData = [];

  for (let news of articles) {
    if (!news.title || !news.description) continue;

    console.log("📰", news.title);

    const prompt = `
Convert this news into UPSC format.

News:
${news.title}
${news.description}

Return ONLY VALID JSON:

{
  "NewsTitle_en": "",
  "NewsTitle_hi": "",
  "NewsDesc_en": "",
  "NewsDesc_hi": "",
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

Rules:
- 150+ words description (EN + HI)
- Exactly 3 MCQs each
- No markdown
`;

    const aiText = await generateAI(prompt);

    if (!aiText || aiText.length < 50) continue;

    try {
      const clean = aiText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const json = JSON.parse(clean);

      finalData.push({
        ...json,
        NewsPic: news.urlToImage || "",
        createdAt: new Date().toISOString(),
      });

    } catch (e) {
      console.log("❌ JSON ERROR");
    }

    // ⏳ delay (rate limit safe)
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log("Final Data:", finalData.length);

  // 🔥 Upload to Firebase
  for (let item of finalData) {
    await db.collection("TrendingNews").add(item);
  }

  if (finalData.length > 0) {
    console.log("🔥 SUCCESS");
  } else {
    console.log("❌ No AI Data");
  }
}

run();
