const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema(
  {
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
    }, // Links to the SubCategory

    quantity: { type: Number, required: true }, // Number of items
    availableStock: { type: Number },
    OnRent: { type: Number, default: 0 },

    pricePerItem: { type: Number, required: true }, // Price per item
  },
  { timestamps: true }
);

// ✅ Indexes for faster queries
stockSchema.index({ subCategory: 1 });


const Stock = mongoose.model(
  "Stock",
  stockSchema
);

module.exports = Stock;
