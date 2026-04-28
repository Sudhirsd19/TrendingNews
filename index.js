const admin = require("firebase-admin");
const fetch = require("node-fetch");

// Firebase init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Fetch news
async function fetchNews() {
  try {
    const res = await fetch(
      `https://newsapi.org/v2/top-headlines?country=in&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`
    );
    const data = await res.json();

    console.log("API Response:", data);

    if (data && data.articles) {
      return data.articles;
    } else {
      return [];
    }
  } catch (e) {
    console.log("Fetch error:", e);
    return [];
  }
}

// Main run
async function run() {
  const newsList = await fetchNews();

  let finalData = [];

  for (let n of newsList) {
    finalData.push({
      title: n.title || "",
      description: n.description || "",
      url: n.url || "",
      image: n.urlToImage || "",
      source: n.source?.name || "",
      publishedAt: n.publishedAt || ""
    });
  }

  console.log("Final Data:", finalData);

  await db.collection("TrendingNews").doc("latest").set({
    articles: finalData,
    updatedAt: new Date()
  });

  console.log("🔥 FINAL DATA UPDATED SUCCESSFULLY");
}

run();
