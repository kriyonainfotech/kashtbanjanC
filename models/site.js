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
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
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
        details: mongoose.Schema.Types.Mixed, // Store relevant details
        timestamp: { type: Date, default: Date.now }, // ✅ Ensure sorting by date
      },
    ],
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }], // Reference to Payment model
    dueAmount: { type: Number, default: 0 }, // 🔥 Track due amount
  },
  { timestamps: true }
);

const Site = mongoose.model("Site", siteSchema);

module.exports = Site;