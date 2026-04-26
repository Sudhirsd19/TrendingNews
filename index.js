const fetch = require("node-fetch");
const admin = require("firebase-admin");

// 🔐 Firebase init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 📰 Fetch News
async function fetchNews() {
  try {
    const res = await fetch(`https://newsapi.org/v2/top-headlines?language=en&pageSize=2&apiKey=${process.env.NEWS_API_KEY}`);
    const data = await res.json();

    console.log("API Response:", JSON.stringify(data));

    if (data.status === "ok" && data.articles) {
      return data.articles;
    } else {
      console.log("News API error:", data);
      return [];
    }

  } catch (e) {
    console.log("Fetch error:", e);
    return [];
  }
}

// 🤖 AI Call
async function callAI(prompt) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await res.json();

    if (!data.choices) {
      console.log("AI error:", data);
      return null;
    }

    return data.choices[0].message.content;

  } catch (e) {
    console.log("AI call error:", e);
    return null;
  }
}

// 🧾 Generate Brief
async function generateBrief(article) {
  const prompt = `
Convert into UPSC format JSON:

{
"NewsHeaderEnglish":"",
"NewsHeaderHindi":"",
"NewsBriefEnglish":"",
"NewsBriefHindi":""
}

Title: ${article.title}
Description: ${article.description}
`;

  const result = await callAI(prompt);

  try {
    return JSON.parse(result);
  } catch {
    console.log("Brief parse error:", result);
    return null;
  }
}

// ❓ Generate MCQ
async function generateMCQ(brief) {
  const prompt = `
Generate 3 MCQs in JSON format:

[
{
"question_en":"",
"question_hi":"",
"options":["A","B","C","D"],
"answer":"A"
}
]

Text: ${brief}
`;

  const result = await callAI(prompt);

  try {
    return JSON.parse(result);
  } catch {
    console.log("MCQ parse error:", result);
    return [];
  }
}

// 🚀 MAIN
async function run() {

  const newsList = await fetchNews();

  if (!newsList || newsList.length === 0) {
    console.log("❌ No news found");

    await db.collection("TrendingNews")
      .doc("latest")
      .set({
        message: "No news available",
        updatedAt: new Date()
      });

    return;
  }

  const articles = [];

  for (let n of newsList) {
    if (!n.title) continue;

    try {
      const brief = await generateBrief(n);
      if (!brief) continue;

      const mcq = await generateMCQ(brief.NewsBriefEnglish);

      articles.push({
        ...brief,
        NewsPic: n.urlToImage || "",
        MCQ: mcq
      });

    } catch (e) {
      console.log("Processing error:", e);
    }
  }

  // 🔥 Always update Firebase
  await db.collection("TrendingNews")
    .doc("latest")
    .set({
      updatedAt: new Date(),
      articles: articles
    });

  console.log("🔥 FINAL DATA UPDATED SUCCESSFULLY");
}

run();
