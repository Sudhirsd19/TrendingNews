const fetch = require("node-fetch");
const admin = require("firebase-admin");

// 🔐 Firebase init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 📰 Fetch News (SAFE)
async function fetchNews() {
  try {
    const res = await fetch(`https://newsapi.org/v2/top-headlines?language=en&pageSize=2&apiKey=${process.env.NEWS_API_KEY}`);
    const data = await res.json();

    console.log("API Response:", data);

    if (data && data.articles) {
      return data.articles;
    } else {
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
      console.log("AI Error:", data);
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
Convert into UPSC format:

1. NewsHeaderEnglish
2. NewsHeaderHindi
3. NewsBriefEnglish (minimum 200 words)
4. NewsBriefHindi (minimum 200 words)

Title: ${article.title}
Description: ${article.description}

Return JSON only.
`;

  const result = await callAI(prompt);

  try {
    return JSON.parse(result);
  } catch (e) {
    console.log("JSON parse error (Brief):", result);
    return null;
  }
}

// ❓ Generate MCQ
async function generateMCQ(brief) {
  const prompt = `
Generate 5 UPSC MCQs in English & Hindi with 4 options and correct answer.

${brief}

Return JSON array.
`;

  const result = await callAI(prompt);

  try {
    return JSON.parse(result);
  } catch (e) {
    console.log("JSON parse error (MCQ):", result);
    return [];
  }
}

// 🚀 MAIN FUNCTION
async function run() {

  const newsList = await fetchNews();

  // ✅ Safe check
  if (!newsList || newsList.length === 0) {
    console.log("No news found ❌");
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

  // 🔥 Firebase update (single document replace)
  await db.collection("TrendingNews")
    .doc("latest")
    .set({
      updatedAt: new Date(),
      articles: articles
    });

  console.log("🔥 FINAL DATA UPDATED SUCCESSFULLY");
}

// ▶️ RUN
run();
