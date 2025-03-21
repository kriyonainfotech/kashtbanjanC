const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    }, // Links order to a site

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    }, // Links order to a customer

    items: [
      {
        subCategory: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SubCategory",
          required: true,
        }, // Subcategory rented

        quantity: { type: Number, required: true }, // Quantity rented
        returned: { type: Number, default: 0 }, // 🆕 Track returned items
      },
    ],
    status: {
      type: String,
      enum: ["onrent", "returned", "paid"],
      default: "onrent",
    },
    returnDueDate: { type: Date },
    orderDate: { type: Date, default: Date.now }, // When the order was placed
    paymentDone: { type: Boolean, default: false }, // ✅ Tracks payment status
  },
  { timestamps: true }
);

// ✅ Indexes for faster queries
orderSchema.index({ site: 1 });
orderSchema.index({ customer: 1 });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
