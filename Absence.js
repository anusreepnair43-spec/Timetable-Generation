const mongoose = require("mongoose");

const absenceSchema = new mongoose.Schema({
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true },
    facultyName: { type: String, required: true },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    subject: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Absence", absenceSchema);
