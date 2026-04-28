const admin = require("firebase-admin");
const fetch = require("node-fetch");

// 🔥 Firebase init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 📰 Fetch News (FIXED)
async function fetchNews() {
  try {
    const url = `https://newsapi.org/v2/everything?q=india&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    console.log("📡 API Response:", data);

    // ❌ API error
    if (!data || data.status !== "ok") {
      console.log("❌ API ERROR:", data);
      return [];
    }

    // ❌ No articles
    if (!data.articles || data.articles.length === 0) {
      console.log("❌ No articles found");
      return [];
    }

    return data.articles;

  } catch (e) {
    console.log("❌ Fetch error:", e);
    return [];
  }
}

// 🚀 Main function
async function run() {
  const newsList = await fetchNews();

  if (!newsList || newsList.length === 0) {
    console.log("⚠️ No news received, skipping update");
    return;
  }

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

  console.log("🧾 Final Data:", finalData);

  // 🔥 Firestore update
  await db.collection("TrendingNews").doc("latest").set({
    articles: finalData,
    updatedAt: new Date()
  });

  console.log("🔥 FINAL DATA UPDATED SUCCESSFULLY");
}

// ▶️ Run
run();
