const mongoose = require("mongoose");
const moment = require("moment");
const Order = require("../models/order");
const Stock = require("../models/stock");
const OrderHistory = require("../models/orderHistory");
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

    const { customer, site, items, orderDate } = req.body;
    console.log("order body :", req.body);

    const trimmedDate = orderDate.split(".")[0]; // Remove microseconds
    const parsedorderDate = moment(trimmedDate.split(" ")[0], "YYYY-MM-DD")
      .startOf("day") // sets time to 00:00:00.000
      .toDate();
    console.log("Parsed order date:", orderDate);

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

      // item.rentedAt = parsedorderDate; // Store rented date in item
    }

    const orderItems = items.map((item) => ({
      subCategory: item.subCategory,
      quantity: item.quantity,
      rentedAt: parsedorderDate instanceof Date && !isNaN(parsedorderDate)
        ? parsedorderDate
        : new Date(), // fallback to current date
    }));

    // Step 2: Apply stock deductions inside the transaction
    for (let stock of stockUpdates) {
      await stock.save({ session }); // 🔄 Save within transaction
    }

    // Step 2.5: Generate Invoice Number
    // 🚀 Step 2.5: Generate Simple Invoice Number (kc-1, kc-2, kc-3 per site)

    const updatedSite = await Site.findByIdAndUpdate(
      site,
      { $inc: { invoiceCounter: 1 } },
      { new: true, session }
    );

    // 📄 Final Invoice Number
    const invoiceNo = `kc-${updatedSite.invoiceCounter}`;

    // Step 3: Create order with total rental cost
    const order = new Order({
      customer,
      site,
      items: orderItems,
      totalCostAmount,
      rentedDate: new Date(),
      orderDate: parsedorderDate, // 🆕 Use provided date or current date
      invoiceNo,
    });

    await order.save({ session });

    // 🔥 Create separate OrderHistory record
    const history = new OrderHistory({
      actionType: "rent",
      order: order._id,
      items: items.map((item) => ({
        subCategory: item.subCategory,
        quantity: item.quantity,
        returned: 0,
        rentedAt: parsedorderDate,
      })),
      timestamp: new Date(),
    });

    await history.save({ session });

    // 🔄 Link history to order
    order.orderHistory.push(history._id);
    await order.save({ session });

    // 🆕 Update site's dueAmount only
    await Site.updateOne(
      { _id: order.site },
      {
        $push: { orders: order._id }, // ✅ Add order to site.orders array
        $inc: { dueAmount: totalCostAmount },
      },
      { session }
    );

    // ✅ Commit transaction
    await session.commitTransaction();
    session.endSession();

    console.log("🎉 Order successfully created:", order);
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

// exports.editOrder = async (req, res) => {
//   console.log("🔄 Editing Order:", req.body);
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { orderId, updatedItems, updatedOrderDate } = req.body;

//     console.log("📝 Request to edit order received:", {
//       orderId,
//       updatedItems,
//     });

//     if (!orderId || !Array.isArray(updatedItems) || updatedItems.length === 0) {
//       console.log("⚠️ Missing required fields.");
//       return res.status(400).json({
//         success: false,
//         message: "Order ID and updated items are required.",
//       });
//     }

//     const order = await Order.findById(orderId)
//       .populate("items.subCategory")
//       .session(session);

//     if (!order) {
//       console.log("❌ Order not found:", orderId);
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, message: "Order not found." });
//     }

//     console.log("📦 Existing order fetched:", order._id);

//     const originalItems = order.items.map((item) => ({
//       subCategory: item.subCategory._id.toString(),
//       quantity: item.quantity,
//     }));

//     const originalMap = new Map();
//     for (let item of originalItems) {
//       originalMap.set(item.subCategory, item);
//     }

//     const updatedMap = new Map();
//     for (let item of updatedItems) {
//       updatedMap.set(item.subCategory, item);
//     }

//     console.log("🔍 Comparing updated items...");
//     const addedItems = [];
//     const removedItems = [];
//     const quantityUpdatedItems = [];

//     for (let [subCategoryId, updatedItem] of updatedMap.entries()) {
//       const originalItem = originalMap.get(subCategoryId);
//       if (!originalItem) {
//         addedItems.push(updatedItem);
//       } else if (originalItem.quantity !== updatedItem.quantity) {
//         quantityUpdatedItems.push({
//           ...updatedItem,
//           previousQuantity: originalItem.quantity,
//         });
//       }
//     }

//     for (let [subCategoryId, originalItem] of originalMap.entries()) {
//       if (!updatedMap.has(subCategoryId)) {
//         removedItems.push(originalItem);
//       }
//     }

//     console.log("➕ Added Items:", addedItems);
//     console.log("✏️ Quantity Updated Items:", quantityUpdatedItems);
//     console.log("➖ Removed Items:", removedItems);

//     let newTotalCost = 0;

//     console.log("📥 Processing added & updated items...");
//     for (let item of addedItems) {
//       const stock = await Stock.findOne({ subCategory: item.subCategory })
//         .populate("subCategory", "rentalRate")
//         .session(session);

//       const requiredQty = item.quantity;
//       if (stock.availableStock < requiredQty) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: `Insufficient stock for subCategory: ${item.subCategory}. Available: ${stock.availableStock}, Required: ${requiredQty}`,
//         });
//       }

//       stock.availableStock -= requiredQty;
//       stock.OnRent += requiredQty;
//       await stock.save({ session });

//       // const rentalRate = stock.subCategory.rentalRate;
//       // newTotalCost += rentalRate * item.quantity;

//       item.rentedAt = item.rentedAt
//         ? new Date(item.rentedAt)
//         : moment(updatedOrderDate.split(".")[0], "YYYY-MM-DD HH:mm:ss").toDate();
//     }

//     for (let item of quantityUpdatedItems) {
//       const stock = await Stock.findOne({ subCategory: item.subCategory })
//         .populate("subCategory", "rentalRate")
//         .session(session);
//       console.log("📦 Stock found:", stock);

//       const diff = item.quantity - item.previousQuantity;

//       if (diff > 0) {
//         // 🟢 More quantity added
//         console.log("🟢 Quantity increased:", diff);
//         if (stock.availableStock < diff) {
//           await session.abortTransaction();
//           session.endSession();
//           console.log(
//             `❌ Insufficient stock to increase quantity for ${item.subCategory}: required ${diff}, available ${stock.availableStock}`
//           );
//           return res.status(400).json({
//             success: false,
//             message: `Insufficient stock to increase quantity for subCategory: ${item.subCategory}. Available: ${stock.availableStock}, Required: ${diff}`,
//           });
//         }

//         stock.availableStock -= diff;
//         stock.OnRent += diff;
//       } else if (diff < 0) {
//         // 🔴 Quantity reduced (return some stock)
//         console.log("🔴 Quantity reduced:", diff);
//         const returnQty = Math.abs(diff);
//         if (stock.OnRent < returnQty) {
//           await session.abortTransaction();
//           session.endSession();
//           console.log(
//             `❌ Trying to return more than on rent for ${item.subCategory}: OnRent ${stock.OnRent}, trying to return ${returnQty}`
//           );
//           return res.status(400).json({
//             success: false,
//             message: `Invalid quantity reduction for subCategory: ${item.subCategory}. OnRent: ${stock.OnRent}, Trying to return: ${returnQty}`,
//           });
//         }

//         stock.availableStock += returnQty;
//         stock.OnRent -= returnQty;
//       }

//       await stock.save({ session });

//       console.log("📦 Stock updated:", stock);

//       item.rentedAt = moment(
//         updatedOrderDate.split(".")[0],
//         "YYYY-MM-DD HH:mm:ss"
//       ).toDate();
//     }

//     console.log("📤 Processing removed items...");

//     for (let item of removedItems) {
//       console.log("🛑 [REMOVED ITEM DETECTED]");
//       console.log(`🔍 SubCategory ID: ${item.subCategory}`);
//       console.log(`📦 Quantity to return: ${item.quantity}`);

//       const stock = await Stock.findOne({
//         subCategory: item.subCategory,
//       }).session(session);
//       console.log("📦 Stock found:", stock);

//       if (!stock) {
//         console.log("❌ Stock not found for subCategory:", item.subCategory);
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(404).json({
//           success: false,
//           message: "Stock not found for removed item.",
//         });
//       }

//       console.log(
//         `📊 Before Update => availableStock: ${stock.availableStock}, OnRent: ${stock.OnRent}`
//       );

//       // Safety check to avoid negative OnRent
//       if (stock.OnRent < item.quantity) {
//         console.log("🚫 Error: Trying to return more than on rent");
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(400).json({
//           success: false,
//           message: `Invalid return quantity for subCategory: ${item.subCategory}. OnRent: ${stock.OnRent}, Attempted to return: ${item.quantity}`,
//         });
//       }

//       stock.availableStock += item.quantity;
//       stock.OnRent -= item.quantity;

//       console.log(
//         `✅ Updated => availableStock: ${stock.availableStock}, OnRent: ${stock.OnRent}`
//       );

//       await stock.save({ session });

//       const subCat = await mongoose
//         .model("SubCategory")
//         .findById(item.subCategory);
//     }

//     console.log("🧾 Updating order...");
//     order.items = updatedItems.map((item) => ({
//       subCategory: item.subCategory,
//       quantity: item.quantity,
//       rentedAt: item.rentedAt,
//       returned: 0,
//     }));

//     for (const item of order.items) {
//       // Debugging: Log the item being processed
//       console.log("Processing item:", item);

//       // Find the stock for the current subCategory
//       const stock = await Stock.findOne({
//         subCategory: item.subCategory, // Ensure correct field for `subCategory`
//       }).populate("subCategory", "rentalRate");

//       // Debugging: Log the stock information
//       console.log("Stock found:", stock);

//       // Check if stock or subCategory is missing
//       if (!stock || !stock.subCategory) {
//         console.log(
//           "❌ Stock or subCategory not found for item:",
//           item.subCategory
//         );
//         continue;
//       }

//       // Get the rental rate and calculate the cost
//       const rentalRate = stock.subCategory.rentalRate;
//       console.log("Rental rate for subCategory:", rentalRate);

//       // Update total cost with the rental rate * quantity
//       newTotalCost += rentalRate * item.quantity;

//       // Debugging: Log the running total cost
//       console.log("Updated total cost:", newTotalCost);
//     }

//     console.log("Final total cost:", newTotalCost);

//     order.totalCostAmount = newTotalCost;
//     order.orderDate = moment(
//       updatedOrderDate.split(".")[0],
//       "YYYY-MM-DD HH:mm:ss"
//     ).toDate();
//     await order.save({ session });

//     console.log("📚 Updating order history...");
//     await OrderHistory.deleteMany({
//       order: orderId,
//       actionType: "rent",
//     }).session(session);

//     const rentHistory = new OrderHistory({
//       actionType: "rent",
//       order: order._id,
//       items: addedItems.concat(quantityUpdatedItems).map((item) => ({
//         subCategory: item.subCategory,
//         quantity: item.quantity,
//         rentedAt: item.rentedAt,
//         returned: 0,
//       })),
//       timestamp: new Date(),
//     });
//     await rentHistory.save({ session });

//     const returnHistory = new OrderHistory({
//       actionType: "return",
//       order: order._id,
//       items: removedItems.map((item) => ({
//         subCategory: item.subCategory,
//         quantity: item.quantity,
//         returned: item.quantity,
//         returnedAt: new Date(),
//       })),
//       timestamp: new Date(),
//     });
//     await returnHistory.save({ session });

//     order.orderHistory = [rentHistory._id, returnHistory._id];
//     await order.save({ session });

//     console.log("📍 Updating due amount for site...");
//     await Site.updateOne(
//       { _id: order.site },
//       { $set: { dueAmount: newTotalCost } },
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     console.log("✅ Order updated successfully:", order._id);
//     res.status(200).json({
//       success: true,
//       message: "✅ Order updated successfully",
//       order,
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("❌ Error editing order:", err);
//     res.status(500).json({ success: false, message: "Something went wrong." });
//   }
//   // --------------------------------------------------------------- new
//   // try {
//   //   const { orderId, updatedOrderDate, updatedItems } = req.body;

//   //   if (!orderId || !updatedItems || !Array.isArray(updatedItems)) {
//   //     return res.status(400).json({
//   //       success: false,
//   //       message: "Order ID and updated items are required.",
//   //     });
//   //   }

//   //   // Format items for mongoose model (dates and fields)
//   //   const formattedItems = updatedItems.map((item) => ({
//   //     subCategory: item.subCategory,
//   //     quantity: item.quantity,
//   //     rentedAt: new Date(item.rentedAt),
//   //     returnedAt: item.returnedAt ? new Date(item.returnedAt) : undefined,
//   //     returned: item.returned // ✅ Important for schema default
//   //   }));


//   //   // Push items to existing order
//   //   const updatedOrder = await Order.findByIdAndUpdate(
//   //     orderId,
//   //     {
//   //       $push: {
//   //         items: { $each: formattedItems },
//   //       },
//   //       orderDate: new Date(updatedOrderDate),
//   //     },
//   //     { new: true }
//   //   );

//   //   if (!updatedOrder) {
//   //     return res.status(404).json({
//   //       success: false,
//   //       message: "Order not found.",
//   //     });
//   //   }

//   //   res.status(200).json({
//   //     success: true,
//   //     message: "Order updated successfully.",
//   //     data: updatedOrder,
//   //   });
//   // } catch (err) {
//   //   console.error("Edit order error:", err);
//   //   res.status(500).json({
//   //     success: false,
//   //     message: "Server error while updating order.",
//   //   });
//   // }

//   // new 2 --------------------------------------------------------------
//   // try {
//   //   const { orderId, updatedOrderDate, updatedItems } = req.body;

//   //   if (!orderId || !updatedItems || !Array.isArray(updatedItems)) {
//   //     return res.status(400).json({
//   //       success: false,
//   //       message: "Order ID and updated items are required.",
//   //     });
//   //   }

//   //   for (const item of updatedItems) {
//   //     // Try to update an existing item by subCategory
//   //     const updateResult = await Order.updateOne(
//   //       {
//   //         _id: orderId,
//   //         "items.subCategory": item.subCategory,
//   //       },
//   //       {
//   //         $set: {
//   //           ...(item.rentedAt && { "items.$.rentedAt": new Date(item.rentedAt) }),
//   //           ...(item.returnedAt && { "items.$.returnedAt": new Date(item.returnedAt) }),
//   //           ...(item.quantity !== undefined && { "items.$.quantity": item.quantity }),
//   //           ...(item.returned !== undefined && { "items.$.returned": item.returned }),
//   //         },
//   //       }
//   //     );

//   //     // If no existing item matched, push it as new
//   //     if (updateResult.modifiedCount === 0) {
//   //       await Order.findByIdAndUpdate(orderId, {
//   //         $push: {
//   //           items: {
//   //             subCategory: item.subCategory,
//   //             quantity: item.quantity || 0,
//   //             returned: item.returned || 0,
//   //             rentedAt: item.rentedAt ? new Date(item.rentedAt) : undefined,
//   //             returnedAt: item.returnedAt ? new Date(item.returnedAt) : undefined,
//   //           },
//   //         },
//   //       });
//   //     }
//   //   }

//   //   // Optionally update orderDate if sent
//   //   if (updatedOrderDate) {
//   //     await Order.findByIdAndUpdate(orderId, {
//   //       orderDate: new Date(updatedOrderDate),
//   //     });
//   //   }

//   //   const updatedOrder = await Order.findById(orderId);

//   //   if (!updatedOrder) {
//   //     return res.status(404).json({
//   //       success: false,
//   //       message: "Order not found.",
//   //     });
//   //   }

//   //   res.status(200).json({
//   //     success: true,
//   //     message: "Order updated successfully.",
//   //     data: updatedOrder,
//   //   });
//   // } catch (err) {
//   //   console.error("Edit order error:", err);
//   //   res.status(500).json({
//   //     success: false,
//   //     message: "Server error while updating order.",
//   //   });
//   // }
// };

exports.editOrder = async (req, res) => {
  console.log("🔄 Starting Edit Order API");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 📝 Extract data from request
    const { orderId, updatedItems, updatedOrderDate } = req.body;
    console.log("📥 Received Request Data:", { orderId, updatedItems, updatedOrderDate });

    // ⚠️ Validate input
    if (!orderId || !Array.isArray(updatedItems) || updatedItems.length === 0) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ success: false, message: "Order ID and updated items are required" });
    }

    // 🔍 Find the original order by ID and populate subCategory for each item
    const order = await Order.findById(orderId).populate("items.subCategory").session(session);
    if (!order) {
      console.log("❌ Order not found for ID:", orderId);
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    console.log("📦 Original Order Loaded:", order);

    // 📊 Create maps for quick lookup: original and updated items by subCategory ID
    const originalMap = new Map(order.items.map(item => [item.subCategory._id.toString(), item]));
    const updatedMap = new Map(updatedItems.map(item => [item.subCategory, item]));
    console.log("🔀 Created maps for original and updated items");

    // ➕ Detect added items (in updatedMap but not in originalMap)
    const addedItems = updatedItems.filter(item => !originalMap.has(item.subCategory));
    console.log("➕ Added Items:", addedItems);

    // ➖ Detect removed items (in originalMap but not in updatedMap)
    const removedItems = order.items.filter(item => !updatedMap.has(item.subCategory._id.toString()));
    console.log("➖ Removed Items:", removedItems);

    // 🔄 Detect quantity changes for items existing in both lists
    const quantityUpdates = [];
    for (const item of updatedItems) {
      const originalItem = originalMap.get(item.subCategory);

      if (!originalItem) {
        console.error(`❌ SubCategory ${item.subCategory} not found in original order.`);
        throw new Error(`SubCategory ${item.subCategory} not found in order.`);
      }

      console.log(`🔍 Checking quantities for SubCategory ${item.subCategory}: updated quantity = ${item.quantity}, original returned = ${originalItem.returned}`);

      // Validate quantity not less than returned
      if (item.quantity < originalItem.returned) {
        console.warn(`⚠️ Quantity (${item.quantity}) less than returned (${originalItem.returned}) for SubCategory ${item.subCategory}`);
        return res.status(400).json({
          success: false,
          message: `Quantity (${item.quantity}) cannot be less than already returned quantity (${originalItem.returned}) for SubCategory ${item.subCategory}.`
        });
      }

      if (item.quantity !== originalItem.quantity) {
        console.log(`🔄 Quantity change detected for SubCategory ${item.subCategory}: from ${originalItem.quantity} to ${item.quantity}`);
        quantityUpdates.push({
          subCategory: item.subCategory,
          oldQty: originalItem.quantity,
          newQty: item.quantity
        });
      }

      // if (originalItem && item.quantity !== originalItem.quantity) {
      //   quantityUpdates.push({ subCategory: item.subCategory, oldQty: originalItem.quantity, newQty: item.quantity });
      // }
    }
    console.log("🔄 Quantity Updates:", quantityUpdates);

    // 🚨 Handle added items — check stock and update accordingly
    for (const item of addedItems) {
      const stock = await Stock.findOne({ subCategory: item.subCategory }).populate("subCategory").session(session);
      console.log(`📉 Checking stock for added item ${stock.subCategory.name}: Available - ${stock.availableStock}, Requested - ${item.quantity}`);

      if (stock.availableStock < item.quantity) {
        console.log(`❌ Insufficient stock for ${stock.subCategory.name}`);
        throw new Error(`Insufficient stock for ${stock.subCategory.name}`);
      }

      // Update stock counts
      stock.availableStock -= item.quantity;
      stock.OnRent += item.quantity;
      await stock.save({ session });
      console.log(`✅ Stock updated for added item ${stock.subCategory.name}: Available - ${stock.availableStock}, OnRent - ${stock.OnRent}`);

      // Add rentedAt timestamp for this new item
      item.rentedAt = new Date();
    }

    // 🚨 Handle quantity updates — adjust stock accordingly
    for (const { subCategory, oldQty, newQty } of quantityUpdates) {
      const stock = await Stock.findOne({ subCategory }).populate("subCategory").session(session);
      console.log(`🔄 Adjusting quantity for ${stock.subCategory.name}: Old Qty - ${oldQty}, New Qty - ${newQty}`);

      if (newQty > oldQty) {
        // More items rented, reduce available stock
        const diff = newQty - oldQty;
        if (stock.availableStock < diff) {
          console.log(`❌ Not enough stock to increase quantity for ${stock.subCategory.name}`);
          throw new Error(`Insufficient stock for ${stock.subCategory.name} to increase quantity`);
        }
        stock.availableStock -= diff;
        stock.OnRent += diff;
      } else if (newQty < oldQty) {
        // Items returned, increase available stock
        const diff = oldQty - newQty;
        if (stock.OnRent < diff) {
          console.log(`❌ Cannot return more items than on rent for ${stock.subCategory.name}`);
          throw new Error(`Return quantity exceeds rented stock for ${stock.subCategory.name}`);
        }
        stock.availableStock += diff;
        stock.OnRent -= diff;
      }

      await stock.save({ session });
      console.log(`✅ Stock updated for quantity change on ${stock.subCategory.name}: Available - ${stock.availableStock}, OnRent - ${stock.OnRent}`);
    }

    // 🚨 Handle removed items — return all quantity to stock
    for (const item of removedItems) {
      const stock = await Stock.findOne({ subCategory: item.subCategory._id }).populate("subCategory").session(session);
      console.log(`↩️ Returning removed item ${stock.subCategory.name} to stock: Quantity - ${item.quantity}`);

      if (stock.OnRent < item.quantity) {
        console.log(`❌ Cannot return more than on rent for ${stock.subCategory.name}`);
        throw new Error(`Return quantity exceeds rented stock for ${stock.subCategory.name}`);
      }

      stock.availableStock += item.quantity;
      stock.OnRent -= item.quantity;
      await stock.save({ session });
      console.log(`✅ Stock updated for removed item ${stock.subCategory.name}: Available - ${stock.availableStock}, OnRent - ${stock.OnRent}`);
    }

    // 🔁 Replace order items with updated items
    // order.items = updatedItems.map(item => ({
    //   subCategory: item.subCategory,
    //   quantity: item.quantity,
    //   returned: originalItem ? originalItem.returned : 0, // preserve original returned value
    //   rentedAt: item.rentedAt || new Date(), // keep rentedAt if present, else set now
    // }));
    order.items = updatedItems.map(item => {
      const originalItem = originalMap.get(item.subCategory);

      console.log(`🔍 Mapping item for subCategory: ${item.subCategory}`);
      console.log(`  Original Item:`, originalItem);

      return {
        subCategory: item.subCategory,
        quantity: item.quantity,
        returned: originalItem ? originalItem.returned : 0,               // preserve original returned
        returnedAt: originalItem ? originalItem.returnedAt : null,        // preserve original returnedAt date
        rentedAt: item.rentedAt || (originalItem ? originalItem.rentedAt : new Date()), // preserve or set rentedAt
        _id: originalItem ? originalItem._id : undefined,                 // preserve original _id to avoid creating new subdocs
      };
    });


    // Check if order status needs to change back to "onrent"
    if (order.status === "returned") {
      const anyQuantityGreaterThanReturned = order.items.some(
        item => item.quantity > item.returned
      );
      if (anyQuantityGreaterThanReturned) {
        console.log("⚠️ Order status changed from 'returned' to 'onrent' due to quantity > returned");
        order.status = "onrent";
      }
    }

    // 💰 Recalculate total cost amount
    order.totalCostAmount = order.items.reduce((acc, item) => {
      // Find price from populated subCategory in original order or fallback
      const originalItem = order.items.find(i => i.subCategory.toString() === item.subCategory.toString());
      const rentalRate = originalItem?.subCategory?.rentalRate || 0;
      return acc + rentalRate * item.quantity;
    }, 0);
    console.log(`💰 Total cost recalculated: ${order.totalCostAmount}`);

    // 🗓 Update order date
    const dateToSet = updatedOrderDate ? new Date(updatedOrderDate) : new Date();
    dateToSet.setHours(0, 0, 0, 0);  // Set time to 00:00:00.000
    order.orderDate = dateToSet;
    console.log(`📅 Order date updated to (time set to 00:00:00): ${order.orderDate}`);

    // 💾 Save the order with session
    await order.save({ session });
    console.log("✅ Order document saved successfully");

    // 📝 Update order history - delete old rent history and insert new
    await OrderHistory.deleteMany({ order: orderId, actionType: "rent" }).session(session);
    await new OrderHistory({
      order: orderId,
      actionType: "rent",
      items: order.items,
      date: order.orderDate,
    }).save({ session });
    console.log("📝 Rent history updated");

    // 📝 Add return action in history with zero returned (for now)
    await new OrderHistory({
      order: orderId,
      actionType: "return",
      items: order.items.map(item => ({ ...item.toObject(), returned: 0 })),
      date: order.orderDate,
    }).save({ session });
    console.log("📝 Return history initialized");

    // 💳 Update site due amount based on new total cost
    await Site.updateOne(
      { _id: order.site },
      { $set: { dueAmount: order.totalCostAmount } },
      { session }
    );
    console.log("💳 Site due amount updated");

    // 🎉 Commit transaction and end session
    await session.commitTransaction();
    session.endSession();

    console.log("✅ Transaction committed successfully. Order update complete.");
    res.status(200).json({ success: true, message: "✅ Order updated successfully", order });
  } catch (error) {
    // 🛑 Abort transaction on error and log it
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Error in editOrder:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};


exports.returnOrderItems = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("🔄 Processing return request:", req.body);

    const { orderId, items } = req.body;

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Order ID and valid return items are required.",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      status: "onrent",
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "No active order found for this ID.",
      });
    }

    let totalReturnCost = 0;
    const historyItems = [];

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

      const maxReturnable = orderItem.quantity - orderItem.returned;
      if (returnItem.quantityReturned > maxReturnable) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Cannot return more than ${maxReturnable} items for ${returnItem.subCategory}.`,
        });
      }

      const stock = await Stock.findOne({ subCategory: returnItem.subCategory })
        .populate("subCategory", "rentalRate")
        .session(session);

      if (!stock) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Stock not found for SubCategory ${returnItem.subCategory}.`,
        });
      }

      const rentalRate = stock.subCategory.rentalRate;
      const itemReturnCost = rentalRate * returnItem.quantityReturned;
      totalReturnCost += itemReturnCost;

      orderItem.returned += returnItem.quantityReturned;
      orderItem.returnedAt = returnItem.returnedAt;

      await Stock.updateOne(
        { subCategory: returnItem.subCategory },
        {
          $inc: {
            OnRent: -returnItem.quantityReturned,
            availableStock: returnItem.quantityReturned,
          },
        },
        { session }
      );

      // 📝 Add to return history items
      historyItems.push({
        subCategory: returnItem.subCategory,
        quantity: orderItem.quantity,
        returned: returnItem.quantityReturned,
        rentedAt: orderItem.rentedAt,
        returnedAt: orderItem.returnedAt,
      });
    }

    const allReturned = order.items.every(
      (item) => item.quantity === item.returned
    );
    if (allReturned) {
      order.status = "returned";
    }

    order.totalCostAmount -= totalReturnCost;
    await order.save({ session });

    // 🧾 Record in OrderHistory
    await OrderHistory.create(
      [
        {
          actionType: "return",
          order: order._id,
          items: historyItems,
          timestamp: new Date(),
        },
      ],
      { session }
    );

    // 💰 Update site's dueAmount
    await Site.updateOne(
      { _id: order.site },
      {
        $inc: { dueAmount: -totalReturnCost },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    console.log("✅ Items successfully returned for order:", order);
    res.status(200).json({
      success: true,
      message: "Items returned successfully!",
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Error returning items:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
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

// exports.getSubcategoriesOnRentBySite = async (req, res) => {
//   try {
//     console.log("📝 [GET SUBCATEGORIES ON RENT BY SITE] API hit");

//     const { siteId } = req.body;

//     console.log("Site ID:", siteId);

//     if (!siteId) {
//       return res.status(400).json({
//         success: false,
//         message: "Site ID is required",
//       });
//     }

//     // Find all orders for the given site that are on rent
//     const orders = await Order.find({ site: siteId, status: "onrent" })
//       .populate("items.subCategory", "name")
//       .lean();

//     if (!orders.length) {
//       return res.status(404).json({
//         success: false,
//         message: "No orders found for this site or no items on rent",
//       });
//     }
//     console.log("Orders fetched");

//     // Collect subcategories and quantities
//     const subCategoryMap = new Map();

//     orders.forEach((order) => {
//       order.items.forEach((item) => {
//         const subCategoryId = item.subCategory._id.toString();
//         const subCategoryName = item.subCategory.name;
//         const qtyOnRent = item.quantity - item.returned;

//         if (subCategoryMap.has(subCategoryId)) {
//           subCategoryMap.get(subCategoryId).qtyOnRent += qtyOnRent;
//         } else {
//           subCategoryMap.set(subCategoryId, {
//             subCategoryId,
//             subCategoryName,
//             qtyOnRent,
//           });
//         }
//       });
//     });

//     const subCategoriesOnRent = Array.from(subCategoryMap.values());
//     console.log("✅ Subcategories on rent fetched successfully!");

//     res.status(200).json({
//       success: true,
//       message: "✅ Subcategories on rent fetched successfully!",
//       data: subCategoriesOnRent,
//     });
//   } catch (error) {
//     console.error("❌ [Error] Fetching subcategories on rent:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

exports.getSubcategoriesOnRentByOrder = async (req, res) => {
  try {
    console.log("📝 [GET SUBCATEGORIES ON RENT BY ORDER] API hit");

    const { orderId } = req.body;

    console.log("Order ID:", orderId);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // Find the order with status "onrent"
    const order = await Order.findOne({ _id: orderId, status: "onrent" })
      .populate("items.subCategory", "name")
      .lean();

    console.log("order", order);
    if (!order) {
      console.log("⚠️ No active order found with this ID or nothing on rent");
      return res.status(404).json({
        success: false,
        message: "No active order found with this ID or nothing on rent",
      });
    }

    console.log("Order fetched");

    // Collect subcategories and quantities
    const subCategoryMap = new Map();

    order.items.forEach((item) => {
      const subCategoryId = item.subCategory._id.toString();
      const subCategoryName = item.subCategory.name;
      const qtyOnRent = item.quantity - item.returned;

      if (qtyOnRent > 0) {
        subCategoryMap.set(subCategoryId, {
          subCategoryId,
          subCategoryName,
          qtyOnRent,
        });
      }
    });

    const subCategoriesOnRent = Array.from(subCategoryMap.values());
    console.log("✅ Subcategories on rent fetched successfully!");

    res.status(200).json({
      success: true,
      message: "✅ Subcategories on rent fetched successfully!",
      data: subCategoriesOnRent,
    });
  } catch (error) {
    console.error("❌ [Error] Fetching subcategories on rent:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.addLostOrDamagedItem = async (req, res) => {
  try {
    console.log("📝 [ADD LOST/DAMAGED ITEM] API hit");

    const { orderId, LDdate, items } = req.body;
    console.log("Order lost/damaged:", req.body);

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields or items array is empty",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    let totalLostCost = 0;
    const updates = [];

    for (const item of items) {
      const { subCategoryId, lostOrDamagedQty, pricePerItem } = item;

      if (!subCategoryId || !lostOrDamagedQty || !pricePerItem) {
        continue; // skip incomplete entries
      }

      const rentedItem = order.items.find(
        (itm) => itm.subCategory.toString() === subCategoryId
      );
      if (!rentedItem) continue;
      console.log("[rented Item]", rentedItem);

      const alreadyLostQty = order.lostOrDamagedItems
        .filter((itm) => itm.subCategory.toString() === subCategoryId)
        .reduce((sum, itm) => sum + itm.quantity, 0);

      const remainingQty = rentedItem.quantity - alreadyLostQty;
      console.log(
        "[remainingQty]",
        remainingQty,
        " = ",
        rentedItem.quantity,
        " - ",
        alreadyLostQty
      );
      console.log("[lostOrDamagedQty]", lostOrDamagedQty);
      if (lostOrDamagedQty > remainingQty) continue;

      const itemCost = lostOrDamagedQty * pricePerItem;
      totalLostCost += itemCost;

      order.lostOrDamagedItems.push({
        subCategory: subCategoryId,
        quantity: lostOrDamagedQty,
        pricePerItem,
        date: new Date(LDdate),
      });
      rentedItem.quantity -= lostOrDamagedQty;
      updates.push({
        subCategory: subCategoryId,
        quantity: lostOrDamagedQty,
        pricePerItem,
        totalLostCost: itemCost,
      });

      // ✅ Restore from stock
      const productStock = await Stock.findOne({
        subCategory: subCategoryId, // or `productId` depending on your schem
      });
      console.log(productStock, "product stock");

      if (productStock) {
        productStock.OnRent = Math.max(
          0,
          productStock.OnRent - lostOrDamagedQty
        );

        console.log(productStock, "product stock total stock");
        await productStock.save();
      }
    }

    order.totalCostAmount += totalLostCost;
    await order.save();
    console.log(" Order updated with lost/damaged items", order);

    const site = await Site.findById(order.site);
    if (site) {
      site.dueAmount += totalLostCost;
      await site.save();
    }

    res.status(200).json({
      success: true,
      message: "✅ Lost/Damaged items added successfully!",
      totalLostCost,
      addedItems: updates,
    });
  } catch (error) {
    console.error("❌ [Error] Adding lost/damaged items:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getOrdersBySite = async (req, res) => {
  try {
    const { siteId } = req.body;
    console.log(`🔍 Searching for site with ID: ${siteId}`);

    // Find the site and populate its orders
    const site = await Site.findById(siteId)
      .populate({
        path: "orders",
        populate: [
          {
            path: "items.subCategory", // ✅ Populate subcategory details
            select: "name rentalRate",
          },
          {
            path: "customer", // ✅ Populate customer details if needed
            select: "name address phone",
          },
          {
            path: "site",
            select: "sitename",
          },
          {
            path: "lostOrDamagedItems.subCategory",
            select: "name",
          },
          {
            path: "lostOrDamagedItems",
            select: "quantity",
          },
        ],
      })
      .exec();

    if (!site) {
      console.warn(`⚠️ Site not found for ID: ${siteId}`);
      return res.status(404).json({ message: "Site not found" });
    }

    console.log(`✅ Site found! (${site._id})`);
    console.log(`📦 Orders count: ${site.orders}`);

    res.status(200).json({
      success: true,
      message: "✅ Site orders fetched successfully!",
      orders: site.orders,
    });
  } catch (error) {
    console.error(`❌ Error fetching site orders:`, error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getReturnedOrderItems = async (req, res) => {
  try {
    const { siteId } = req.body;
    console.log(`🔍 Searching for site with ID: ${siteId}`);

    // Step 1: Find the site with returned orders only
    const site = await Site.findById(siteId).populate({
      path: "orders",
      match: { "items.returned": { $gt: 0 } },
      populate: [
        {
          path: "items.subCategory",
          select: "name rentalRate",
        },
        {
          path: "customer",
          select: "name address phone",
        },
        {
          path: "site",
          select: "sitename",
        },
        {
          path: "lostOrDamagedItems.subCategory",
          select: "name",
        },
      ],
    });

    if (!site) {
      console.warn(`⚠️ Site not found for ID: ${siteId}`);
      return res.status(404).json({ message: "Site not found" });
    }

    // Step 2: For each order, fetch related orderHistory entries (actionType: 'return')
    const ordersWithHistory = await Promise.all(
      site.orders.map(async (order) => {
        const orderHistories = await OrderHistory.find({
          order: order._id,
          actionType: "return",
        })
          .populate("items.subCategory", "name rentalRate")
          .sort({ createdAt: -1 }); // Optional: latest first

        return {
          ...order.toObject(),
          orderHistory: orderHistories,
        };
      })
    );

    console.log(`✅ Orders with returned items: ${ordersWithHistory.length}`);
    res.status(200).json({
      success: true,
      message: "✅ Orders with returned items fetched successfully!",
      orders: ordersWithHistory,
    });
  } catch (error) {
    console.error(`❌ Error fetching returned orders:`, error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getOrdersByCustomer = async (req, res) => {
  try {
    const { customerId } = req.body;
    console.log(`📝 [GET ORDERS BY CUSTOMER] API hit`);
    console.log(`🔍 Fetching orders for customer ID: ${customerId}`);

    const orders = await Order.find({ customer: customerId })
      .populate("customer", "name phone address")
      .populate("items.subCategory", "name rentalRate")
      .sort({ createdAt: -1 })
      .exec();

    if (!orders.length) {
      console.log("⚠️ No orders found for this customer.");
      return res
        .status(404)
        .json({ message: "No orders found for this customer." });
    }

    // ✅ Fetch return orderHistory for each order
    const ordersWithHistory = await Promise.all(
      orders.map(async (order) => {
        const orderHistories = await OrderHistory.find({
          order: order._id,
          actionType: "return",
        })
          .populate("items.subCategory", "name rentalRate")
          .sort({ createdAt: -1 });

        return {
          ...order.toObject(),
          orderHistory: orderHistories,
        };
      })
    );
    console.log(ordersWithHistory, "ordersWithHistory.length");

    console.log(`✅ Found ${orders.length} orders for customer.`);
    res.status(200).send({ success: true, orders: ordersWithHistory });
  } catch (error) {
    console.error("❌ Error fetching customer orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    console.log(`🗑️ Attempting to delete order: ${orderId}`);

    // Fetch order
    const order = await Order.findById(orderId);
    if (!order) {
      console.log("❌ Order not found.");
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if all items are returned
    const hasPendingReturns = order.items.some(
      (item) => item.quantity !== item.returned
    );
    if (hasPendingReturns) {
      console.log("⚠️ Cannot delete: Some items are not fully returned.");
      return res.status(400).json({
        message: "Cannot delete order: All items must be fully returned.",
      });
    }

    // Delete order
    await Order.findByIdAndDelete(orderId);
    console.log("✅ Order deleted successfully.");

    // Remove order reference from the Site schema
    await Site.updateOne({ orders: orderId }, { $pull: { orders: orderId } });

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.log("❌ Error deleting order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    console.log("📜 [GET ORDER HISTORY] API hit");

    const { orderId } = req.body;
    console.log("Order ID:", orderId);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const rentHistory = await OrderHistory.find({
      order: orderId,
      actionType: "rent",
    })
      .populate("items.subCategory", "name")
      .sort({ timestamp: 1 }) // oldest to newest
      .lean();

    const formattedHistory = rentHistory.map((entry) => ({
      timestamp: new Date(entry.timestamp).toLocaleString(),
      rentedItems: entry.items.map((item) => ({
        subCategory: item.subCategory?.name || "Unknown",
        quantity: item.quantity,
        rentedAt: item.rentedAt
          ? new Date(item.rentedAt).toLocaleString()
          : "N/A",
        returnedAt: item.returnedAt
          ? new Date(item.returnedAt).toLocaleString()
          : "N/A",
        returned: item.returned || 0,
      })),
    }));

    res.status(200).json({
      success: true,
      message: "✅ Rent history fetched successfully",
      data: formattedHistory,
    });
  } catch (error) {
    console.error("❌ [Error] Fetching rent history:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
