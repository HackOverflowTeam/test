const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes

// Store OTPs (for real app, use a database)
const userSessions = {};

// Gmail SMTP Config
const SMTP_SERVER = process.env.SMTP_SERVER;
const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 587;
const EMAIL_SENDER = process.env.EMAIL_SENDER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

// Create reusable transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  host: SMTP_SERVER,
  port: SMTP_PORT,
  secure: false, // true for port 465, false for other ports (TLS)
  auth: {
    user: EMAIL_SENDER,
    pass: EMAIL_PASSWORD,
  },
});

// Function to send email
async function sendEmail(receiverEmail, subject, message, referer) {
  if (referer && referer.startsWith(ALLOWED_ORIGIN)) {
    const mailOptions = {
      from: EMAIL_SENDER,
      to: receiverEmail,
      subject: subject,
      text: message,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email successfully sent to ${receiverEmail}`);
      return true;
    } catch (error) {
      console.error(`Error sending email: ${error}`);
      return false;
    }
  } else {
    console.error("Unauthorized origin");
    return false;
  }
}

// Route to send OTP
app.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000);

    // Store OTP in session (in production, use a database with expiration)
    userSessions[email] = otp;

    // Email content
    const subject = "Your OTP Code";
    const message = `Your OTP code is ${otp}. Please use this code within 10 minutes.`;

    // Send the email
    const referer = req.headers.referer;
    if (await sendEmail(email, subject, message, referer)) {
      return res.status(200).json({ message: "OTP sent successfully" });
    } else {
      return res.status(500).json({ error: "Failed to send OTP. Please try again later." });
    }
  } catch (error) {
    return res.status(500).json({ error: `An unexpected error occurred: ${error}` });
  }
});

// Route to verify OTP
app.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    // Retrieve stored OTP
    const storedOtp = userSessions[email];

    if (storedOtp && String(storedOtp) === String(otp)) {
      delete userSessions[email]; // OTP verified, remove it
      return res.status(200).json({ message: "OTP verified successfully" });
    } else {
      return res.status(401).json({ error: "Invalid OTP" });
    }
  } catch (error) {
    return res.status(500).json({ error: `An unexpected error occurred: ${error}` });
  }
});


app.post('/sendmail', async (req, res) => {
  const { to, subject, body } = req.body;
  const referer = req.headers.referer;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const emailSent = await sendEmail(to, subject, body, referer);

    if (emailSent) {
      res.status(200).json({ message: "Email sent successfully" });
    } else {
      res.status(500).json({ error: "Failed to send email. Please try again later." });
    }
  } catch (error) {
    console.error(`Error in /sendmail: ${error}`);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});


// Error handling middleware for unexpected errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error. Please try again later." });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
