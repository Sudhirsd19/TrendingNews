const axios = require("axios");

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;

const TARGET_NEWS = 10;

// 🔥 Clean JSON extractor
function extractJSON(text) {
  try {
    const match = text.match(/{[\s\S]*}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

// 🔥 Gemini API call (with retry)
async function callGemini(prompt, retry = 3) {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    return res.data.candidates[0].content.parts[0].text;

  } catch (err) {
    console.log("⚠️ Gemini Error:", err.response?.data || err.message);

    if (retry > 0) {
      await new Promise(r => setTimeout(r, 5000)); // wait 5 sec
      return callGemini(prompt, retry - 1);
    }

    return null;
  }
}

// 🔥 AI Prompt
function createPrompt(title, desc) {
  return `
Generate UPSC-style news in JSON:

{
"NewsTitle_en":"",
"NewsTitle_hi":"",
"NewsDesc_en":"(150+ words)",
"NewsDesc_hi":"(human Hindi)",
"GS_Tag":"",
"MCQ_en":[{"question":"","options":["","","",""],"answer":""}],
"MCQ_hi":[{"question":"","options":["","","",""],"answer":""}]
}

News:
Title: ${title}
Description: ${desc}

ONLY JSON.
`;
}

// 🔥 Fallback (AI fail ho to bhi data mile)
function fallbackNews(article) {
  return {
    NewsTitle_en: article.title,
    NewsTitle_hi: article.title,
    NewsDesc_en: article.description || "No description available.",
    NewsDesc_hi: article.description || "कोई विवरण उपलब्ध नहीं है।",
    GS_Tag: "GS2",
    MCQ_en: [],
    MCQ_hi: [],
    NewsPic: article.urlToImage || ""
  };
}

// 🔥 Main function
async function run() {
  try {
    const newsRes = await axios.get(
      `https://newsapi.org/v2/top-headlines?language=en&pageSize=30&apiKey=${NEWS_API_KEY}`
    );

    console.log("API Response:", newsRes.data.status, newsRes.data.articles.length);

    const articles = newsRes.data.articles;

    const results = [];
    const usedTitles = new Set();

    for (let i = 0; i < articles.length; i++) {
      if (results.length >= TARGET_NEWS) break;

      const article = articles[i];

      // ❌ Skip duplicates
      if (usedTitles.has(article.title)) continue;
      usedTitles.add(article.title);

      console.log(`📰 Processing (${results.length + 1}/${TARGET_NEWS}):`, article.title);

      const prompt = createPrompt(article.title, article.description);

      const aiText = await callGemini(prompt);

      let parsed = extractJSON(aiText);

      if (!parsed) {
        console.log("⚠️ Using fallback...");
        parsed = fallbackNews(article);
      }

      parsed.NewsPic = article.urlToImage || "";

      results.push(parsed);
    }

    console.log("✅ FINAL COUNT:", results.length);

    if (results.length === 0) {
      console.log("❌ No AI Data Generated");
      return;
    }

    console.log("🔥 FINAL OUTPUT:\n");
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.log("❌ ERROR:", err.message);
  }
}

run();
