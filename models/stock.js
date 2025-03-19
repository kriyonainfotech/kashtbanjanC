const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["purchase", "sell"],
    required: true,
  }, // "purchase" or "sell"

  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategory",
    required: true,
  }, // Links to the SubCategory

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  }, // Links to MainCategory

  quantity: { type: Number, required: true }, // Number of items purchased/sold

  pricePerItem: { type: Number, required: true }, // Price per item

  createdAt: { type: Date, default: Date.now },
});

// ✅ Indexes for faster queries
stockSchema.index({ subCategory: 1 });
// stockSchema.index({ category: 1 });
// stockSchema.index({ createdAt: -1 });

const Stock = mongoose.model(
  "Stock",
  stockSchema
);

module.exports = Stock;
