const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {

  await db.collection("TrendingNews")
    .doc("latest")
    .set({
      message: "Now writing in TrendingNews ✅",
      time: new Date()
    });

  console.log("Data written to TrendingNews ✅");
}

run();
