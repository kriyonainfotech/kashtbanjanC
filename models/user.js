const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true }, // Indexed for fast lookups
  mobileNumber: { type: String, required: true, unique: true }, // Ensuring unique mobile
  password: { type: String, required: true },
  storeName: { type: String, required: true },
  storeAddress: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Indexes for faster queries
userSchema.index({ email: 1 }); // Single-field index for email lookup
// userSchema.index({ mobileNumber: 1 }); // Index for mobile number lookup
// userSchema.index({ city: 1, state: 1 }); // Compound index for city-state queries

const User = mongoose.model("User", userSchema);

module.exports = User;
