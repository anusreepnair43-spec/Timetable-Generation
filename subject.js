const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: { type: String, required: true },
  abbreviation: { type: String },
  type: {
    type: String,
    enum: ["Theory", "Lab", "Project", "Manual"],
    required: true
  },
  hours: {
    type: Number,
    required: true,
    min: 0,  // ← CHANGED FROM 1 TO 0
    max: 24
  },
  weeklyHours: { type: Number }, // Alias for hours
  credit: { type: Number, required: true },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  department: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },

  // Allocation Status
  available: { type: Boolean, default: true },
  allocated: { type: Boolean, default: false },
  allocatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Faculty"
  },

  // Course Details
  courseType: {
    type: String,
    enum: ["Core", "Elective", "Lab", "Project", "Seminar"],
    default: "Core"
  },
  prerequisites: [{ type: String }], // Array of subject codes

  // Academic Year
  academicYear: { type: String }, // e.g., "2024-2025"
  term: {
    type: String,
    enum: ["Odd", "Even", "Summer"]
  },

  // Parallel Subject Grouping
  parallelGroupId: { type: String, trim: true }

}, { timestamps: true });

module.exports = mongoose.model("Subject", subjectSchema);