const Order = require("../models/order");
const Stock = require("../models/stock");
const mongoose = require("mongoose"); 
const Site = require("../models/site");

// exports.addOrderItems = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction(); // 🔄 Begin transaction

//   try {
//     console.log("🛒 Received Order Request:", req.body);

//     const { customer, site, items } = req.body;

//     // 🛑 Validate request data
//     if (!customer || !site || !Array.isArray(items) || items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid order data. Customer, site, and items are required.",
//       });
//     }

//     // Step 1: Check stock availability for all items **before modifying stock**
//     let totalOrderAmount = 0; // 🆕 Track total amount of this order
//     const stockUpdates = [];
//     const stockMap = new Map();

//     for (let item of items) {
//       let stock = stockMap.get(item.subCategory);

//       if (!stock) {
//         stock = await Stock.findOne({ subCategory: item.subCategory })
//           .populate("subCategory", "rentalRate") // ✅ Fetch rentalRate
//           .session(session);
//         if (!stock) {
//           await session.abortTransaction();
//           session.endSession();
//           return res.status(400).json({
//             success: false,
//             message: `Stock not found for subCategory: ${item.subCategory}`,
//           });
//         }
//         stockMap.set(item.subCategory, stock);
//       }

//       // 🛑 Check if available stock is enough
//       if (stock.availableStock < item.quantity) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: `Insufficient stock for subCategory: ${item.subCategory}. Available: ${stock.availableStock}, Required: ${item.quantity}`,
//         });
//       }

//       // Prepare stock deduction update
//       stock.availableStock -= item.quantity;
//       stock.OnRent = (stock.OnRent || 0) + item.quantity;
//       stockUpdates.push(stock);
//     }

//     // Step 2: Apply stock deductions inside the transaction
//     for (let stock of stockUpdates) {
//       await stock.save({ session }); // 🔄 Save within transaction
//     }

//     // Step 3: Create order within transaction
//     const order = new Order({ customer, site, items });
//     await order.save({ session });

//     // Step 4: Update site history
//     await Site.updateOne(
//       { _id: site },
//       {
//         $push: {
//           history: {
//             actionType: "rent",
//             order: order._id,
//             customer: order.customer,
//             details: {
//               items: order.items.map((item) => ({
//                 subCategory: item.subCategory,
//                 availableStock: item.quantity,
//               })),
//             },
//           },
//         },
//       },
//       { session }
//     );

//     // ✅ Commit transaction
//     await session.commitTransaction();
//     session.endSession();

//     console.log("🎉 Order successfully created:", order._id);
//     res.status(201).json({
//       success: true,
//       message: "✅ Order added successfully!",
//       order,
//     });
//   } catch (error) {
//     await session.abortTransaction(); // 🚨 Rollback if error occurs
//     session.endSession();

//     console.error("❌ Error creating order:", error);
//     res.status(500).json({
//       success: false,
//       message: "Something went wrong. Please try again.",
//     });
//   }
// };

exports.addOrderItems = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // 🔄 Begin transaction

  try {
    console.log("🛒 Received Order Request:", req.body);

    const { customer, site, items } = req.body;

    // 🛑 Validate request data
    if (!customer || !site || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order data. Customer, site, and items are required.",
      });
    }

    // Step 1: Check stock availability & calculate rental amount
    let totalCostAmount = 0; // 🆕 Track total rental cost
    const stockUpdates = [];
    const stockMap = new Map();

    for (let item of items) {
      let stock = stockMap.get(item.subCategory);

      if (!stock) {
        stock = await Stock.findOne({ subCategory: item.subCategory })
          .populate("subCategory", "rentalRate") // ✅ Fetch rentalRate
          .session(session);
        if (!stock) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Stock not found for subCategory: ${item.subCategory}`,
          });
        }
        stockMap.set(item.subCategory, stock);
      }

      // 🛑 Check stock availability
      if (stock.availableStock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for subCategory: ${item.subCategory}. Available: ${stock.availableStock}, Required: ${item.quantity}`,
        });
      }

      // ✅ Calculate rental cost for the item
      const rentalRate = stock.subCategory.rentalRate; // Get rental rate
      const itemCost = rentalRate * item.quantity; // Multiply by quantity
      totalCostAmount += itemCost; // Add to total cost

      // Prepare stock deduction update
      stock.availableStock -= item.quantity;
      stock.OnRent = (stock.OnRent || 0) + item.quantity;
      stockUpdates.push(stock);
    }

    // Step 2: Apply stock deductions inside the transaction
    for (let stock of stockUpdates) {
      await stock.save({ session }); // 🔄 Save within transaction
    }

    // Step 3: Create order with total rental cost
    const order = new Order({
      customer,
      site,
      items,
      totalCostAmount,
      rentedDate: new Date(),
    });

    await order.save({ session });
    console.log("✅ Order created successfully:", order._id);

    // Step 4: Update site history & dueAmount
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
                availableStock: item.quantity,
              })),
            },
          },
        },
        $inc: { dueAmount: totalCostAmount }, // 🔥 Update dueAmount
      },
      { session }
    );

    // ✅ Commit transaction
    await session.commitTransaction();
    session.endSession();

    console.log("🎉 Order successfully created:", order._id);
    res.status(201).json({
      success: true,
      message: "✅ Order added successfully!",
      order,
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
    console.log("🔄 Processing return request:", req.body);

    const { orderId, items } = req.body; // [{ subCategory: "abc", quantityReturned: 2 }]

    // 🛑 Validate request data
    if (!orderId || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Order ID and valid return items are required.",
      });
    }

    // 📝 Fetch order inside transaction
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    // ✅ Process each returned item
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

      // 🛑 Validate return quantity
      const maxReturnable = orderItem.quantity - orderItem.returned;
      if (returnItem.quantityReturned > maxReturnable) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Cannot return more than ${maxReturnable} items for ${returnItem.subCategory}.`,
        });
      }

      // ✅ Update order's returned count
      orderItem.returned += returnItem.quantityReturned;
      orderItem.returnedAt = new Date(); // Store return time

      // ✅ Atomic Stock Update (Prevents Race Conditions)
      const stockUpdate = await Stock.updateOne(
        { subCategory: returnItem.subCategory },
        {
          $inc: {
            OnRent: -returnItem.quantityReturned, // Reduce rented stock
            availableStock: returnItem.quantityReturned, // Add back to available stock
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

    // ✅ Check if all items are returned
    const allReturned = order.items.every(
      (item) => item.quantity === item.returned
    );
    if (allReturned) {
      order.status = "returned";
    }

    await order.save({ session });

    // ✅ Update Site History within Transaction
    await Site.updateOne(
      { _id: order.site },
      {
        $push: {
          history: {
            actionType: "return",
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
      },
      { session }
    );

    // ✅ Commit transaction
    await session.commitTransaction();
    session.endSession();

    console.log("✅ Items successfully returned:", orderId);
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

exports.getCustomerRentedItems = async (req, res) => {
  try {
    const { CustomerId } = req.body; // Customer ID

    console.log(`📝 [GET CUSTOMER RENTED ITEMS] Customer ID: ${CustomerId}`);

    // ✅ Fetch all orders where the customer has rented items
    const rentedItems = await Order.find({ customer: CustomerId })
      .lean()
      .populate("items.subCategory", "name") // Populate subcategory names
      .select("items.subCategory items.quantity"); // Get only needed fields

    if (!rentedItems.length) {
      return res.status(404).json({
        success: false,
        message: "No rented items found for this customer!",
      });
    }
    // 🔄 Flatten items array to return only necessary fields
    const formattedItems = rentedItems.flatMap((order) =>
      order.items.map((item) => ({
        subCategoryId: item.subCategory._id,
        subCategoryName: item.subCategory.name,
        quantity: item.quantity,
      }))
    );

    res.status(200).json({
      success: true,
      message: "✅ Rented subcategories fetched successfully!",
      rentedItems: formattedItems,
    });
  } catch (error) {
    console.error("❌ [Error] Fetching rented items:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
