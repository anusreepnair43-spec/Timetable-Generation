const mongoose = require("mongoose");
const Faculty = require("./faculty"); // adjust path if needed

mongoose.connect("mongodb://localhost:27017/YOUR_DB_NAME", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  const res = await Faculty.updateMany(
    { approved: { $exists: false } }, // only those without approved field
    { $set: { approved: false } }
  );
  console.log("Updated documents:", res.modifiedCount);
  mongoose.disconnect();
}).catch(err => console.error(err));
