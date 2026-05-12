// 🔥 EXAM-RELEVANT FILTER
function isImportantNews(article) {

  const text = (
    article.title + " " + article.description
  ).toLowerCase();

  // ❌ REJECT NON-EXAM NEWS
  const rejectKeywords = [

    // entertainment
    "movie",
    "bollywood",
    "actor",
    "actress",
    "celebrity",
    "film",
    "box office",

    // sports
    "ipl",
    "cricket",
    "football",
    "match",
    "tournament",
    "sports",

    // gossip
    "dating",
    "relationship",
    "wedding",

    // local crime
    "murder",
    "rape",
    "robbery",
    "gang",
    "kidnap",

    // social media
    "viral",
    "instagram",
    "youtube influencer",

    // shopping
    "sale",
    "discount",
    "offer"
  ];

  // ❌ immediately reject
  if (rejectKeywords.some(k => text.includes(k))) {
    return false;
  }

  // ✅ IMPORTANT FOR UPSC / SSC / BANKING
  const importantKeywords = [

    // polity
    "constitution",
    "supreme court",
    "high court",
    "parliament",
    "bill",
    "act",
    "law",
    "judgment",
    "election",
    "governor",
    "president",

    // governance
    "government",
    "ministry",
    "scheme",
    "policy",
    "cabinet",
    "committee",

    // economy
    "rbi",
    "repo rate",
    "gdp",
    "inflation",
    "economy",
    "bank",
    "budget",
    "tax",
    "stock market",
    "imf",
    "world bank",

    // international relations
    "united nations",
    "un",
    "g20",
    "summit",
    "china",
    "usa",
    "russia",
    "india-us",
    "foreign policy",

    // science & tech
    "isro",
    "nasa",
    "satellite",
    "space",
    "quantum",
    "ai",
    "semiconductor",
    "technology",

    // environment
    "climate",
    "cop28",
    "environment",
    "biodiversity",
    "wildlife",

    // defence
    "army",
    "navy",
    "air force",
    "military",
    "missile",
    "defence",

    // health
    "who",
    "vaccine",
    "health ministry",

    // education
    "ugc",
    "neet",
    "education policy",
    "upsc"
  ];

  return importantKeywords.some(k => text.includes(k));
}
