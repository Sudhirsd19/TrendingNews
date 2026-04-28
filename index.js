const axios = require("axios");
const admin = require("firebase-admin");

// 🔐 Firebase Init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🌍 Fetch News
async function fetchNews() {
  try {
    const url = `https://newsapi.org/v2/everything?q=world&sortBy=publishedAt&pageSize=10&apiKey=${process.env.NEWS_API_KEY}`;
    const res = await axios.get(url);

    console.log("API Response:", res.data);

    return res.data.articles || [];
  } catch (err) {
    console.log("News Fetch Error:", err.message);
    return [];
  }
}

// 🤖 GROQ AI CALL
async function callAI(prompt) {
  try {
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "mixtral-8x7b-32768",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.data.choices[0].message.content;
  } catch (err) {
    console.log("AI ERROR:", err.response?.data || err.message);
    return null;
  }
}

// 🧠 Generate Content (Hindi + English + MCQ)
async function generateContent(article) {
  const prompt = `
Return ONLY JSON:

{
"NewsTittle_en":"",
"NewsTittle_hi":"",
"NewsDesc_en":"",
"NewsDesc_hi":"",
"MCQ_en":[
  {
    "question":"",
    "options":["A","B","C","D"],
    "answer":"A"
  }
],
"MCQ_hi":[
  {
    "question":"",
    "options":["A","B","C","D"],
    "answer":"A"
  }
]
}

Rules:
- Description minimum 150 words (strictly follow)
- Description should be detailed (150–250 words)
- Generate maximum MCQs (at least 5-10)
- Questions must be UPSC level
- Hindi must be proper translation

News:
${article.title}
${article.description}
`;

  const result = await callAI(prompt);

  if (!result) return null;

  try {
    const clean = result.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.log("Parse Error:", result);
    return null;
  }
}

// 🚀 MAIN FUNCTION
(async () => {
  const newsList = await fetchNews();

  if (newsList.length === 0) {
    console.log("❌ No news found");
    return;
  }

  let finalData = [];

  for (let n of newsList.slice(0, 10)) {
    console.log("📰 Processing:", n.title);

    const aiData = await generateContent(n);

    if (!aiData) continue;

    finalData.push({
      ...aiData,
      NewsPic: n.urlToImage || "",
    });
  }

  console.log("Final Data:", finalData.length);

  if (finalData.length === 0) {
    console.log("❌ No AI Data Generated");
    return;
  }

  // 🔥 Replace old data (Single Document)
  await db.collection("TrendingNews").doc("latest").set({
    articles: finalData,
    updatedAt: new Date(),
  });

  console.log("🔥 FINAL DATA WITH MCQ UPDATED SUCCESSFULLY");
})();
