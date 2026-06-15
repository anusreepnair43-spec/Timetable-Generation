const mongoose = require("mongoose");
const connectDB = require("./db");
const Faculty = require("./faculty");

async function injectSub() {
    await connectDB();
    try {
        let faculty2 = await Faculty.findOne({ email: "faculty2@test.com" });
        if (!faculty2) {
            faculty2 = new Faculty({
                name: "Dr. Jones",
                username: "faculty2@test.com",
                email: "faculty2@test.com",
                password: "password123",
                role: "Professor",
                department: "CSE",
                approved: true,
                canTakeBackToBack: true,
                experience: 10
            });
            await faculty2.save();
            console.log("✅ Faculty2 created.");
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
injectSub();
