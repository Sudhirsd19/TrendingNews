const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {

  await db.collection("test")
    .doc("demo")
    .set({
      message: "Firebase connected successfully",
      time: new Date()
    });

  console.log("Firebase connected ✅");
}

run();
