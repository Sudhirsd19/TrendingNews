async function fetchNews() {
  try {
    const res = await fetch(`https://newsapi.org/v2/top-headlines?language=en&pageSize=2&apiKey=${process.env.NEWS_API_KEY}`);
    const data = await res.json();

    console.log("API Response:", data); // debug

    // ✅ Safe return
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
