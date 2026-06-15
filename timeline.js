const mongoose = require("mongoose");

const TimelineSchema = new mongoose.Schema({
  rules: {
    type: Map,
    of: [{ start: String, end: String }],
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model("Timeline", TimelineSchema);
