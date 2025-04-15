const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true }, // Linked Site
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // Linked Order (if applicable)
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    }, // Linked Customer
    amount: { type: Number, required: true }, // Payment amount
    date: { type: Date }, // Payment date
    paymentMethod: {
      type: String,
      enum: ["Cash", "UPI", "Bank Transfer", "Credit Card", "Other"],
      required: true,
    }, // Payment method
    paymentType: {
      type: String,
      enum: [
        "Deposit",
        "Discount",
        "FullPayment",
        "AdvancePayment",
        "HalfPayment",
      ], // Define types
      required: true,
    },
    remarks: { type: String }, // Any additional notes
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
