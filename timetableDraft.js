const mongoose = require("mongoose");

const TimetableDraftSchema = new mongoose.Schema({
    draftName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    days: {
        type: Number,
        required: true,
        min: 1,
        max: 7
    },
    periodsPerDay: {
        type: Number,
        required: true,
        min: 1
    },
    slots: [{
        day: { type: String, required: true },
        period: { type: Number, required: true },
        startTime: { type: String, required: true }, // Format: "HH:mm"
        endTime: { type: String, required: true }    // Format: "HH:mm"
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    manualEntries: [{
        subjectName: { type: String, required: true },
        facultyName: { type: String },
        facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
        subjectType: { type: String, enum: ["Theory", "Lab", "Project"] },
        weeklyHours: { type: Number },
        parallelGroupId: { type: String, trim: true },
        slots: [{
            day: { type: String, required: true },
            time: { type: String, required: true }
        }]
    }]
}, { timestamps: true });

module.exports = mongoose.model("TimetableDraft", TimetableDraftSchema);
