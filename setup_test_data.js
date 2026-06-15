const mongoose = require("mongoose");
const connectDB = require("./db");
const Faculty = require("./faculty");
const Subject = require("./subject");
const FacultyAllocation = require("./facultyAllocation");
const Admin = require("./user");

async function inject() {
    await connectDB();

    try {
        // Ensure an Admin exists
        let admin = await Admin.findOne({ email: "admin@test.com" });
        if (!admin) {
            admin = new Admin({ name: "Admin", email: "admin@test.com", password: "admin", role: "admin" });
            await admin.save();
        }

        // Create a Faculty
        let faculty = await Faculty.findOne({ email: "faculty1@test.com" });
        if (!faculty) {
            faculty = new Faculty({
                name: "Dr. Smith",
                username: "faculty1@test.com",
                email: "faculty1@test.com",
                password: "password123",
                role: "Assistant Professor",
                department: "CSE",
                approved: true,
                canTakeBackToBack: true,
                experience: 5
            });
            await faculty.save();
        }

        // Create a Subject
        let subject = await Subject.findOne({ code: "CS101" });
        if (!subject) {
            subject = new Subject({
                name: "Computer Science 101",
                code: "CS101",
                abbreviation: "CS101",
                semester: 1,
                credit: 3,
                weeklyHours: 3,
                hours: 3,
                type: "Theory"
            });
            await subject.save();
        }

        // Create Allocation
        await FacultyAllocation.deleteMany({});
        const alloc = new FacultyAllocation({
            facultyId: faculty._id,
            facultyName: faculty.name,
            facultyUsername: faculty.username,
            facultyDesignation: faculty.role,
            facultyExperience: faculty.experience,
            department: faculty.department,
            adminId: admin._id,
            subjectId: subject._id,
            subjectName: subject.name,
            subjectCode: subject.code,
            subjectType: subject.type,
            weeklyHours: subject.weeklyHours,
            semester: subject.semester,
            academicYear: "2025",
            term: "Odd",
            priority: 1,
            isActive: true
        });
        await alloc.save();

        console.log("✅ Test data injected successfully.");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

inject();
