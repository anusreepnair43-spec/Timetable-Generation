const mongoose = require("mongoose");
require('dotenv').config();

const dbUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/loginapp";

async function inspectData() {
  try {
    await mongoose.connect(dbUri);
    const db = mongoose.connection.db;
    const entries = await db.collection("manualentries").find({}).toArray();
    
    console.log("Found", entries.length, "manual entries:");
    entries.forEach(e => {
      console.log(`- ID: ${e._id}, Year: ${e.academicYear}, Type: ${e.semesterType}, Sem: ${JSON.stringify(e.semester)}, Subject: ${e.subjectCode}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

inspectData();
