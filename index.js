const fetch = require("node-fetch");
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔹 News Fetch
async function fetchNews() {
  const res = await fetch(`https://newsapi.org/v2/top-headlines?language=en&pageSize=2&apiKey=${process.env.NEWS_API_KEY}`);
  const data = await res.json();
  return data.articles;
}

// 🔹 AI Call
async function callAI(prompt) {
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
  return data.choices[0].message.content;
}

// 🔹 Generate Brief
async function generateBrief(article) {
  const prompt = `
Convert into UPSC format:

1. English Header
2. Hindi Header
3. English Brief (minimum 200 words)
4. Hindi Brief (minimum 200 words)

Title: ${article.title}
Description: ${article.description}

Return JSON only.
`;
  return JSON.parse(await callAI(prompt));
}

// 🔹 Generate MCQ
async function generateMCQ(brief) {
  const prompt = `
Generate 5 UPSC MCQs in English & Hindi with answer.

${brief}

Return JSON array.
`;
  return JSON.parse(await callAI(prompt));
}

// 🔥 MAIN
async function run() {

  const newsList = await fetchNews();
  const articles = [];

  for (let n of newsList) {
    try {
      const brief = await generateBrief(n);
      const mcq = await generateMCQ(brief.NewsBriefEnglish);

      articles.push({
        ...brief,
        NewsPic: n.urlToImage,
        MCQ: mcq
      });

    } catch (e) {
      console.log("Error:", e);
    }
  }

  await db.collection("TrendingNews")
    .doc("latest")
    .set({
      updatedAt: new Date(),
      articles: articles
    });

  console.log("🔥 FINAL DATA UPDATED");
}

run();
