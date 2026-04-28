const fetch = require("node-fetch");
const admin = require("firebase-admin");
const xml2js = require("xml2js");

// Firebase init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 📰 RSS fetch
async function fetchNews() {
  const res = await fetch("https://feeds.bbci.co.uk/news/world/rss.xml");
  const xml = await res.text();

  const parser = new xml2js.Parser();
  const data = await parser.parseStringPromise(xml);

  return data.rss.channel[0].item.slice(0, 2).map(n => ({
    title: n.title[0],
    description: n.description[0]
  }));
}

// 🤖 GROQ AI CALL
async function callAI(prompt) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await res.json();

    if (!data.choices) {
      console.log("Groq error:", data);
      return null;
    }

    return data.choices[0].message.content;

  } catch (e) {
    console.log("Groq API error:", e);
    return null;
  }
}

// 🧾 Generate Brief
async function generateBrief(article) {
  const prompt = `
Return ONLY JSON:

{
"NewsHeaderEnglish":"",
"NewsHeaderHindi":"",
"NewsBriefEnglish":"",
"NewsBriefHindi":""
}

News:
${article.title}
${article.description}
`;

  const result = await callAI(prompt);

  try {
    const clean = result.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    console.log("Parse error:", result);
    return null;
  }
}

// ❓ Generate MCQ
async function generateMCQ(text) {
  const prompt = `
Return ONLY JSON array:

[
{
"question_en":"",
"question_hi":"",
"options":["A","B","C","D"],
"answer":"A"
}
]

Text:
${text}
`;

  const result = await callAI(prompt);

  try {
    const clean = result.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return [];
  }
}

// 🚀 MAIN
async function run() {

  const newsList = await fetchNews();

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

  console.log("🔥 GROQ DATA UPDATED SUCCESSFULLY");
}

run();
