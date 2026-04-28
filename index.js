const admin = require("firebase-admin");
const fetch = require("node-fetch");

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔄 Hindi translate function (FREE)
async function translateToHindi(text) {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|hi`
    );
    const data = await res.json();
    return data.responseData.translatedText || text;
  } catch {
    return text;
  }
}

// 📰 Fetch News
async function fetchNews() {
  try {
    const url = `https://newsapi.org/v2/everything?q=india&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.status !== "ok") return [];
    return data.articles || [];

  } catch {
    return [];
  }
}

// 🚀 Main
async function run() {
  const newsList = await fetchNews();

  let finalData = [];

  for (let n of newsList) {

    const title_hi = await translateToHindi(n.title || "");
    const desc_hi = await translateToHindi(n.description || "");

    finalData.push({
      title_en: n.title || "",
      title_hi: title_hi,
      description_en: n.description || "",
      description_hi: desc_hi,
      url: n.url || "",
      image: n.urlToImage || "",
      source: n.source?.name || "",
      publishedAt: n.publishedAt || ""
    });
  }

  await db.collection("TrendingNews").doc("latest").set({
    articles: finalData,
    updatedAt: new Date()
  });

  console.log("🔥 Hindi News Updated Successfully");
}

run();
