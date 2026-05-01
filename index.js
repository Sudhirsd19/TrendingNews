const axios = require("axios");
const express = require("express");

const app = express();

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// =========================
// 🔹 FETCH NEWS
// =========================
async function getNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=30&apiKey=${NEWS_API_KEY}`;
  const res = await axios.get(url);
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
      console.log("🔁 Retrying...");
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
    NewsTitle_en: article.title,
    NewsTitle_hi: "यह समाचार महत्वपूर्ण है",
    NewsDesc_en: article.description || "No description available",
    NewsDesc_hi: "यह समाचार वर्तमान घटनाओं से संबंधित है और परीक्षा के दृष्टिकोण से महत्वपूर्ण है।",
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
// 🔹 AI GENERATION
// =========================
async function generateNews(article) {

  const prompt = `
Generate UPSC style news in JSON.

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
- GS tagging (GS1/GS2/GS3/GS4)
- 3 MCQs each
- Return valid JSON only

News:
Title: ${article.title}
Description: ${article.description}
`;

  const text = await callGemini(prompt);

  console.log("🔍 RAW AI:", text?.slice(0, 150));

  if (!text) {
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
async function processNews() {
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

  return finalData;
}

// =========================
// 🚀 API FOR APP
// =========================
app.get("/news", async (req, res) => {
  try {
    const data = await processNews();

    if (data.length === 0) {
      return res.json({
        status: "fallback",
        message: "AI failed, showing basic news",
        data: []
      });
    }

    res.json({
      status: "success",
      count: data.length,
      data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// 🚀 SERVER START
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
