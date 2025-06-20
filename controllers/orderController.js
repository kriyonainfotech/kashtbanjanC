const mongoose = require("mongoose");
const moment = require("moment");
const Order = require("../models/order");
const Stock = require("../models/stock");
const OrderHistory = require("../models/orderHistory");
const Site = require("../models/site");

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
      actionType: "onrent",
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

const syncRentHistory = async (order, session) => {
  if (!order || !order._id || !Array.isArray(order.items)) {
    throw new Error("Invalid order data passed to syncRentHistory");
  }

  let rentHistory = await OrderHistory.findOne({
    order: order._id,
    actionType: "onrent",
  }).session(session);

  if (!rentHistory) {
    rentHistory = new OrderHistory({
      order: order._id,
      actionType: "onrent",
      items: order.items.map(i => ({
        subCategory: i.subCategory,
        quantity: i.quantity,
        rentedAt: i.rentedAt,
        returned: i.returned || 0,
        returnedAt: i.returnedAt || null,
      })),
      timestamp: new Date(),
      date: order.orderDate,
    })
  } else {
    // Update existing "onrent" history
    // Ensure you are updating `items` correctly to reflect the current state of the order
    // It looks like your existing logic here is trying to do that, but ensure it's robust.
    const updatedMap = new Map();
    order.items.forEach(item => {
      // It's important here to preserve `returned` and `returnedAt` from the *original*
      // rentHistory.items if they exist, and only update quantity and rentedAt
      // based on the current order.
      const existingHistoryItem = rentHistory.items.find(historyItem =>
        historyItem.subCategory.toString() === item.subCategory.toString()
      );

      updatedMap.set(item.subCategory.toString(), {
        subCategory: item.subCategory,
        quantity: item.quantity,
        // Preserve original rentedAt if it's an existing item, otherwise use current order's rentedAt
        rentedAt: existingHistoryItem ? existingHistoryItem.rentedAt : item.rentedAt,
        // Preserve original returned and returnedAt from history
        returned: existingHistoryItem ? existingHistoryItem.returned : (item.returned || 0),
        returnedAt: existingHistoryItem ? existingHistoryItem.returnedAt : (item.returnedAt || null),
      });
    });

    rentHistory.items = Array.from(updatedMap.values());
    rentHistory.timestamp = new Date();
    rentHistory.date = order.orderDate;
  }

  // } else {
  //   const updatedMap = new Map();
  //   order.items.forEach(item => {
  //     updatedMap.set(item.subCategory.toString(), {
  //       subCategory: item.subCategory,
  //       quantity: item.quantity,
  //       rentedAt: item.rentedAt,
  //       returned: item.returned || 0,
  //       returnedAt: item.returnedAt || null,
  //     });
  //   });

  //   rentHistory.items = Array.from(updatedMap.values());
  //   rentHistory.timestamp = new Date();
  //   rentHistory.date = order.orderDate;
  // }

  await rentHistory.save({ session });

  // 🔗 Make sure order has this history ID linked
  if (!order.orderHistory.includes(rentHistory._id)) {
    order.orderHistory.push(rentHistory._id);
    await order.save({ session });
  }
};

const syncReturnHistory = async (order, returnItems, session) => {
  if (!order || !order._id || !Array.isArray(returnItems)) {
    throw new Error("Invalid order/returnItems data for return history sync");
  }

  let returnHistory = await OrderHistory.findOne({
    order: order._id,
    actionType: "return",
  }).session(session);

  const itemMap = new Map();

  if (returnHistory) {
    // Step 1: Load existing return items
    returnHistory.items.forEach((item) => {
      itemMap.set(item.subCategory.toString(), { ...item._doc });
    });

    // Step 2: Merge new return items
    for (let newItem of returnItems) {
      const id = newItem.subCategory.toString();
      if (itemMap.has(id)) {
        const existing = itemMap.get(id);
        existing.returned += newItem.returned;
        existing.returnedAt = newItem.returnedAt || new Date();
      } else {
        itemMap.set(id, {
          ...newItem,
          returned: newItem.returned || 0,
          returnedAt: newItem.returnedAt || new Date(),
        });
      }
    }

    returnHistory.items = Array.from(itemMap.values());
    returnHistory.timestamp = new Date();
  } else {
    // No history? Create fresh
    returnHistory = new OrderHistory({
      order: order._id,
      actionType: "return",
      items: returnItems.map(item => ({
        subCategory: item.subCategory,
        quantity: item.quantity,
        rentedAt: item.rentedAt,
        returned: item.returned || 0,
        returnedAt: item.returnedAt || new Date(),
      })),
      timestamp: new Date(),
    });
  }

  await returnHistory.save({ session });

  // Link to order if not already
  if (!order.orderHistory.includes(returnHistory._id)) {
    order.orderHistory.push(returnHistory._id);
    await order.save({ session });
  }
};

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

    const originalMap = new Map(order.items.map(item => [item.subCategory._id.toString(), item]));
    const updatedMap = new Map(updatedItems.map(item => [item.subCategory.toString(), item]));

    const addedItems = updatedItems.filter(item => !originalMap.has(item.subCategory.toString()));
    const removedItems = order.items.filter(item => !updatedMap.has(item.subCategory._id.toString()));

    console.log("🗺️ Original Map Keys:", [...originalMap.keys()]);
    console.log("🗺️ Updated Map Keys:", [...updatedMap.keys()]);

    // 🔄 Detect quantity changes for items existing in both lists
    const quantityUpdates = [];
    for (const item of updatedItems) {

      const subCategoryId = item.subCategory.toString();
      const originalItem = originalMap.get(subCategoryId);

      if (!originalItem) {
        console.warn(`❌ SubCategory ${subCategoryId} not found in original order. ➕ Treating as added item.`);
        addedItems.push(item); // Add to addedItems if not already
        order.items.push({
          subCategory: item.subCategory,
          quantity: item.quantity,
          returned: 0,
          rentedAt: new Date(),
        });
        continue;
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
    const allReturned = order.items.every(item => item.quantity === item.returned);
    const somePending = order.items.some(item => item.quantity > item.returned);

    if (allReturned && order.status !== "returned") {
      console.log("✅ All items returned. Changing order status to 'returned'");
      order.status = "returned";
    } else if (somePending && order.status === "returned") {
      console.log("⚠️ Items still pending return. Changing order status to 'onrent'");
      order.status = "onrent";
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

    await syncRentHistory(order, session);

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

    await syncReturnHistory(order, historyItems, session);

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

    console.log("✅ Orders with returned items:", JSON.stringify(ordersWithHistory, null, 2));

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
      actionType: "onrent",
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
