const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  username: String,
  password: String,


  resetToken: String,
  resetTokenExpiry: Date
});

module.exports = mongoose.model("Admin", adminSchema);
