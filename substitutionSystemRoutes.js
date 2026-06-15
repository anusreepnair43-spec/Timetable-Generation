const express = require("express");
const mongoose = require("mongoose");

const Faculty = require("./faculty");
const Settings = require("./settings");
const Timetable = require("./Timetable");
const Absence = require("./Absence");
const SubstitutionRequests = require("./substitutionRequests");
const Message = require("./Message");
const SubstitutionOpportunity = require("./SubstitutionOpportunity");
const { getMailer } = require("./mailer");
const Student = require("./student");

async function notifyStudentsOnSubstitution(opp, substituteName) {
  try {
    if (!opp || opp.semester == null || opp.semester === "") {
      console.log("No semester mapped for this substitution. Skipping student email notification.");
      return;
    }
    
    // Fetch students for this semester
    const students = await Student.find({ semester: opp.semester }).select("email name").lean();
    
    if (!students || students.length === 0) {
      console.log(`No students found for semester ${opp.semester}. Skipping email.`);
      return;
    }
    
    const transporter = getMailer();
    const prettyDate = new Date(opp.date).toDateString();
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 6px;">
        <h2 style="color:#1e3a8a; margin-top:0;">Class Update Notification</h2>
        <p>Dear Student,</p>
        <p>The class scheduled on <strong>${prettyDate}</strong> at <strong>${opp.timeSlot}</strong>
        handled by <strong>${opp.absentFacultyName || "your faculty"}</strong> will now be taken by <strong>${substituteName}</strong>.</p>
        <p style="margin-top:14px;">Regards,<br>Admin</p>
      </div>
    `;

    // Process in batches
    const batchSize = 50;
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);
      await Promise.all(batch.map(student => {
        if (!student.email) return Promise.resolve();
        return transporter.sendMail({
          from: `"Smart Timetable System" <${process.env.EMAIL_USER}>`,
          to: student.email,
          subject: "Class Update Notification",
          html: emailHtml
        }).catch(err => console.error("Student substitution email send error for", student.email, err.message));
      }));
    }
    console.log(`Successfully notified ${students.length} students for semester ${opp.semester}`);
  } catch (err) {
    console.error("Error in automated student notification:", err);
  }
}

const NON_TEST_FACULTY_FILTER = {
  name: { $not: /test|dummy/i },
  email: { $not: /test|dummy/i },
  isTest: { $ne: true }
};

function parseDateOnly(dateStr) {
  const [yyyy, mm, dd] = (dateStr || "").split("-").map(Number);
  if (!yyyy || !mm || !dd) return null;
  return new Date(yyyy, mm - 1, dd);
}

async function getDeadlineMsFromSettings() {
  const s = await Settings.findOne({ key: "substitution_response_deadline_ms" }).lean();
  const v = s?.value;
  const ms = typeof v === "number" ? v : Number(v);
  if (!ms || ms <= 0) return 0;
  return ms;
}

async function expirePendingRequests() {
  const now = new Date();
  await SubstitutionRequests.updateMany(
    { status: "pending", deadlineAt: { $exists: true, $lt: now } },
    { $set: { status: "expired" } }
  );
}

module.exports = function buildSubstitutionSystemRoutes({ getFreeFaculty }) {
  const router = express.Router();

  // GET /get-free-faculty?date=YYYY-MM-DD&timeSlot=...&facultyId=...
  router.get("/get-free-faculty", async (req, res) => {
    try {
      const { date, facultyId } = req.query;
      const timeSlotParam = req.query.timeSlot;
      const selectedSlots = Array.isArray(timeSlotParam) ? timeSlotParam : [timeSlotParam];

      if (!date || !selectedSlots || selectedSlots.length === 0 || !selectedSlots[0]) {
        return res.status(400).json({ success: false, message: "date and timeSlot are required" });
      }
      if (!facultyId) {
        return res.status(400).json({ success: false, message: "facultyId is required" });
      }

      console.log("Selected Slots:", selectedSlots);

      const isUnknown = (v) => {
        if (v == null) return true;
        const s = String(v).trim().toLowerCase();
        return !s || s === "unknown" || s === "not assigned";
      };

      const extractRange = (s) => {
        if (!s) return "";
        const str = String(s).trim();
        const m = str.match(/\(([^)]+)\)/);
        if (m && m[1]) return m[1].trim();
        return str;
      };

      const timeToMinutes = (timeStr) => {
        if (!timeStr) return null;
        const s = String(timeStr).trim();
        const match = s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
        if (!match) return null;
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2] || "0", 10);
        const ampm = (match[3] || "").toUpperCase();
        if (ampm) {
          if (ampm === "PM" && h !== 12) h += 12;
          if (ampm === "AM" && h === 12) h = 0;
        } else {
          if (h >= 1 && h <= 7) h += 12;
        }
        return h * 60 + m;
      };

      const rangeToMinutes = (rangeStr) => {
        const r = extractRange(rangeStr);
        const parts = r.split(/\s*-\s*/);
        if (parts.length !== 2) return null;
        const start = timeToMinutes(parts[0]);
        const end = timeToMinutes(parts[1]);
        if (start == null || end == null) return null;
        return { start, end };
      };

      const overlaps = (a, b) => a && b && a.start < b.end && a.end > b.start;

      const dateObj = parseDateOnly(date);
      if (!dateObj) return res.status(400).json({ success: false, message: "Invalid date format (use YYYY-MM-DD)" });

      const day = dateObj.toLocaleString("en-US", { weekday: "long" });
      console.log("Day:", day);

      const absentFacultyId = String(facultyId).trim();
      const absentFacultyObjectId = mongoose.Types.ObjectId.isValid(absentFacultyId)
        ? new mongoose.Types.ObjectId(absentFacultyId)
        : null;
      if (!absentFacultyObjectId) return res.status(400).json({ success: false, message: "Invalid facultyId" });

      const recentTimetables = await Timetable.find()
        .sort({ updatedAt: -1 })
        .select("semester slots.day slots.time slots.entries.facultyId slots.entries.subjectName slots.entries.subjectCode")
        .limit(50)
        .lean();

      // Optional: if any selected slot is unknown, derive from Absence for this day (use its timeSlots array)
      const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      const absenceDoc = await Absence.findOne({
        facultyId: absentFacultyObjectId,
        date: { $gte: startOfDay, $lte: endOfDay }
      }).sort({ createdAt: -1 }).lean();

      const normalizedSelectedSlots = selectedSlots.flatMap(s => {
        if (!isUnknown(s)) return [String(s)];
        const slots = [];
        if (absenceDoc?.timeSlot) slots.push(String(absenceDoc.timeSlot));
        if (Array.isArray(absenceDoc?.timeSlots)) {
          absenceDoc.timeSlots.forEach(x => x && slots.push(String(x)));
        }
        return slots.length > 0 ? slots : [String(s)];
      }).filter(Boolean);

      console.log("Selected Slots:", normalizedSelectedSlots);

      // Helper: resolve semester for a slot from faculty timetable
      const resolveSemesterForSlot = (slotStr) => {
        const targetRange = rangeToMinutes(slotStr);
        for (const tt of (recentTimetables || [])) {
          for (const slot of (tt.slots || [])) {
            if (!slot || slot.day !== day) continue;
            const slotRange = rangeToMinutes(slot.time);
            const timeMatches = (targetRange && slotRange)
              ? overlaps(targetRange, slotRange)
              : (String(slot.time || "") === String(slotStr));
            if (!timeMatches) continue;
            const hit = (slot.entries || []).find(e => (e?.facultyId ? e.facultyId.toString() : "") === absentFacultyId);
            if (!hit) continue;
            return tt.semester;
          }
        }
        return null;
      };

      // Resolve semesters per slot (no DB calls)
      const slotToSemester = {};
      normalizedSelectedSlots.forEach(s => {
        console.log("Processing Slot:", s);
        const sem = resolveSemesterForSlot(s);
        slotToSemester[s] = sem;
        console.log("Semester:", sem);
      });

      // Collect unique semesters to fetch admin drafts in one query
      const semesters = Array.from(new Set(Object.values(slotToSemester).filter(v => v != null)));
      if (semesters.length === 0) {
        // none of the selected slots had a class
        const slotWiseFreeFaculties = {};
        const slotWiseMessages = {};
        normalizedSelectedSlots.forEach(s => {
          slotWiseFreeFaculties[s] = [];
          slotWiseMessages[s] = "No class scheduled at this slot";
        });
        return res.json({ success: true, slotWiseFreeFaculties, slotWiseMessages });
      }

      const drafts = await Timetable.find({ isDraft: true, semester: { $in: semesters } })
        .sort({ updatedAt: -1 })
        .select("semester slots.day slots.time slots.entries.facultyId")
        .lean();

      // Pick latest draft per semester
      const semToDraft = new Map();
      (drafts || []).forEach(d => {
        if (!semToDraft.has(d.semester)) semToDraft.set(d.semester, d);
      });

      // Compute slot-wise free ids
      const slotWiseFreeIds = {};
      const slotWiseMessages = {};
      const unionFreeIds = new Set();

      for (const slotStr of normalizedSelectedSlots) {
        const sem = slotToSemester[slotStr];
        if (!sem) {
          slotWiseFreeIds[slotStr] = [];
          slotWiseMessages[slotStr] = "No class scheduled at this slot";
          continue;
        }

        const adminDraft = semToDraft.get(sem);
        if (!adminDraft) {
          slotWiseFreeIds[slotStr] = [];
          slotWiseMessages[slotStr] = "No faculty assigned for this semester";
          continue;
        }

        const teachingSet = new Set();
        (adminDraft.slots || []).forEach(s => (s.entries || []).forEach(e => e?.facultyId && teachingSet.add(e.facultyId.toString())));
        teachingSet.delete(absentFacultyId);
        const facultyList = Array.from(teachingSet);
        console.log("All Faculty:", facultyList);

        if (facultyList.length === 0) {
          slotWiseFreeIds[slotStr] = [];
          slotWiseMessages[slotStr] = "No faculty assigned for this semester";
          continue;
        }

        const targetRange = rangeToMinutes(slotStr);
        const busySet = new Set();
        (adminDraft.slots || []).forEach(s => {
          if (!s || s.day !== day) return;
          const sRange = rangeToMinutes(s.time);
          const timeMatches = (targetRange && sRange)
            ? overlaps(targetRange, sRange)
            : (String(s.time || "") === String(slotStr));
          if (!timeMatches) return;
          (s.entries || []).forEach(e => {
            const id = e?.facultyId ? e.facultyId.toString() : "";
            if (id && teachingSet.has(id)) busySet.add(id);
          });
        });

        const busyList = Array.from(busySet);
        console.log("Busy:", busyList);

        const freeList = facultyList.filter(id => !busySet.has(id));
        console.log("Free:", freeList);

        if (freeList.length === 0) {
          slotWiseFreeIds[slotStr] = [];
          slotWiseMessages[slotStr] = "All busy for this slot";
          continue;
        }

        slotWiseFreeIds[slotStr] = freeList;
        slotWiseMessages[slotStr] = "";
        freeList.forEach(id => unionFreeIds.add(id));
      }

      // Fetch SubstitutionOpportunities for these slots to check if requests were already sent
      const ymd = dateObj.toISOString().slice(0, 10);
      const slotKeys = normalizedSelectedSlots.map(s => `${absentFacultyId}|${ymd}|${String(s)}`);
      const opps = await SubstitutionOpportunity.find({ substitutionKey: { $in: slotKeys } }).lean();
      const keyToOpp = new Map((opps || []).map(o => [o.substitutionKey, o]));

      // Fetch faculty docs once
      const facultyDocs = await Faculty.find({ _id: { $in: Array.from(unionFreeIds) }, ...NON_TEST_FACULTY_FILTER })
        .select("username name email department")
        .lean();
      const idToFaculty = new Map((facultyDocs || []).map(f => [f._id.toString(), f]));

      const slotWiseFreeFaculties = {};
      const slotWiseRequestSent = {};
      Object.keys(slotWiseFreeIds).forEach(slotStr => {
        const key = `${absentFacultyId}|${ymd}|${String(slotStr)}`;
        const opp = keyToOpp.get(key);
        slotWiseRequestSent[slotStr] = opp ? opp.requestSent : false;

        slotWiseFreeFaculties[slotStr] = (slotWiseFreeIds[slotStr] || [])
          .map(id => idToFaculty.get(String(id)))
          .filter(Boolean)
          .map(f => ({
            _id: f._id,
            facultyId: f.username,
            name: f.name,
            email: f.email,
            department: f.department
          }));
      });

      // Backward compatibility: if only one slot, also return freeFaculties like before
      if (normalizedSelectedSlots.length === 1) {
        const only = normalizedSelectedSlots[0];
        return res.json({
          success: true,
          freeFaculties: slotWiseFreeFaculties[only] || [],
          message: slotWiseMessages[only] || "",
          requestSent: slotWiseRequestSent[only] || false,
          slotWiseFreeFaculties,
          slotWiseMessages,
          slotWiseRequestSent,
          slotWiseSemesters: slotToSemester
        });
      }

      return res.json({
        success: true,
        slotWiseFreeFaculties,
        slotWiseMessages,
        slotWiseRequestSent,
        slotWiseSemesters: slotToSemester
      });
    } catch (err) {
      console.error("Error in /free-faculty:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  router.post("/set-deadline", async (req, res) => {
    try {
      const { value, unit } = req.body || {};
      const num = Number(value);
      if (!num || num <= 0) return res.status(400).json({ success: false, message: "value must be a positive number" });

      const u = String(unit || "").toLowerCase();
      let ms = 0;
      if (u === "minutes" || u === "minute" || u === "min" || u === "mins") ms = num * 60 * 1000;
      else if (u === "hours" || u === "hour" || u === "hr" || u === "hrs") ms = num * 60 * 60 * 1000;
      else return res.status(400).json({ success: false, message: "unit must be minutes or hours" });

      await Settings.findOneAndUpdate(
        { key: "substitution_response_deadline_ms" },
        { $set: { key: "substitution_response_deadline_ms", value: ms } },
        { upsert: true, new: true }
      );

      return res.json({ success: true, message: "Deadline saved", deadlineMs: ms });
    } catch (err) {
      console.error("Error in /set-deadline:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  router.post("/send-substitution-request", async (req, res) => {
    try {
      const { toFacultyId, facultyIds, fromFacultyId, date, timeSlot, semester, absentFacultyName, deadline: deadlineFromAdmin } = req.body || {};
      const targets = Array.isArray(facultyIds) ? facultyIds : (toFacultyId ? [toFacultyId] : []);
      if (!fromFacultyId || !date || !timeSlot || targets.length === 0) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const dateObj = parseDateOnly(date);
      if (!dateObj) return res.status(400).json({ success: false, message: "Invalid date format (use YYYY-MM-DD)" });

      // Admin-set deadline has priority; else fall back to saved setting
      let deadline = null;
      if (deadlineFromAdmin) {
        const d = new Date(deadlineFromAdmin);
        if (isNaN(d.getTime())) return res.status(400).json({ success: false, message: "Invalid deadline" });
        if (d.getTime() <= Date.now()) return res.status(400).json({ success: false, message: "Deadline must be in the future" });
        deadline = d;
      } else {
        const deadlineMs = await getDeadlineMsFromSettings();
        deadline = deadlineMs ? new Date(Date.now() + deadlineMs) : new Date(Date.now() + 60 * 60 * 1000);
      }

      // Create/Upsert single opportunity for atomic acceptance
      const ymd = dateObj.toISOString().slice(0, 10);
      const substitutionKey = `${String(fromFacultyId)}|${ymd}|${String(timeSlot)}`;

      // Check if already sent
      const existingOpp = await SubstitutionOpportunity.findOne({ substitutionKey }).lean();
      if (existingOpp && existingOpp.requestSent) {
        return res.status(400).json({ success: false, message: "Request already sent for this slot" });
      }

      const opportunity = await SubstitutionOpportunity.findOneAndUpdate(
        { substitutionKey },
        {
          $setOnInsert: {
            substitutionKey,
            absentFacultyId: fromFacultyId,
            assignedFacultyId: null,
            date: ymd,
            timeSlot,
            semester: (semester != null && semester !== "") ? Number(semester) : undefined,
            absentFacultyName: absentFacultyName || undefined,
            status: "pending",
            acceptedFacultyName: ""
          },
          $set: { deadline, requestSent: true } // always refresh deadline if admin re-sends, and mark as sent
        },
        { upsert: true, new: true }
      );

      // Prevent duplicate pending requests for these targets
      const existing = await SubstitutionRequests.find({
        toFacultyId: { $in: targets },
        fromFacultyId,
        date: dateObj,
        timeSlot,
        status: "pending"
      }).select("toFacultyId").lean();
      const existingSet = new Set((existing || []).map(e => e?.toFacultyId?.toString()).filter(Boolean));

      const toInsert = targets
        .map(id => String(id).trim())
        .filter(Boolean)
        .filter(id => !existingSet.has(id))
        .map(id => ({
          toFacultyId: id,
          fromFacultyId,
          date: dateObj,
          timeSlot,
          semester: (semester != null && semester !== "") ? Number(semester) : undefined,
          absentFacultyName: absentFacultyName || undefined,
          status: "pending",
          opportunityId: opportunity?._id,
          substitutionKey,
          deadline,
          acceptedBy: null,
          acceptedFacultyName: "",
          deadlineAt: deadline
        }));

      let created = [];
      if (toInsert.length > 0) {
        created = await SubstitutionRequests.insertMany(toInsert, { ordered: false });
      }

      // Backfill/link any existing pending requests (older rows) to this opportunity + deadline
      await SubstitutionRequests.updateMany(
        {
          toFacultyId: { $in: targets },
          fromFacultyId,
          date: dateObj,
          timeSlot,
          status: "pending",
          $or: [{ opportunityId: { $exists: false } }, { opportunityId: null }]
        },
        {
          $set: {
            opportunityId: opportunity?._id,
            substitutionKey,
            deadline,
            semester: (semester != null && semester !== "") ? Number(semester) : undefined,
            absentFacultyName: absentFacultyName || undefined
          }
        }
      );

      // Create Message records for unread badge + dashboard (isRead=false)
      // Keep required Message fields satisfied (subject required in schema).
      try {
        const msgDocs = targets.map(id => ({
          sender: fromFacultyId,
          receiver: id,
          recipientId: id,
          facultyName: absentFacultyName || "Faculty",
          date: dateObj,
          timeSlot,
          subject: `Substitution Request${(semester != null && semester !== "") ? ` (Semester ${semester})` : ""}`,
          status: "pending",
          deadline,
          acceptedBy: null,
          acceptedFacultyName: "",
          substitutionKey,
          isRead: false
        }));
        await Message.insertMany(msgDocs, { ordered: false });
      } catch (msgErr) {
        console.error("Substitution message create error:", msgErr);
      }

      // Send emails (skip missing emails)
      const facultyDocs = await Faculty.find({ _id: { $in: targets }, ...NON_TEST_FACULTY_FILTER }).select("email name").lean();
      const transporter = getMailer();
      const deadlineText = deadline ? `Please respond before: ${deadline.toLocaleString()}` : "";
      const prettyDate = dateObj.toDateString();

      await Promise.all((facultyDocs || []).map(async (f) => {
        if (!f?.email) return;
        return transporter.sendMail({
          from: `"Smart Timetable System" <${process.env.EMAIL_USER}>`,
          to: f.email,
          subject: "Substitution Request",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 6px;">
              <h2 style="color:#1e3a8a; margin-top:0;">Substitution Request</h2>
              <p>Dear Faculty,</p>
              <p>A substitution request is available for your consideration.</p>
              <p><strong>Details:</strong></p>
              <ul style="margin-top:8px;">
                <li><strong>Date:</strong> ${prettyDate}</li>
                <li><strong>Time Slot:</strong> ${timeSlot}</li>
                <li><strong>Semester:</strong> ${(semester != null && semester !== "") ? semester : "-"}</li>
                <li><strong>Due to absence of:</strong> ${absentFacultyName || "Faculty"}</li>
              </ul>
              ${deadlineText ? `<p style="margin-top:14px;"><strong>${deadlineText}</strong></p>` : ""}
              <p style="margin-top:14px;">
                Please visit your dashboard <strong>Messages</strong> section to respond.
                <br>
                <a href="http://localhost:3000/faculty.html?section=messages">Open Faculty Dashboard Messages</a>
              </p>
              <p style="margin-top:14px;">Regards,<br>Admin</p>
            </div>
          `
        }).catch((e) => console.error("Substitution email send error:", e));
      }));

      return res.json({
        success: true,
        message: created.length > 0 ? "Requests sent" : "Request already sent",
        createdCount: created.length,
        skippedDuplicates: existingSet.size,
        deadlineAt: deadline
      });
    } catch (err) {
      console.error("Error in /send-substitution-request:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // POST /api/substitution/respond
  router.post("/api/substitution/respond", async (req, res) => {
    try {
      const { facultyId, messageId, action } = req.body || {};
      if (!facultyId || !messageId || !action) {
        return res.status(400).json({ success: false, message: "facultyId, messageId, action are required" });
      }
      if (!["confirm", "cancel"].includes(String(action))) {
        return res.status(400).json({ success: false, message: "action must be confirm or cancel" });
      }

      // messageId is the SubstitutionRequests _id (from faculty table)
      const reqDoc = await SubstitutionRequests.findById(messageId).lean();
      if (!reqDoc) return res.status(404).json({ success: false, message: "Request not found" });

      const fallbackKey = `${String(reqDoc.fromFacultyId)}|${new Date(reqDoc.date).toISOString().slice(0, 10)}|${String(reqDoc.timeSlot)}`;
      const opp = reqDoc.opportunityId
        ? await SubstitutionOpportunity.findById(reqDoc.opportunityId)
        : await SubstitutionOpportunity.findOne({ substitutionKey: reqDoc.substitutionKey || fallbackKey });

      if (!opp) return res.status(400).json({ success: false, message: "Opportunity not found" });

      const now = new Date();
      console.log("deadline:", opp.deadline, "currentTime:", now, "status:", opp.status);

      // Auto-expire if pending and deadline passed
      if (opp.status === "pending" && opp.deadline && now > new Date(opp.deadline)) {
        opp.status = "expired";
        await opp.save();
      }

      if (opp.deadline && now > new Date(opp.deadline)) {
        return res.status(400).json({ success: false, message: "Deadline passed" });
      }
      if (opp.status === "accepted") {
        return res.status(400).json({ success: false, message: `Already accepted by another faculty` });
      }
      if (opp.status === "expired") {
        return res.status(400).json({ success: false, message: "Deadline passed" });
      }

      if (String(action) === "cancel") {
        // Optional: mark only this faculty request rejected, do not change main opportunity
        await SubstitutionRequests.findOneAndUpdate(
          { _id: messageId, toFacultyId: facultyId, status: "pending" },
          { $set: { status: "rejected" } }
        );
        // Also update SubstitutionOpportunity.responses
        // (Removed as per simplified schema)
        return res.json({ success: true, message: "Cancelled" });
      }

      // CONFIRM: atomic single acceptance on the opportunity
      const faculty = await Faculty.findById(facultyId).select("name").lean();
      const facultyName = faculty?.name || "Faculty";

      const acceptedOpp = await SubstitutionOpportunity.findOneAndUpdate(
        { _id: opp._id, status: "pending", $or: [{ assignedFacultyId: null }, { assignedFacultyId: { $exists: false } }] },
        { 
          $set: { 
            status: "accepted", 
            assignedFacultyId: facultyId, 
            acceptedFacultyName: facultyName
          } 
        },
        { 
          new: true 
        }
      );

      if (!acceptedOpp) {
        return res.status(400).json({ success: false, message: "Already accepted by another faculty" });
      }

      // Update all per-faculty requests for this opportunity
      await SubstitutionRequests.updateMany(
        { opportunityId: acceptedOpp._id, status: "pending" },
        { $set: { status: "expired", acceptedBy: facultyId, acceptedFacultyName: facultyName } }
      );
      await SubstitutionRequests.findByIdAndUpdate(messageId, {
        $set: { status: "accepted", acceptedBy: facultyId, acceptedFacultyName: facultyName }
      });

      // Broadcast message to other faculties (Message collection, unread)
      try {
        const others = await SubstitutionRequests.find({ opportunityId: acceptedOpp._id })
          .select("toFacultyId")
          .lean();
        const otherIds = Array.from(new Set((others || []).map(x => x?.toFacultyId?.toString()).filter(Boolean)))
          .filter(id => id !== String(facultyId));

        if (otherIds.length > 0) {
          await Message.insertMany(
            otherIds.map(id => ({
              sender: acceptedOpp.fromFacultyId,
              receiver: id,
              recipientId: id,
              facultyName: facultyName,
              date: acceptedOpp.date,
              timeSlot: acceptedOpp.timeSlot,
              subject: `This substitution is already accepted by ${facultyName}`,
              status: "accepted",
              deadline: acceptedOpp.deadline,
              acceptedBy: facultyId,
              acceptedFacultyName: facultyName,
              substitutionKey: acceptedOpp.substitutionKey,
              isRead: false
            })),
            { ordered: false }
          );
        }
      } catch (bErr) {
        console.error("Broadcast create error:", bErr);
      }

      // Hook automated student notification completely unblocking UI
      notifyStudentsOnSubstitution(acceptedOpp, facultyName).catch(err => console.error("Student notify error", err));

      return res.json({ success: true, message: "Accepted", opportunity: acceptedOpp });
    } catch (err) {
      console.error("Error in /api/substitution/respond:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // GET /api/substitution/opportunity-status?fromFacultyId=...&date=YYYY-MM-DD&timeSlot=...
  router.get("/api/substitution/opportunity-status", async (req, res) => {
    try {
      const { fromFacultyId, date, timeSlot } = req.query || {};
      if (!fromFacultyId || !date || !timeSlot) {
        return res.status(400).json({ success: false, message: "fromFacultyId, date, timeSlot are required" });
      }
      const dateObj = parseDateOnly(date);
      if (!dateObj) return res.status(400).json({ success: false, message: "Invalid date format (use YYYY-MM-DD)" });

      const ymd = dateObj.toISOString().slice(0, 10);
      const substitutionKey = `${String(fromFacultyId)}|${ymd}|${String(timeSlot)}`;
      const opp = await SubstitutionOpportunity.findOne({ substitutionKey }).lean();
      if (!opp) return res.json({ success: true, status: "pending", acceptedFacultyName: "", deadline: null });

      const now = new Date();

      // Priority rule: accepted ALWAYS wins over deadline
      if (opp.status === "accepted") {
        return res.json({
          success: true,
          status: "accepted",
          requestSent: opp.requestSent || false,
          acceptedFacultyName: opp.acceptedFacultyName || "",
          deadline: opp.deadline || null
        });
      }

      if (opp.deadline && now > new Date(opp.deadline)) {
        // expire opportunity if still not accepted
        await SubstitutionOpportunity.updateOne({ _id: opp._id, status: "pending" }, { $set: { status: "expired" } });
        return res.json({ success: true, status: "expired", requestSent: opp.requestSent || false, acceptedFacultyName: "", deadline: opp.deadline });
      }

      return res.json({ success: true, status: "pending", requestSent: opp.requestSent || false, acceptedFacultyName: "", deadline: opp.deadline || null });
    } catch (err) {
      console.error("Error in /api/substitution/opportunity-status:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // GET /api/substitution/all
  // Persistent history for admin table (DB-backed)
  router.get("/api/substitution/all", async (req, res) => {
    try {
      const now = new Date();

      // Fetch all opportunities (one per absent slot) sorted by latest
      const opps = await SubstitutionOpportunity.find()
        .populate("absentFacultyId", "name email username department")
        .populate("assignedFacultyId", "name email username department")
        .sort({ createdAt: -1 })
        .lean();

      // Auto-expire (but NEVER override accepted)
      const toExpire = (opps || [])
        .filter(o => o?.status !== "accepted" && o?.status === "pending" && o?.deadline && now > new Date(o.deadline))
        .map(o => o._id);

      if (toExpire.length > 0) {
        await SubstitutionOpportunity.updateMany(
          { _id: { $in: toExpire }, status: "pending" },
          { $set: { status: "expired" } }
        );
      }

      const refreshed = (opps || []).map(o => {
        // STATUS PRIORITY:
        // 1) accepted always wins
        // 2) else if now > deadline -> expired
        // 3) else pending
        let status = o.status || "pending";
        if (status === "accepted") {
          // keep
        } else if (o.deadline && now > new Date(o.deadline)) {
          status = "expired";
        } else {
          status = "pending";
        }

        return {
          absentFacultyId: o.absentFacultyId?._id || o.absentFacultyId,
          absentFacultyName: o.absentFacultyId?.name || o.absentFacultyName || "Unknown",
          date: o.date,
          timeSlot: o.timeSlot,
          semester: o.semester,
          deadline: o.deadline,
          status,
          acceptedFacultyName: status === "accepted" ? (o.acceptedFacultyName || "") : (o.acceptedFacultyName || ""),
          createdAt: o.createdAt
        };
      });

      return res.json({ success: true, requests: refreshed });
    } catch (err) {
      console.error("Error in /api/substitution/all:", err);
      return res.status(500).json({ success: false, message: "Server error", requests: [] });
    }
  });

  // RESTORED HISTORY API
  router.get("/substitution-history", async (req, res) => {
    console.log("History API hit");
    try {
      const now = new Date();
      // Fetch and populate both absent faculty and assigned faculty docs
      const opps = await SubstitutionOpportunity.find()
        .populate("absentFacultyId", "name email")
        .populate("assignedFacultyId", "name email")
        .sort({ createdAt: -1 })
        .lean();

      // Auto-expire logic for pending responses
      const results = (opps || []).map(o => {
        let currentStatus = o.status || "pending";
        
        // If whole opportunity was pending but deadline passed
        if (currentStatus === "pending" && o.deadline && now > new Date(o.deadline)) {
          currentStatus = "expired";
        }

        return {
          ...o,
          status: currentStatus
        };
      });

      return res.json({ success: true, data: results });
    } catch (err) {
      console.error("History API error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  router.get("/faculty-requests", async (req, res) => {
    try {
      const { facultyId } = req.query;
      if (!facultyId) return res.status(400).json({ success: false, message: "facultyId is required" });
      await expirePendingRequests();
      const requests = await SubstitutionRequests.find({ toFacultyId: facultyId })
        .populate("fromFacultyId", "name username department role")
        .sort({ createdAt: -1 })
        .lean();

      const now = new Date();

      // Load opportunities to apply status priority correctly
      const oppIds = Array.from(new Set((requests || []).map(r => r?.opportunityId ? String(r.opportunityId) : "").filter(Boolean)));
      const opps = oppIds.length > 0
        ? await SubstitutionOpportunity.find({ _id: { $in: oppIds } }).lean()
        : [];
      const oppMap = new Map((opps || []).map(o => [String(o._id), o]));

      // Auto-expire opportunities that passed deadline (BUT NEVER override accepted)
      const toExpireOppIds = (opps || [])
        .filter(o => o?.status !== "accepted" && o?.status === "pending" && o?.deadline && now > new Date(o.deadline))
        .map(o => o._id);
      if (toExpireOppIds.length > 0) {
        await SubstitutionOpportunity.updateMany({ _id: { $in: toExpireOppIds }, status: "pending" }, { $set: { status: "expired" } });
        toExpireOppIds.forEach(id => {
          const o = oppMap.get(String(id));
          if (o) o.status = "expired";
        });
      }

      const normalized = (requests || []).map(r => {
        const opp = r?.opportunityId ? oppMap.get(String(r.opportunityId)) : null;
        const deadline = opp?.deadline || r.deadline || r.deadlineAt || null;

        // STATUS PRIORITY:
        // 1) accepted -> always accepted, ignore deadline
        // 2) else if now > deadline -> expired
        // 3) else pending
        let status = r.status || "pending";
        let acceptedFacultyName = r.acceptedFacultyName || "";

        if (status === "accepted") {
          // keep accepted
        } else if (opp && opp.status === "accepted") {
          status = "accepted";
          acceptedFacultyName = opp.acceptedFacultyName || acceptedFacultyName;
        } else if (deadline && now > new Date(deadline)) {
          status = "expired";
        } else {
          status = "pending";
        }

        return {
          ...r,
          deadline,
          status,
          acceptedFacultyName
        };
      });

      return res.json({ success: true, requests: normalized });
    } catch (err) {
      console.error("Error in /faculty-requests:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  router.post("/respond-request", async (req, res) => {
    try {
      const { requestId, status } = req.body || {};
      if (!requestId || !status) return res.status(400).json({ success: false, message: "requestId and status are required" });
      if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ success: false, message: "status must be accepted or rejected" });

      await expirePendingRequests();
      const reqDoc = await SubstitutionRequests.findById(requestId);
      if (!reqDoc) return res.status(404).json({ success: false, message: "Request not found" });
      if (reqDoc.status === "expired") return res.status(400).json({ success: false, message: "Deadline exceeded. Request expired." });
      if (reqDoc.status !== "pending") return res.status(400).json({ success: false, message: `Request already ${reqDoc.status}` });
      if (reqDoc.deadlineAt && new Date(reqDoc.deadlineAt) < new Date()) {
        reqDoc.status = "expired";
        await reqDoc.save();
        return res.status(400).json({ success: false, message: "Deadline exceeded. Request expired." });
      }
      reqDoc.status = status;
      await reqDoc.save();
      return res.json({ success: true, message: "Response saved", request: reqDoc });
    } catch (err) {
      console.error("Error in /respond-request:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  return router;
};

