const http = require('http');

// This test simulates a scenario where a subject has 6 hours of Lab.
// We want to ensure the generator doesn't put more than 3 SLOTS on the same day.

const payload = JSON.stringify({
  academicYear: "2026-2027",
  term: "Even",
  semester: 4,
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

console.log("Testing Lab Hour Limit (6h total, max 3 UNIQUE SLOTS per day)...");

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (data.success) {
        console.log("✅ Generation successful!");
        
        // Group slots by subject and day
        const subjectDayUsage = {}; // key: "subjectCode_day", value: Set of times

        data.slots.forEach(slot => {
          if (slot.entries) {
            slot.entries.forEach(entry => {
              if (entry.subjectType === "Lab") {
                const key = `${entry.subjectCode}_${slot.day}`;
                if (!subjectDayUsage[key]) subjectDayUsage[key] = new Set();
                subjectDayUsage[key].add(slot.time);
              }
            });
          }
        });

        let failures = 0;
        for (const key in subjectDayUsage) {
          const count = subjectDayUsage[key].size;
          if (count > 3) {
            console.log(`❌ FAILURE: Subject/Day ${key} has ${count} unique slots!`);
            failures++;
          } else {
             console.log(`[PASS] ${key}: ${count} slots`);
          }
        }

        if (failures === 0) {
          console.log("✅ SUCCESS: No lab subject exceeds 3 unique slots per day.");
        } else {
          console.log(`❌ FAILURE: ${failures} instances of lab overcrowding found.`);
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
