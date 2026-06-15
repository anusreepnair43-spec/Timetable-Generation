const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  rollNo: String,
  name: String,
  regNo: { type: String, unique: true, required: true },  // Added required: true
  universityRegNo: { type: String, unique: true, sparse: true }, // explicitly maps the parser to bypass Mongoose stripping the field
  mobile: String,
  email: { type: String, unique: true, required: true },
  password: String,  // This field exists but isn't used in your current logic

  // Semester details
  semester: { type: Number, default: null },
  semesterType: { type: String, enum: ["Odd", "Even"], default: null },

  // For login token functionality
  loginToken: String,
  loginTokenExpiry: Date,

  // ✅ REQUIRED FOR EXCEL LOGIC
  uploadedFromExcel: { type: Boolean, default: false },
  uploadBatchId: { type: String, default: null }
});

// Optional: Add index for faster email queries
studentSchema.index({ email: 1 });
studentSchema.index({ regNo: 1 });

module.exports = mongoose.model("Student", studentSchema);