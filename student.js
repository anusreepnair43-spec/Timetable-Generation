const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  rollNo: String,
  name: String,

  regNo: {
    type: String,
    unique: true,
    required: true
  },

  universityRegNo: {
    type: String,
    unique: true,
    sparse: true
  },

  mobile: String,

  email: {
    type: String,
    unique: true,
    required: true
  },

  password: String,

  // Semester details
  semester: {
    type: Number,
    default: null
  },

  semesterType: {
    type: String,
    enum: ["Odd", "Even"],
    default: null
  },

  // For login token functionality
  loginToken: String,
  loginTokenExpiry: Date,

  // Required for Excel logic
  uploadedFromExcel: {
    type: Boolean,
    default: false
  },

  uploadBatchId: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model("Student", studentSchema);