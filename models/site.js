// Customer Schema
const mongoose = require("mongoose");

// Site Schema
const siteSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    sitename: { type: String, required: true },
    address: { type: String, required: true },
    history: [
      {
        actionType: {
          type: String,
          enum: ["rent", "return", "payment"],
          required: true,
        },
        order: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          required: true,
        },
        customer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
        },
        details: mongoose.Schema.Types.Mixed, // Store relevant details
        timestamp: { type: Date, default: Date.now },
      },
    ],
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }], // Reference to Payment model
  },
  { timestamps: true }
);

const Site = mongoose.model("Site", siteSchema);

module.exports = Site;