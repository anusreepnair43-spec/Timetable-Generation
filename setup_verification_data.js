const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Subject = require('./subject');
const Faculty = require('./faculty');
const FacultyAllocation = require('./facultyAllocation');

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/loginapp";

async function setup() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        // Clear existing test data
        await Faculty.deleteMany({ username: "testfaculty" });
        await Subject.deleteMany({ department: "TEST_DEPT" });
        await FacultyAllocation.deleteMany({ facultyUsername: "testfaculty" });

        // 1. Create Test Faculty
        const faculty = await Faculty.create({
            name: "Test Faculty",
            username: "testfaculty",
            email: "test@example.com",
            role: "Assistant Professor",
            department: "TEST_DEPT",
            experience: 5,
            password: "hashedpassword"
        });
        console.log("Faculty created");

        // 2. Create Subjects
        const subjects = [
            { name: "Odd Theory", code: "OT101", type: "Theory", semester: 1, hours: 3, credit: 3, department: "TEST_DEPT" },
            { name: "Odd Lab", code: "OL102", type: "Lab", semester: 3, hours: 2, credit: 1, department: "TEST_DEPT" },
            { name: "Even Theory", code: "ET201", type: "Theory", semester: 2, hours: 4, credit: 4, department: "TEST_DEPT" },
            { name: "Even Project", code: "EP202", type: "Project", semester: 4, hours: 3, credit: 2, department: "TEST_DEPT" }
        ];
        
        const createdSubjects = await Subject.insertMany(subjects);
        console.log("Subjects created");

        // 3. Create Allocations
        const allocations = createdSubjects.map((s, idx) => ({
            facultyId: faculty._id,
            facultyUsername: "testfaculty",
            facultyName: "Test Faculty",
            facultyDesignation: "Assistant Professor",
            facultyExperience: 5,
            department: "TEST_DEPT",
            subjectId: s._id,
            subjectCode: s.code,
            subjectName: s.name,
            subjectType: s.type,
            semester: s.semester,
            weeklyHours: s.hours,
            priority: idx + 1,
            weekNumber: 1,
            academicYear: "2025-2026",
            term: s.semester % 2 !== 0 ? "Odd" : "Even",
            allocatedAt: new Date()
        }));

        await FacultyAllocation.insertMany(allocations);
        console.log("Allocations created");

        console.log("Verification data setup complete!");
        process.exit(0);
    } catch (err) {
        console.error("Setup failed:", err);
        process.exit(1);
    }
}

setup();
