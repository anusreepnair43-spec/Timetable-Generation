const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema({
  day: { type: String, required: true },
  time: { type: String, required: true },
  entries: [{
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
    subjectName: { type: String },
    facultyName: { type: String },
    subjectCode: { type: String },
    subjectAbbreviation: { type: String },
    subjectType: { 
      type: String, 
      enum: ["Theory", "Lab", "Manual", "Project"], 
      default: "Theory" 
    }
  }],
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  roomName: { type: String },
  locked: { type: Boolean, default: false },
  state: { 
    type: String, 
    enum: ["AVAILABLE", "LOCKED_INTERNAL", "LOCKED_EXTERNAL", "BLOCKED"], 
    default: "AVAILABLE" 
  }
});

const timetableSchema = new mongoose.Schema({
  name: { type: String, required: true },
  academicYear: { type: String, required: true },
  term: { type: String, enum: ["Odd", "Even", "Summer"], required: true },
  semester: { type: Number, required: true },
  isDraft: { type: Boolean, default: true },
  slots: [slotSchema]
}, { timestamps: true });

// prevent duplicate finals for same semester/year/term
timetableSchema.index({ academicYear: 1, term: 1, semester: 1, isDraft: 1 }, { unique: true, partialFilterExpression: { isDraft: false } });

module.exports = mongoose.model("Timetable", timetableSchema);
