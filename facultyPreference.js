const mongoose = require("mongoose");

/* ===== COMMON SUBJECT PREF SCHEMA ===== */
const subjectPreferenceSchema = new mongoose.Schema({
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true
  },
  subjectName: String,
  code: String,
  abbreviation: String,
  semester: Number,
  credit: Number,

  priority: {
    type: Number,
    required: true,
    min: 1
  }
});

/* ===== MAIN FACULTY PREF ===== */
const facultyPreferenceSchema = new mongoose.Schema(
  {
    facultyUsername: {
      type: String,
      required: true,
      unique: true
    },

    /* THEORY SUBJECTS */
    theoryPreferences: {
      type: [subjectPreferenceSchema],
      default: []
    },

    /* LAB SUBJECTS */
    labPreferences: {
      type: [subjectPreferenceSchema],
      default: []
    },

    final: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "FacultyPreference",
  facultyPreferenceSchema
);
