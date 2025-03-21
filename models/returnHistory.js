const mongoose = require("mongoose");

const returnHistorySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    }, // Links return entry to an order

    items: [
      {
        subCategory: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SubCategory",
          required: true,
        },
        quantityReturned: { type: Number, required: true }, // How many items were returned
      },
    ],

    returnDate: { type: Date, default: Date.now }, // Timestamp of return
  },
  { timestamps: true }
);

const ReturnHistory = mongoose.model("ReturnHistory", returnHistorySchema);
module.exports = ReturnHistory;
