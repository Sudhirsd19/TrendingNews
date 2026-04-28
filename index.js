const axios = require("axios");

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const NEWS_URL = `https://newsapi.org/v2/top-headlines?language=en&pageSize=20&apiKey=${NEWS_API_KEY}`;

// ✅ Gemini API call with retry
async function callGemini(prompt, retry = 3) {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }
    );

    return res.data.candidates[0].content.parts[0].text;

  } catch (err) {
    if (retry > 0) {
      console.log("🔁 Retry Gemini...");
      await new Promise(r => setTimeout(r, 2000));
      return callGemini(prompt, retry - 1);
    }
    console.log("❌ GEMINI ERROR:", err.response?.data || err.message);
    return null;
  }
}

// ✅ Clean JSON parser
function cleanJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const fixed = text.replace(/```json|```/g, "");
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

// ✅ Generate AI Content
async function generateNews(article) {

  const prompt = `
You are UPSC content generator.

Return ONLY valid JSON. No explanation.

{
"NewsTitle_en":"",
"NewsTitle_hi":"",
"NewsDesc_en":"",
"NewsDesc_hi":"",
"MCQ_en":[{"question":"","options":["","","",""],"answer":""}],
"MCQ_hi":[{"question":"","options":["","","",""],"answer":""}]
}

Rules:
- English + Hindi both
- Description minimum 150 words
- Generate 3 MCQs each
- UPSC level questions
- Strict JSON only

News:
Title: ${article.title}
Description: ${article.description}
`;

  const text = await callGemini(prompt);

  if (!text) return null;

  const json = cleanJSON(text);

  if (!json) {
    console.log("❌ JSON ERROR");
    return null;
  }

  return {
    ...json,
    NewsPic: article.urlToImage || ""
  };
}

// ✅ MAIN
async function main() {
  try {
    const newsRes = await axios.get(NEWS_URL);

    const articles = newsRes.data.articles;

    console.log("API Response:", newsRes.data.status, articles.length);

    let finalData = [];

    for (let i = 0; i < articles.length; i++) {
      if (finalData.length >= 10) break;

      const art = articles[i];

      if (!art.title || !art.description) continue;

      console.log(`📰 Processing (${finalData.length + 1}/10):`, art.title);

      const aiData = await generateNews(art);

      if (aiData) {
        finalData.push(aiData);
      } else {
        console.log("⚠️ Skipped...");
      }
    }

    console.log("✅ FINAL COUNT:", finalData.length);

    if (finalData.length === 0) {
      console.log("❌ No AI Data Generated");
      return;
    }

    // 👉 Firebase upload (optional)
    // await uploadToFirebase(finalData);

    console.log("🔥 FINAL DATA READY");

  } catch (err) {
    console.log("❌ MAIN ERROR:", err.message);
  }
}

main();
