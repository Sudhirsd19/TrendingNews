const axios = require("axios");

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const TARGET_NEWS = 10;
const USE_AI = true; // 🔥 switch

console.log("🔑 GEMINI KEY:", GEMINI_API_KEY ? "FOUND" : "NOT FOUND");

// 🔥 JSON extractor (strong)
function extractJSON(text) {
  try {
    if (!text) return null;

    const clean = text.replace(/```json|```/g, "").trim();
    const match = clean.match(/{[\s\S]*}/);

    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

// 🔥 Delay
const delay = ms => new Promise(res => setTimeout(res, ms));

// 🔥 Gemini API (FIXED MODEL + HEADER)
async function callGemini(prompt, retry = 2) {
  try {
    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent",
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        }
      }
    );

    return res.data.candidates?.[0]?.content?.parts?.[0]?.text;

  } catch (err) {
    console.log("⚠️ Gemini Error:", err.response?.data?.error?.message || err.message);

    if (retry > 0) {
      console.log("🔁 Retrying...");
      await delay(3000);
      return callGemini(prompt, retry - 1);
    }

    return null;
  }
}

// 🔥 Prompt (improved)
function createPrompt(title, desc) {
  return `
Generate UPSC-style news strictly in JSON:

{
"NewsTitle_en":"",
"NewsTitle_hi":"(natural Hindi)",
"NewsDesc_en":"(120-150 words)",
"NewsDesc_hi":"(simple Hindi)",
"GS_Tag":"GS1/GS2/GS3",
"MCQ_en":[{"question":"","options":["","","",""],"answer":""}],
"MCQ_hi":[{"question":"","options":["","","",""],"answer":""}]
}

News:
Title: ${title}
Description: ${desc}

IMPORTANT:
- ONLY JSON
- NO explanation
`;
}

// 🔥 Better fallback
function fallbackNews(article) {
  return {
    NewsTitle_en: article.title,
    NewsTitle_hi: article.title,
    NewsDesc_en: article.description || "No description available.",
    NewsDesc_hi: "यह समाचार हाल ही की एक महत्वपूर्ण घटना से संबंधित है।",
    GS_Tag: "GS2",
    MCQ_en: [],
    MCQ_hi: [],
    NewsPic: article.urlToImage || ""
  };
}

// 🔥 Duplicate + similar filter
function isDuplicate(title, usedTitles) {
  const t = title.toLowerCase();
  for (let u of usedTitles) {
    if (u.includes(t) || t.includes(u)) return true;
  }
  return false;
}

// 🚀 MAIN
async function run() {
  try {
    const newsRes = await axios.get(
      `https://newsapi.org/v2/top-headlines?language=en&pageSize=30&apiKey=${NEWS_API_KEY}`
    );

    console.log("API Response:", newsRes.data.status, newsRes.data.articles.length);

    const articles = newsRes.data.articles;

    const results = [];
    const usedTitles = [];

    for (let i = 0; i < articles.length; i++) {
      if (results.length >= TARGET_NEWS) break;

      const article = articles[i];
      if (!article.title) continue;

      // ❌ duplicate / similar remove
      if (isDuplicate(article.title, usedTitles)) continue;

      usedTitles.push(article.title.toLowerCase());

      console.log(`📰 Processing (${results.length + 1}/${TARGET_NEWS}):`, article.title);

      let parsed = null;

      if (USE_AI && GEMINI_API_KEY) {
        await delay(2500); // 🔥 rate control

        const prompt = createPrompt(article.title, article.description || "");
        const aiText = await callGemini(prompt);

        parsed = extractJSON(aiText);
      }

      // 🔥 fallback
      if (!parsed) {
        console.log("⚠️ Using fallback...");
        parsed = fallbackNews(article);
      }

      parsed.NewsPic = article.urlToImage || "";

      results.push(parsed);
    }

    console.log("✅ FINAL COUNT:", results.length);

    if (results.length === 0) {
      console.log("❌ No Data Generated");
      return;
    }

    console.log("🔥 FINAL OUTPUT:\n");
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.log("❌ ERROR:", err.message);
  }
}

run();
