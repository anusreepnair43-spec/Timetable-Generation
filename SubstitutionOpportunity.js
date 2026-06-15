const mongoose = require("mongoose");

const substitutionOpportunitySchema = new mongoose.Schema(
  {
    substitutionKey: { type: String, required: true, unique: true },
    absentFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true },
    assignedFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", default: null },
    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    semester: { type: Number },
    absentFacultyName: { type: String },

    // Deadline + status
    deadline: { type: Date, required: true },
    requestSent: { type: Boolean, default: false },
    status: { type: String, enum: ["pending", "accepted", "expired"], default: "pending" },
    acceptedFacultyName: { type: String, default: "" },
  },
  { timestamps: true, collection: "substitutionOpportunities" }
);

substitutionOpportunitySchema.index({ substitutionKey: 1 }, { unique: true });
substitutionOpportunitySchema.index({ status: 1, deadline: 1 });

module.exports = mongoose.model("SubstitutionOpportunity", substitutionOpportunitySchema);

