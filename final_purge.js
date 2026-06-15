const mongoose = require("mongoose");
const SubstitutionOpportunity = require("./SubstitutionOpportunity");
const SubstitutionRequests = require("./substitutionRequests");

async function purge() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/loginapp");
    console.log("Connected to MongoDB for final purge");

    const dummyPatterns = [/Dr\. Smith/i, /Prof\. Jones/i, /John/i, /Smith/i, /Fake/i];
    
    // Deleting any record that mentions dummy names in either field
    const query = {
      $or: [
        { absentFacultyName: { $in: dummyPatterns } },
        { acceptedFacultyName: { $in: dummyPatterns } }
      ]
    };

    const res1 = await SubstitutionOpportunity.deleteMany(query);
    console.log(`Deleted ${res1.deletedCount} dummy records from SubstitutionOpportunity`);

    const res2 = await SubstitutionRequests.deleteMany(query);
    console.log(`Deleted ${res2.deletedCount} dummy records from SubstitutionRequests`);

    console.log("Final purge finished.");

  } catch (err) {
    console.error("Purge error:", err);
  } finally {
    await mongoose.connection.close();
  }
}

purge();
