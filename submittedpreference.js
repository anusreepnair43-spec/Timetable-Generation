const mongoose = require("mongoose");

const subjectPrefSchema = new mongoose.Schema({
  subjectId: mongoose.Schema.Types.ObjectId,
  subjectName: String,
  code: String,
  abbreviation: String,
  semester: Number,
  credit: Number,
  priority: Number
});

const submittedPreferenceSchema = new mongoose.Schema({
  facultyUsername: { type: String, required: true, unique: true },
  name: String,
  designation: String,
  experience: Number,

  theoryPreferences: {
    type: [subjectPrefSchema],
    default: []
  },

  labPreferences: {
    type: [subjectPrefSchema],
    default: []
  },

  final: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model(
  "SubmittedPreference",
  submittedPreferenceSchema,
  "submittedpreferences"
);
