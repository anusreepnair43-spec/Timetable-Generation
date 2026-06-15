const mongoose = require('mongoose');
const Subject = require('./subject');
const FacultyAllocation = require('./facultyAllocation');

async function run() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/loginapp');
        const abbreviations = ["AAD", "TCP/IP", "IEFT"];
        const subjects = await Subject.find({ abbreviation: { $in: abbreviations } });
        console.log('Subjects:', JSON.stringify(subjects, null, 2));
        
        const codes = subjects.map(s => s.code);
        const allocations = await FacultyAllocation.find({ subjectCode: { $in: codes } });
        console.log('Allocations:', JSON.stringify(allocations, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
