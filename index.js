require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const app = express();

const connectDB = require("./config/db");
connectDB();

// Middleware
app.use(express.json()); // For parsing JSON
app.use(express.urlencoded({ extended: true })); // For parsing URL-encoded data
// API Routes
app.use("/api", require("./routes/indexRoute"));

// Root Route
app.get("/", (req, res) => {
  res.send("Welcome to the API 🚀");
});

// const { fixOrderHistoriesForSite } = require("./controllers/fixOrderHistories");

// fixOrderHistoriesForSite("6853e6bfb0c6aac7a56f342e");

// Start Server
const PORT = 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// require("dotenv").config();
// const express = require("express");
// const connectDB = require("./config/db");

// const app = express();

// // Middleware
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Connect to Database
// connectDB();

// // API Routes
// app.use("/api", require("./routes/indexRoute"));

// // Root Route
// app.get("/", (req, res) => {
//   res.send("Welcome to the API 🚀");
// });

// // Export the app for Vercel
// module.exports = app;
