const mongoose = require("mongoose");

const workloadConfigSchema = new mongoose.Schema({
  designation: { type: String, unique: true },
  weeklyHours: Number,
  minTheory: Number,
  minLab: Number
});

module.exports = mongoose.model("WorkloadConfig", workloadConfigSchema);
