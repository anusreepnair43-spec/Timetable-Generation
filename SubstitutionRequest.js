const mongoose = require("mongoose");

/**
 * SubstitutionRequest schema
 *
 * Maps 1-to-1 with the substitution_requests SQL table:
 *   id                  → _id  (auto ObjectId)
 *   absent_faculty_id   → absentFacultyId
 *   date                → date
 *   period              → period  (e.g. '9:00 AM - 10:00 AM')
 *   requested_faculty_id→ requestedFacultyId
 *   deadline            → deadline
 *   status              → status  ('pending' | 'accepted' | 'declined' | 'expired')
 *
 * Extra helper fields kept for email / display purposes:
 *   absentFacultyName, requestedFacultyName, subject, respondedAt
 */
const substitutionRequestSchema = new mongoose.Schema(
    {
        // --- core fields (match SQL table exactly) ---
        absentFacultyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Faculty",
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        period: {
            type: String,
            required: true, // e.g. '9:00 AM - 10:00 AM'
        },
        requestedFacultyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Faculty",
            required: true,
        },
        deadline: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "declined", "expired"],
            default: "pending",
        },

        // --- helper fields (display / email) ---
        absentFacultyName: { type: String },
        requestedFacultyName: { type: String },
        subject: { type: String },
        respondedAt: { type: Date },
    },
    { timestamps: true } // adds createdAt & updatedAt automatically
);

// ── Indexes (mirror the SQL indexes) ──────────────────────────────────────────
substitutionRequestSchema.index({ absentFacultyId: 1, date: 1 });
substitutionRequestSchema.index({ requestedFacultyId: 1, status: 1 });
substitutionRequestSchema.index({ deadline: 1 });

module.exports = mongoose.model("SubstitutionRequest", substitutionRequestSchema);
