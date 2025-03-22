// models/history.js
const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      required: true,
      enum: ["RENT", "RETURN", "UPDATE"], // Types of actions
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    customer: {
      // Optional: Track which user performed the action
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer", // If you have a User model
    },
    details: {
      // Store relevant changes (e.g., items returned)
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

const History = mongoose.model("History", historySchema);
module.exports = History;
