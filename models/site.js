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
  },
  { timestamps: true }
);

const Site = mongoose.model("Site", siteSchema);

module.exports = Site;