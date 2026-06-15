const http = require('http');

const payload = JSON.stringify({
  academicYear: "2026-2027",
  term: "Even",
  semester: 6, // Target: S6
  lockedSlots: [
    {
      day: "Monday",
      time: "09:00 AM - 09:50 AM",
      locked: true,
      semester: 4, // Stale S4 data!
      entries: [{ subjectName: "STALE S4 SUBJECT", subjectCode: "S4TEST", facultyName: "Test" }]
    }
  ]
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/timetable/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
};

console.log("Testing generation for S6 with stale S4 locked slots...");

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (data.success) {
        console.log("✅ Generation successful!");
        const staleFound = data.slots.filter(s => 
          s.entries && s.entries.some(e => e.subjectName === "STALE S4 SUBJECT")
        );
        
        if (staleFound.length === 0) {
          console.log("✅ SUCCESS: Stale S4 entries were correctly filtered out.");
        } else {
          console.log("❌ FAILURE: Stale S4 entries were INJECTED into S6!");
        }
      } else {
        console.error("❌ Generation failed:", data.message);
      }
    } catch (e) {
      console.error("❌ Failed to parse response:", e.message);
    }
  });
});

req.on('error', (e) => {
  console.error("❌ Request error:", e.message);
});

req.write(payload);
req.end();
