const mongoose = require("mongoose");

const manualEntrySchema = new mongoose.Schema({
  academicYear: { type: String, required: true },

  semesterType: {
    type: String,
    enum: ["ODD", "EVEN"],
    required: true
  },

  semester: {
    type: String,
    required: true
  },

  subjectName: { type: String, required: true },
  subjectCode: { type: String, required: true },
  facultyName: { type: String, required: true },
  weeklyHours: { type: Number, required: true },

  preferredSlots: [{
    day: { type: String, required: true },
    period: { type: Number, required: true }
  }]

}, { timestamps: true });


// ✅ Dynamic Semester Validation
manualEntrySchema.path('semester').validate(function (value) {
  const oddSemesters = ["S1", "S3", "S5", "S7"];
  const evenSemesters = ["S2", "S4", "S6", "S8"];

  if (this.semesterType === "ODD") {
    return oddSemesters.includes(value);
  }

  if (this.semesterType === "EVEN") {
    return evenSemesters.includes(value);
  }

  return false;
}, 'Semester does not match semesterType');


// ✅ preferredSlots validation
manualEntrySchema.path('preferredSlots').validate(function (value) {
  return value && value.length > 0;
}, 'preferredSlots cannot be empty');

module.exports = mongoose.model("ManualEntry", manualEntrySchema);