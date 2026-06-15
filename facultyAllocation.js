const mongoose = require("mongoose");

const FacultyAllocationSchema = new mongoose.Schema({
  // Faculty Reference
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Faculty",
    required: true
  },
  facultyUsername: { type: String, required: true },
  facultyName: { type: String, required: true },
  facultyDesignation: {
    type: String,
    enum: ["Professor", "Associate Professor", "Assistant Professor"],
    required: true
  },
  facultyExperience: { type: Number, required: true },
  department: { type: String, required: true },

  // Subject Details
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true
  },
  subjectCode: { type: String, required: true },
  subjectName: { type: String, required: true },
  subjectType: {
    type: String,
    enum: ["Theory", "Lab", "Project"],
    required: true
  },
  subjectAbbreviation: { type: String },

  // Allocation Details
  weeklyHours: {
    type: Number,
    required: true,
    min: 1,
    max: 24
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  priority: {
    type: Number,
    required: true,
    min: 1,
    max: 25
  },

  // Allocation Status
  allocationType: {
    type: String,
    enum: ["Initial", "Reallocation", "Manual", "Automatic", "Complete", "Alternating"],
    default: "Automatic"
  },
  allocationStrategy: {
    type: String,
    default: ""
  },
  weekNumber: {
    type: Number,
    required: true,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Academic Year/Term
  academicYear: { type: String, required: true },
  term: {
    type: String,
    enum: ["Odd", "Even", "Summer"],
    required: true
  },

  // Parallel Subject Grouping
  parallelGroupId: { type: String, trim: true },

  // Audit Fields
  allocatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  allocationDate: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true,
  indexes: [
    { facultyId: 1, subjectId: 1 },
    { facultyId: 1, semester: 1 },
    { subjectCode: 1, semester: 1 },
    { academicYear: 1, term: 1 }
  ]
});

// Compound unique constraint - prevent duplicate allocations
FacultyAllocationSchema.index(
  { facultyId: 1, subjectId: 1, academicYear: 1, term: 1 },
  { unique: true }
);

// Virtual for allocation status
FacultyAllocationSchema.virtual("allocationStatus").get(function () {
  if (!this.isActive) return "Inactive";
  return "Active";
});

// Pre-save hook to validate hours - UPDATED WITH HIGHER LIMITS
FacultyAllocationSchema.pre("save", async function (next) {
  // Validate weekly hours based on subject type - INCREASED LIMITS
  if (this.subjectType === "Theory" && this.weeklyHours > 12) {
    throw new Error("Theory subjects cannot exceed 12 hours per week");
  }

  if (this.subjectType === "Lab" && this.weeklyHours > 12) {
    throw new Error("Lab subjects cannot exceed 12 hours per week");
  }

  if (this.subjectType === "Project" && this.weeklyHours > 12) {
    throw new Error("Project subjects cannot exceed 12 hours per week");
  }

  // Validate priority range - UPDATED TO 25
  if (this.priority < 1 || this.priority > 25) {
    throw new Error("Priority must be between 1 and 25");
  }

  // Validate semester range
  if (this.semester < 1 || this.semester > 8) {
    throw new Error("Semester must be between 1 and 8");
  }

  if (typeof next === 'function') next();
});

// Static method to check if faculty is overloaded
FacultyAllocationSchema.statics.isFacultyOverloaded = async function (facultyId, academicYear, term, maxHours) {
  const allocations = await this.find({
    facultyId,
    academicYear,
    term,
    isActive: true
  });

  const totalHours = allocations.reduce((sum, alloc) => sum + alloc.weeklyHours, 0);
  return totalHours > maxHours;
};

// Static method to get faculty workload summary
FacultyAllocationSchema.statics.getFacultyWorkload = async function (facultyId, academicYear, term) {
  const allocations = await this.find({
    facultyId,
    academicYear,
    term,
    isActive: true
  });

  const totalHours = allocations.reduce((sum, alloc) => sum + alloc.weeklyHours, 0);
  const theoryCount = allocations.filter(a => a.subjectType === "Theory").length;
  const labCount = allocations.filter(a => a.subjectType === "Lab").length;
  const projectCount = allocations.filter(a => a.subjectType === "Project").length;

  return {
    totalHours,
    theoryCount,
    labCount,
    projectCount,
    totalSubjects: allocations.length,
    allocations: allocations.map(a => ({
      subjectCode: a.subjectCode,
      subjectName: a.subjectName,
      subjectType: a.subjectType,
      weeklyHours: a.weeklyHours,
      semester: a.semester
    }))
  };
};

// Instance method to check allocation status
FacultyAllocationSchema.methods.getAllocationDetails = function () {
  return {
    facultyName: this.facultyName,
    designation: this.facultyDesignation,
    subjectCode: this.subjectCode,
    subjectName: this.subjectName,
    subjectType: this.subjectType,
    weeklyHours: this.weeklyHours,
    semester: this.semester,
    allocationType: this.allocationType,
    allocationStrategy: this.allocationStrategy,
    academicYear: this.academicYear,
    term: this.term,
    allocationDate: this.allocationDate,
    isActive: this.isActive
  };
};

module.exports = mongoose.model("FacultyAllocation", FacultyAllocationSchema);