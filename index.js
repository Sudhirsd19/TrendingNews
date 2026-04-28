const axios = require("axios");
const admin = require("firebase-admin");

// Firebase Init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🌍 Fetch News
async function fetchNews() {
  const url = `https://newsapi.org/v2/everything?q=world&sortBy=publishedAt&pageSize=10&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await axios.get(url);
  return res.data.articles || [];
}

// 🤖 GROQ AI CALL
async function callAI(prompt) {
  try {
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-70b-8192",
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
    console.log("AI ERROR:", err.message);
    return null;
  }
}

// 🧠 Generate Full Data (Translation + MCQ)
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
- Description minimum 200 words
- Generate maximum MCQs (at least 5-10)
- UPSC level questions
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
  } catch {
    console.log("Parse Error:", result);
    return null;
  }
}

// 🚀 MAIN
(async () => {
  const newsList = await fetchNews();

  let finalData = [];

  for (let n of newsList.slice(0, 10)) {
    console.log("Processing:", n.title);

    const aiData = await generateContent(n);

    if (!aiData) continue;

    finalData.push({
      ...aiData,
      NewsPic: n.urlToImage || "",
    });
  }

  if (finalData.length === 0) {
    console.log("❌ No AI Data Generated");
    return;
  }

  await db.collection("TrendingNews").doc("latest").set({
    articles: finalData,
    updatedAt: new Date(),
  });

  console.log("🔥 FINAL DATA WITH MCQ UPDATED");
})();
