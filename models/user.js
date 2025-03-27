const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true }, // Indexed for fast lookups
    mobileNumber: { type: String, required: true, unique: true }, // Ensuring unique mobile
    password: { type: String, required: true },
    storeName: { type: String, required: true },
    storeAddress: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    customers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Customer" }], // ✅ Add this
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
