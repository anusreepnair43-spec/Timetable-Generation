const mongoose = require('mongoose');
const Timetable = require('./Timetable');

async function introspect() {
    try {
        console.log("Introspecting Timetable model schema...");
        
        const schema = Timetable.schema;
        const entriesPath = schema.path('slots').schema.path('entries').schema.path('subjectType');
        
        console.log("Path: slots.entries.subjectType");
        console.log("Enum values:", entriesPath.enumValues);
        console.log("Full options:", entriesPath.options);
        
        process.exit(0);
    } catch (err) {
        console.error("Introspection failed:", err);
        process.exit(1);
    }
}

introspect();
