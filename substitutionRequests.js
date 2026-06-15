const mongoose = require("mongoose");

const substitutionRequestsSchema = new mongoose.Schema(
  {
    toFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true },
    fromFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    // Optional metadata (added later; safe for existing records)
    semester: { type: Number },
    absentFacultyName: { type: String },
    // Opportunity linkage + acceptance summary (safe for existing records)
    opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: "SubstitutionOpportunity" },
    substitutionKey: { type: String },
    deadline: { type: Date },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", default: null },
    acceptedFacultyName: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending"
    },
    deadlineAt: { type: Date }
  },
  { timestamps: true, collection: "substitutionRequests" }
);

substitutionRequestsSchema.index({ toFacultyId: 1, status: 1, createdAt: -1 });
substitutionRequestsSchema.index({ fromFacultyId: 1, date: 1 });
substitutionRequestsSchema.index({ status: 1, deadlineAt: 1 });

module.exports = mongoose.model("SubstitutionRequests", substitutionRequestsSchema);

