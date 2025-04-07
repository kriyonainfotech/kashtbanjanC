const mongoose = require("mongoose");

const orderHistorySchema = new mongoose.Schema(
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
    items: [
      {
        subCategory: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SubCategory",
          required: true,
        },
        quantity: { type: Number, required: true },
        returned: { type: Number, default: 0 },
        rentedAt: { type: Date },
        returnedAt: { type: Date },
      },
    ],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OrderHistory", orderHistorySchema);
