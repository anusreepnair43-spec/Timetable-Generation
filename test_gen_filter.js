const http = require('http');

const payload = JSON.stringify({
  academicYear: "2026-2027",
  term: "Even",
  semester: 6, // Try S6
  lockedSlots: []
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

console.log("Testing generation for S6 (Even)...");

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (data.success) {
        console.log("✅ Generation successful!");
        const manualInS6 = data.slots.filter(s => s.entries && s.entries.some(e => e.isManual));
        console.log(`Manual entries found in S6: ${manualInS6.length}`);
        
        manualInS6.forEach(s => {
          console.log(` - ${s.day} ${s.time}: ${s.entries[0].subjectName}`);
        });

        if (manualInS6.length === 0) {
          console.log("✅ SUCCESS: No S4 entries leaked into S6.");
        } else {
          console.log("❌ FAILURE: Manual entries found in S6!");
        }
      } else {
        console.error("❌ Generation failed:", data.message);
      }
    } catch (e) {
      console.error("❌ Failed to parse response:", e.message);
      console.log("Raw response:", body);
    }
  });
});

req.on('error', (e) => {
  console.error("❌ Request error:", e.message);
  console.log("Note: Make sure the server is running on localhost:3000!");
});

req.write(payload);
req.end();
