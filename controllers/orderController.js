const Order = require("../models/order");
const Stock = require("../models/stock");
const mongoose = require("mongoose"); 
const Site = require("../models/site");

exports.addOrderItems = async (req, res) => {
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

      console.log(`🔍 Checking stock for subCategory: ${stock}`);

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

    await Site.updateOne(
      { _id: site },
      {
        $push: {
          history: {
            actionType: "rent",
            order: order._id,
            customer: order.customer,
            details: {
              items: order.items.map((item) => ({
                subCategory: item.subCategory,
                quantity: item.quantity,
              })),
            },
          },
        },
      }
    );


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

exports.returnOrderItems = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, items } = req.body; // [{ subCategory: "abc", quantityReturned: 2 }]

    // Fetch order
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    // Process each returned item
    for (const returnItem of items) {
      const orderItem = order.items.find((item) =>
        item.subCategory.equals(returnItem.subCategory)
      );

      if (!orderItem) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `SubCategory ${returnItem.subCategory} not found in order.`,
        });
      }

      // Validate return quantity
      const maxReturnable = orderItem.quantity - orderItem.returned;
      if (returnItem.quantityReturned > maxReturnable) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Cannot return more than ${maxReturnable} items for ${returnItem.subCategory}.`,
        });
      }

      // Update order's returned count
      orderItem.returned += returnItem.quantityReturned;

      // Atomic Stock Update (Prevents Race Conditions)
      const stockUpdate = await Stock.updateOne(
        { subCategory: returnItem.subCategory },
        {
          $inc: {
            OnRent: -returnItem.quantityReturned,
            quantity: returnItem.quantityReturned,
          },
        },
        { session }
      );

      if (stockUpdate.matchedCount === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Stock not found for SubCategory ${returnItem.subCategory}.`,
        });
      }
    }

    // ✅ Order Completion Check
    const allReturned = order.items.every(
      (item) => item.quantity === item.returned
    );
    if (allReturned) {
      order.status = "returned";
    }

    await order.save({ session });

    // After order.save() in returnOrderItems():
    await Site.updateOne(
      { _id: order.site },
      {
        $push: {
          history: {
            actionType: "RETURN",
            order: order._id,
            customer: order.customer,
            details: {
              returnedItems: items.map((returnItem) => ({
                subCategory: returnItem.subCategory,
                quantityReturned: returnItem.quantityReturned,
              })),
            },
          },
        },
      }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Items returned successfully!",
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Error returning items:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// exports.returnOrderItems = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { orderId, items } = req.body; // [{ subCategory: "abc", quantityReturned: 2 }]

//     // Fetch order
//     const order = await Order.findById(orderId).session(session);
//     if (!order) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, message: "Order not found." });
//     }

//     // Track return transaction
//     const returnHistory = {
//       orderId,
//       items: [],
//     };

//     // Process each returned item
//     for (const returnItem of items) {
//       const orderItem = order.items.find((item) =>
//         item.subCategory.equals(returnItem.subCategory)
//       );

//       if (!orderItem) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: `SubCategory ${returnItem.subCategory} not found in order.`,
//         });
//       }

//       // Validate return quantity
//       const maxReturnable = orderItem.quantity - orderItem.returned;
//       if (returnItem.quantityReturned > maxReturnable) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: `Cannot return more than ${maxReturnable} items for ${returnItem.subCategory}.`,
//         });
//       }

//       // Update order's returned count
//       orderItem.returned += returnItem.quantityReturned;

//       // Store in return history log
//       returnHistory.items.push({
//         subCategory: returnItem.subCategory,
//         quantityReturned: returnItem.quantityReturned,
//       });

//       // Atomic Stock Update (Prevents Race Conditions)
//       const stockUpdate = await Stock.updateOne(
//         { subCategory: returnItem.subCategory },
//         {
//           $inc: {
//             OnRent: -returnItem.quantityReturned,
//             quantity: returnItem.quantityReturned,
//           },
//         },
//         { session }
//       );

//       if (stockUpdate.matchedCount === 0) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: `Stock not found for SubCategory ${returnItem.subCategory}.`,
//         });
//       }
//     }

//     // ✅ Save return transaction history
//     await ReturnHistory.create([returnHistory], { session });

//     // ✅ Order Completion Check
//     const allReturned = order.items.every(
//       (item) => item.quantity === item.returned
//     );
//     if (allReturned) {
//       order.status = "returned";
//     }

//     await order.save({ session });
//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: "Items returned successfully!",
//       order,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("❌ Error returning items:", error);
//     res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

