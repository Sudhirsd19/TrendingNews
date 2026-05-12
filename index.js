const axios = require("axios");
const admin = require("firebase-admin");
const OpenAI = require("openai");

// 🔑 ENV KEYS
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

// 🔥 Firebase Init
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔥 NVIDIA CLIENT
const client = new OpenAI({
  apiKey: NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

console.log("🔥 Firebase Connected");
console.log("🔑 NVIDIA KEY:", NVIDIA_API_KEY ? "FOUND" : "NOT FOUND");

const TARGET_NEWS = 10;
const USE_AI = true;

// 🔥 Delay
const delay = ms => new Promise(res => setTimeout(res, ms));

// 🔥 JSON Extract
function extractJSON(text) {
  try {

    if (!text) return null;

    const clean = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const match = clean.match(/{[\s\S]*}/);

    return match ? JSON.parse(match[0]) : null;

  } catch (err) {

    console.log("❌ JSON Parse Error");

    return null;
  }
}

// 🔥 NVIDIA AI
async function callAI(prompt, retry = 2) {

  try {

    console.log("🤖 Sending to NVIDIA...");

    const completion =
      await client.chat.completions.create({

        model: "meta/llama-3.1-8b-instruct",

        messages: [
          {
            role: "user",
            content: prompt
          }
        ],

        temperature: 0.4,

        max_tokens: 1500,
      });

    console.log("✅ NVIDIA Response Received");

    return completion.choices[0].message.content;

  } catch (err) {

    console.log(
      "⚠️ NVIDIA Error:",
      err.response?.data || err.message
    );

    if (retry > 0) {

      console.log("🔄 Retrying...");

      await delay(3000);

      return callAI(prompt, retry - 1);
    }

    return null;
  }
}

// 🔥 EXAM-RELEVANT FILTER
function isImportantNews(article) {

  const text = (
    article.title + " " + article.description
  ).toLowerCase();

  // ❌ REJECT NON-EXAM NEWS
  const rejectKeywords = [

    // entertainment
    "movie",
    "bollywood",
    "actor",
    "actress",
    "celebrity",
    "film",
    "box office",

    // sports
    "ipl",
    "cricket",
    "football",
    "match",
    "tournament",
    "sports",

    // gossip
    "dating",
    "relationship",
    "wedding",

    // crime
    "murder",
    "rape",
    "robbery",
    "gang",

    // social media
    "viral",
    "instagram",
    "youtube influencer",

    // ads
    "sale",
    "discount"
  ];

  // ❌ reject immediately
  if (rejectKeywords.some(k => text.includes(k))) {
    return false;
  }

  // ✅ IMPORTANT NEWS
  const importantKeywords = [

    // polity
    "constitution",
    "supreme court",
    "high court",
    "parliament",
    "bill",
    "act",
    "law",
    "judgment",
    "election",

    // governance
    "government",
    "ministry",
    "scheme",
    "policy",
    "cabinet",

    // economy
    "rbi",
    "repo rate",
    "gdp",
    "inflation",
    "economy",
    "bank",
    "budget",
    "tax",
    "imf",
    "world bank",

    // international
    "united nations",
    "un",
    "g20",
    "summit",
    "china",
    "usa",
    "russia",

    // science
    "isro",
    "nasa",
    "satellite",
    "space",
    "quantum",
    "ai",
    "technology",

    // environment
    "climate",
    "environment",
    "biodiversity",
    "wildlife",

    // defence
    "army",
    "navy",
    "air force",
    "military",
    "missile",
    "defence",

    // health
    "who",
    "vaccine",
    "health ministry",

    // education
    "ugc",
    "neet",
    "education policy",
    "upsc"
  ];

  return importantKeywords.some(k => text.includes(k));
}

// 🔥 PROMPT
function createPrompt(title, desc) {

  return `
Generate UPSC CURRENT AFFAIRS in STRICT VALID JSON format.

{
  "NewsTitle_en":"",
  "NewsTitle_hi":"",
  "Summary_en":"",
  "Summary_hi":"",
  "NewsDesc_en":"",
  "NewsDesc_hi":"",
  "GS_Tag":"GS1/GS2/GS3",
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

NEWS TITLE:
${title}

NEWS DESCRIPTION:
${desc}

RULES:
- Generate 2 to 5 MCQs
- UPSC focused
- Educational tone
- Hindi + English both required
- No markdown
- No explanation
- Output ONLY valid JSON
`;
}

// 🔥 FALLBACK
function fallbackNews(article) {

  return {

    NewsTitle_en:
      article.title,

    NewsTitle_hi:
      article.title,

    Summary_en:
      article.description ||
      "Important current affairs news",

    Summary_hi:
      "महत्वपूर्ण समसामयिक समाचार",

    NewsDesc_en:
      article.description ||
      "No description available",

    NewsDesc_hi:
      "विवरण उपलब्ध नहीं है",

    GS_Tag:
      "GS2",

    MCQ_en: [],

    MCQ_hi: [],

    NewsPic:
      article.urlToImage ||
      "https://via.placeholder.com/300"
  };
}

// 🚀 MAIN
async function run() {

  try {

    console.log("🚀 Script Started");

    // 🔥 MULTIPLE NEWS SOURCES
    const urls = [

      `https://newsapi.org/v2/top-headlines?country=in&pageSize=40&apiKey=${NEWS_API_KEY}`,

      `https://newsapi.org/v2/everything?q=international&pageSize=40&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`,

      `https://newsapi.org/v2/everything?q=government&pageSize=40&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`
    ];

    let articles = [];

    for (let url of urls) {

      console.log("🌍 Fetching News...");

      const res = await axios.get(url);

      articles = articles.concat(res.data.articles);
    }

    console.log("📰 Total Articles:", articles.length);

    const results = [];
    const usedTitles = new Set();

    for (let i = 0; i < articles.length; i++) {

      if (results.length >= TARGET_NEWS)
        break;

      const article = articles[i];

      if (!article.title || !article.description)
        continue;

      // ❌ duplicate remove
      if (
        usedTitles.has(
          article.title.toLowerCase()
        )
      ) {
        continue;
      }

      // 🔥 exam filter
      if (!isImportantNews(article)) {
        continue;
      }

      usedTitles.add(
        article.title.toLowerCase()
      );

      console.log(
        `📰 ${results.length + 1}:`,
        article.title
      );

      let parsed = null;

      // 🔥 AI GENERATION
      if (USE_AI && NVIDIA_API_KEY) {

        await delay(2000);

        const prompt =
          createPrompt(
            article.title,
            article.description
          );

        const aiText =
          await callAI(prompt);

        parsed =
          extractJSON(aiText);
      }

      // 🔥 fallback
      if (!parsed) {

        console.log(
          "⚠️ Using fallback..."
        );

        parsed =
          fallbackNews(article);
      }

      // 🔥 image
      parsed.NewsPic =
        article.urlToImage ||
        parsed.NewsPic ||
        "https://via.placeholder.com/300";

      results.push(parsed);
    }

    console.log(
      "✅ FINAL COUNT:",
      results.length
    );

    if (results.length === 0) {

      console.log(
        "❌ No important news found"
      );

      return;
    }

    // 🗑 DELETE OLD NEWS
    const snapshot =
      await db
        .collection("TrendingNews")
        .get();

    const deleteBatch =
      db.batch();

    snapshot.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });

    await deleteBatch.commit();

    console.log("🗑 Old news deleted");

    // 🔥 ADD NEW NEWS
    const addBatch =
      db.batch();

    results.forEach(news => {

      const ref =
        db
          .collection("TrendingNews")
          .doc();

      addBatch.set(ref, news);
    });

    await addBatch.commit();

    console.log(
      "🔥 SUCCESS: Firestore Updated"
    );

  } catch (err) {

    console.log(
      "❌ ERROR:",
      err.message
    );
  }
}

run();
