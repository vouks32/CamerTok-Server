

// File: server.js
// Run: npm init -y
// npm i express multer cors
// node server.js

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors()); // allow from any origin during development

// Ensure uploads folder exists
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Configure storage with multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Keep original filename but prefix with timestamp to avoid collisions
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

// Accept multiple files under the field name 'files'
const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 GB limit (adjust to your needs)
  },
}).array("files", 20); // accept up to 20 files per request

app.post("/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }

    // req.files is an array with file info saved locally
    const saved = (req.files || []).map((f) => ({
      originalname: f.originalname,
      filename: f.filename,
      path: f.path,
      size: f.size,
    }));

    res.json({ ok: true, files: saved });
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Upload server listening on port ${PORT}`);
  console.log(`Uploads will be saved to ${UPLOAD_DIR}`);
});
