const axios = require("axios");
const express = require("express");

const app = express();
app.use(express.json());

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 🔹 Fetch News
async function getNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=30&apiKey=${NEWS_API_KEY}`;
  const res = await axios.get(url);
  return res.data.articles;
}

// 🔹 Gemini Call (Retry)
async function callGemini(prompt, retry = 3) {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    return res.data.candidates[0].content.parts[0].text;

  } catch (err) {
    if (retry > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return callGemini(prompt, retry - 1);
    }
    return null;
  }
}

// 🔹 JSON Cleaner
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

// 🔹 Duplicate Title Filter
function isDuplicate(title, existing) {
  return existing.some(n =>
    n.NewsTitle_en.toLowerCase().includes(title.toLowerCase().slice(0, 20))
  );
}

// 🔹 AI Generate
async function generateNews(article) {

  const prompt = `
You are UPSC expert content writer.

Return ONLY JSON.

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
- Hindi must be natural, human-like (not translation)
- Description min 150 words
- GS tagging (GS1/GS2/GS3/GS4)
- Remove duplicate topic
- Generate 3 MCQs
- UPSC level

News:
Title: ${article.title}
Description: ${article.description}
`;

  const text = await callGemini(prompt);
  if (!text) return null;

  const json = cleanJSON(text);
  if (!json) return null;

  return {
    ...json,
    NewsPic: article.urlToImage || ""
  };
}

// 🔹 MAIN LOGIC
async function processNews() {
  const articles = await getNews();

  let finalData = [];

  for (let art of articles) {
    if (finalData.length >= 10) break;

    if (!art.title || !art.description) continue;

    if (isDuplicate(art.title, finalData)) continue;

    console.log("📰 Processing:", art.title);

    const aiData = await generateNews(art);

    if (!aiData) continue;

    // Topic duplicate filter
    if (isDuplicate(aiData.NewsTitle_en, finalData)) continue;

    finalData.push(aiData);
  }

  return finalData;
}

//
// 🚀 API FOR YOUR APP
//
app.get("/news", async (req, res) => {
  try {
    const data = await processNews();
    res.json({
      status: "success",
      count: data.length,
      data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// 🚀 SERVER START
//
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
