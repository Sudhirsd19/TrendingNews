const axios = require("axios");

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// =========================
// 🔹 FETCH NEWS
// =========================
async function getNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=30&apiKey=${NEWS_API_KEY}`;
  const res = await axios.get(url);
  console.log("API Response:", res.data.status, res.data.articles.length);
  return res.data.articles;
}

// =========================
// 🔹 GEMINI API (RETRY)
// =========================
async function callGemini(prompt, retry = 3) {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    return res.data.candidates?.[0]?.content?.parts?.[0]?.text;

  } catch (err) {
    console.log("❌ GEMINI ERROR:", err.response?.data || err.message);

    if (retry > 0) {
      console.log("🔁 Retrying Gemini...");
      await new Promise(r => setTimeout(r, 2000));
      return callGemini(prompt, retry - 1);
    }

    return null;
  }
}

// =========================
// 🔹 JSON CLEANER
// =========================
function cleanJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/```json|```/g, ""));
    } catch {
      return null;
    }
  }
}

// =========================
// 🔹 FALLBACK (AI FAIL)
// =========================
function fallbackNews(article) {
  return {
    NewsTitle_en: article.title || "",
    NewsTitle_hi: "यह समाचार महत्वपूर्ण है",
    NewsDesc_en: article.description || "No description available",
    NewsDesc_hi: "यह समसामयिक घटना परीक्षा की दृष्टि से महत्वपूर्ण है।",
    GS_Tag: "GS2",
    MCQ_en: [],
    MCQ_hi: [],
    NewsPic: article.urlToImage || ""
  };
}

// =========================
// 🔹 DUPLICATE CHECK
// =========================
function isDuplicate(title, existing) {
  return existing.some(n =>
    n.NewsTitle_en &&
    n.NewsTitle_en.toLowerCase().includes(title.toLowerCase().substring(0, 30))
  );
}

// =========================
// 🔹 AI GENERATE
// =========================
async function generateNews(article) {

  const prompt = `
Generate UPSC style news in JSON format.

{
"NewsTitle_en":"",
"NewsTitle_hi":"",
"NewsDesc_en":"",
"NewsDesc_hi":"",
"GS_Tag":"",
"MCQ_en":[{"question":"","options":["","","",""],"answer":""}],
"MCQ_hi":[{"question":"","options":["","","",""],"answer":""}]
}

Rules:
- Hindi must be natural (not translation)
- Description minimum 150 words
- GS tagging required (GS1/GS2/GS3/GS4)
- Generate 3 MCQs
- Return valid JSON only

News:
Title: ${article.title}
Description: ${article.description}
`;

  const text = await callGemini(prompt);

  console.log("🔍 RAW AI:", text ? text.slice(0, 120) : "No response");

  if (!text) {
    console.log("⚠️ Using fallback (no AI)");
    return fallbackNews(article);
  }

  const json = cleanJSON(text);

  if (!json) {
    console.log("❌ JSON FAILED → fallback");
    return fallbackNews(article);
  }

  return {
    ...json,
    NewsPic: article.urlToImage || ""
  };
}

// =========================
// 🔹 MAIN PROCESS
// =========================
async function main() {
  try {
    const articles = await getNews();

    let finalData = [];

    for (let art of articles) {

      if (finalData.length >= 10) break;

      if (!art.title || !art.description) continue;

      if (isDuplicate(art.title, finalData)) continue;

      console.log(`📰 Processing (${finalData.length + 1}/10):`, art.title);

      const aiData = await generateNews(art);

      if (!aiData) continue;

      if (isDuplicate(aiData.NewsTitle_en, finalData)) continue;

      finalData.push(aiData);
    }

    console.log("✅ FINAL COUNT:", finalData.length);

    if (finalData.length === 0) {
      console.log("❌ No AI Data Generated");
      return;
    }

    console.log("🔥 FINAL OUTPUT:\n");
    console.log(JSON.stringify(finalData, null, 2));

  } catch (err) {
    console.log("❌ MAIN ERROR:", err.message);
  }
}

main();
