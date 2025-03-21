// Customer Schema
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    pancardNumber: { type: String },
    aadhaarNumber: { type: String },
    adhaarImage: { type: String },
    panCardImage: { type: String },
  },
  { timestamps: true }
);

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
