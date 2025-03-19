// require("dotenv").config();
// const express = require("express");
// const mongoose = require("mongoose");
// const app = express();

// const connectDB = require("./config/db");
// connectDB();

// // Middleware
// app.use(express.json()); // For parsing JSON
// app.use(express.urlencoded({ extended: true })); // For parsing URL-encoded data
// // API Routes
// app.use("/api", require("./routes/indexRoute"));

// // Root Route
// app.get("/", (req, res) => {
//   res.send("Welcome to the API 🚀");
// });

// // Start Server
// const PORT = process.env.PORT || 4000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");

const app = express();

// Middleware
app.use(express.json());

app.use(express.json()); // For parsing JSON bodies
app.use(express.urlencoded({ extended: true })); // For parsing URL-encoded bodies

// Connect to Database
connectDB();

// Basic Route
app.use("/api", require("./routes/indexRoute"));

// Start Server

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
