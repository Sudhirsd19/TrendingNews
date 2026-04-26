const fetch = require("node-fetch");
const admin = require("firebase-admin");
const xml2js = require("xml2js");

// Firebase init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 📰 Fetch News from RSS (BBC)
async function fetchNews() {
  try {
    const res = await fetch("https://feeds.bbci.co.uk/news/world/rss.xml");
    const xml = await res.text();

    const parser = new xml2js.Parser();
    const data = await parser.parseStringPromise(xml);

    const items = data.rss.channel[0].item;

    return items.slice(0, 2).map(n => ({
      title: n.title[0],
      description: n.description[0],
      urlToImage: ""
    }));

  } catch (e) {
    console.log("RSS error:", e);
    return [];
  }
}

// AI Call
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
    return data.choices[0].message.content;

  } catch (e) {
    console.log("AI error:", e);
    return null;
  }
}

// Generate Brief
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
    return null;
  }
}

// Generate MCQ
async function generateMCQ(brief) {
  const prompt = `
Generate 3 MCQs JSON:

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
    return [];
  }
}

// MAIN
async function run() {

  const newsList = await fetchNews();

  if (!newsList.length) {
    await db.collection("TrendingNews")
      .doc("latest")
      .set({
        message: "RSS failed",
        updatedAt: new Date()
      });
    return;
  }

  const articles = [];

  for (let n of newsList) {
    const brief = await generateBrief(n);
    if (!brief) continue;

    const mcq = await generateMCQ(brief.NewsBriefEnglish);

    articles.push({
      ...brief,
      NewsPic: "",
      MCQ: mcq
    });
  }

  await db.collection("TrendingNews")
    .doc("latest")
    .set({
      updatedAt: new Date(),
      articles: articles
    });

  console.log("🔥 RSS DATA UPDATED");
}

run();
