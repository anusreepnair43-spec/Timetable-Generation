const mongoose = require("mongoose");
const Subject = require("./subject");
require("dotenv").config();

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/LoginApp");
        console.log("✅ Connected to MongoDB");

        const result = await Subject.updateMany(
            { department: { $exists: false } },
            { $set: { department: "CSE" } }
        );

        console.log(`✅ Updated ${result.modifiedCount} subjects with default department 'CSE'`);

    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

migrate();
