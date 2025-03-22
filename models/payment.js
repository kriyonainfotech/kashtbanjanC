const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now }, // Payment date
    amount: { type: Number, required: true }, // Payment amount
    paymentMethod: {
      type: String,
      enum: ["Cash", "UPI", "Bank Transfer", "Credit Card"],
      required: true,
    }, // Payment method
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    }, // Linked order
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true }, // Linked site
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    }, // Linked customer
    transactionId: { type: String }, // For online payments
    remarks: { type: String }, // Any additional notes
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt
);

module.exports = mongoose.model("Payment", paymentSchema);
