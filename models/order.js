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
        rentedAt: { type: Date }, // ✅ Store when rented
        returnedAt: { type: Date }, // ✅ Store when returned
      },
    ],
    lostOrDamagedItems: [
      {
        subCategory: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SubCategory",
          required: true,
        },
        lostordamagedQty: { type: Number },
        pricePerItem: { type: Number },
        date: { type: Date, default: Date.now },
      },
    ],
    totalCostAmount: { type: Number, default: 0 }, // 🆕 Track total rental cost
    status: {
      type: String,
      enum: ["onrent", "returned", "paid"],
      default: "onrent", // 🆕 Track order status
    },
    returnDueDate: { type: Date },
    orderDate: { type: Date }, // When the order was placed
    paymentDone: { type: Boolean, default: false }, // ✅ Tracks payment status
    orderHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OrderHistory",
      },
    ],
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }], // Reference to Payment model
  },
  { timestamps: true }
);

// ✅ Indexes for faster queries
orderSchema.index({ site: 1 });
orderSchema.index({ customer: 1 });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
