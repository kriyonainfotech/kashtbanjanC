const Order = require("../models/order");
const Stock = require("../models/stock");
const mongoose = require("mongoose"); 

exports.addOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // 🔄 Begin transaction

  try {
    console.log("🛒 Received Order Request:", req.body);

    const { customer, site, items } = req.body;

    // 🛑 Validate request data
    if (
      !customer ||
      !site ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      console.log("❌ Invalid order data received.");
      return res.status(400).json({
        success: false,
        message: "Invalid order data. Customer, site, and items are required.",
      });
    }

    // Step 1: Check stock availability for all items **before modifying stock**
    const stockUpdates = [];

    for (let item of items) {
      const stock = await Stock.findOne({
        subCategory: item.subCategory,
      }).session(session);

      console.log(
        `🔍 Checking stock for subCategory: ${stock}`
      );

      if (!stock || stock.quantity < item.quantity) {
        console.log(
          `⚠️ Insufficient stock for subCategory: ${item.subCategory} , item's qty : ${item.quantity}`
        );
        await session.abortTransaction(); // 🚨 Rollback
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for subCategory: ${item.subCategory}`,
        });
      }

      // Prepare stock deduction update
      stock.quantity -= item.quantity;
      stock.OnRent = (stock.OnRent || 0) + item.quantity;
      console.log(
        `✅ Stock updated for subCategory: ${item.subCategory}, Issued: ${item.quantity}, Remaining: ${stock.quantity}, On Rent: ${stock.OnRent}`
      );
      stockUpdates.push(stock);
    }

    // Step 2: Apply stock deductions inside the transaction
    for (let stock of stockUpdates) {
      await stock.save({ session }); // 🔄 Save within transaction
      console.log(
        `✅ Stock updated for subCategory: ${stock.subCategory}, Remaining: ${stock.quantity}`
      );
    }
    // Step 3: Create order within transaction
    const order = new Order({ customer, site, items });
    await order.save({ session }); // Save within the transaction

    // ✅ Commit transaction
    await session.commitTransaction();
    session.endSession();

    console.log("🎉 Order successfully created:", order._id);
    res.status(201).json({
      success: true,
      message: "✅ Order added successfully!",
      order, // No need for `order[0]`
    });
  } catch (error) {
    await session.abortTransaction(); // 🚨 Rollback if error occurs
    session.endSession();

    console.error("❌ Error creating order:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};


