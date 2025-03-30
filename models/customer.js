// Customer Schema
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    pancardNumber: { type: String },
    aadhaarNumber: { type: String },
    sites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site",
      },
    ],
  },
  { timestamps: true }
);

// ✅ Indexes for faster queries
customerSchema.index({ userId: 1 });
customerSchema.index({ phone: 1 });

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
