const nodemailer = require("nodemailer");

let cachedTransporter = null;

function getMailer() {
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  return cachedTransporter;
}

module.exports = { getMailer };

