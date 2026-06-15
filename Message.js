const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Faculty", 
        required: true 
    },
    receiver: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Faculty", 
        required: true 
    },
    facultyName: { 
        type: String, 
        required: true 
    },
    date: { 
        type: Date, 
        required: true 
    },
    timeSlot: { 
        type: String, 
        required: true 
    },
    subject: { 
        type: String, 
        required: true 
    },
    // Unread badge support (do not break existing fields)
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Faculty"
    },
    isRead: {
        type: Boolean,
        default: false
    },
    // Deadline + single acceptance fields (safe for existing docs)
    deadline: {
        type: Date
    },
    acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Faculty",
        default: null
    },
    acceptedFacultyName: {
        type: String,
        default: ""
    },
    substitutionKey: {
        type: String
    },
    status: { 
        type: String, 
        enum: ["pending", "accepted", "rejected", "expired"], 
        default: "pending" 
    }
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
