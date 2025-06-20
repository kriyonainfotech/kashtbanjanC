// // 📁 utils/fixOrderHistories.js

// const mongoose = require("mongoose");
// const Order = require("../models/order");
// const OrderHistory = require("../models/orderHistory");
// const Site = require("../models/site");

// exports.fixOrderHistoriesForSite = async (siteId) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         console.log(`🛠️ Starting Order History Fix for Site: ${siteId}\n`);

//         const site = await Site.findById(siteId).session(session);
//         if (!site) {
//             console.log(`❌ Site not found for ID: ${siteId}`);
//             return;
//         }

//         console.log(`🏢 Site: ${site.sitename} (${site._id})`);

//         const orders = await Order.find({ site: siteId })
//             .populate("items.subCategory")
//             .session(session);

//         if (!orders.length) {
//             console.log("📭 No orders found under this site.");
//             return;
//         }

//         console.log(`📦 Total Orders Found: ${orders.length}\n`);

//         let updatedCount = 0;

//         for (const order of orders) {
//             console.log(`🔍 Processing Order: ${order.invoiceNo} (${order._id})`);

//             const histories = await OrderHistory.find({ order: order._id }).session(session);

//             const newHistoryIds = [];
//             const itemMapFromOrder = new Map();

//             order.items.forEach(item => {
//                 itemMapFromOrder.set(item.subCategory._id?.toString() || item.subCategory.toString(), {
//                     quantity: item.quantity,
//                     returned: item.returned,
//                     rentedAt: item.rentedAt || order.orderDate,
//                     returnedAt: item.returnedAt || null
//                 });
//             });

//             // === R E N T   H I S T O R Y ===
//             let rentHistory = histories.find(h => h.actionType === "rent");
//             if (rentHistory) {
//                 let isModified = false;

//                 for (let hItem of rentHistory.items) {
//                     const id = hItem.subCategory.toString();
//                     const orderItem = itemMapFromOrder.get(id);

//                     if (!orderItem) continue;

//                     // Update quantity & rentedAt if incorrect
//                     if (hItem.quantity !== orderItem.quantity || !hItem.rentedAt || hItem.rentedAt.getTime() !== orderItem.rentedAt.getTime()) {
//                         console.log(`✏️ Updating Rent Item → ${id}`);
//                         hItem.quantity = orderItem.quantity;
//                         hItem.rentedAt = orderItem.rentedAt;
//                         isModified = true;
//                     }
//                 }

//                 // Also add any missing items
//                 for (let [subCatId, orderItem] of itemMapFromOrder) {
//                     const exists = rentHistory.items.find(i => i.subCategory.toString() === subCatId);
//                     if (!exists) {
//                         console.log(`➕ Adding Missing Rent Item → ${subCatId}`);
//                         rentHistory.items.push({
//                             subCategory: subCatId,
//                             quantity: orderItem.quantity,
//                             rentedAt: orderItem.rentedAt,
//                             returned: 0,
//                             returnedAt: null
//                         });
//                         isModified = true;
//                     }
//                 }

//                 if (isModified) {
//                     rentHistory.timestamp = new Date();
//                     await rentHistory.save({ session });
//                     console.log(`✅ Rent History Updated (${rentHistory._id})`);
//                 } else {
//                     console.log("✅ Rent History Already Correct");
//                 }
//             } else {
//                 // No rent history → Create
//                 const rentItems = order.items.map(item => ({
//                     subCategory: item.subCategory._id || item.subCategory,
//                     quantity: item.quantity,
//                     rentedAt: item.rentedAt || order.orderDate,
//                     returned: 0,
//                     returnedAt: null,
//                 }));

//                 rentHistory = await OrderHistory.create([{
//                     order: order._id,
//                     actionType: "rent",
//                     items: rentItems,
//                     date: order.orderDate,
//                     timestamp: new Date()
//                 }], { session });

//                 console.log(`🧾 Rent History Created 🆕 → ${rentHistory[0]._id}`);
//                 newHistoryIds.push(rentHistory[0]._id);
//             }

//             // === R E T U R N   H I S T O R Y ===
//             const hasReturnedItems = order.items.some(item => item.returned > 0);
//             let returnHistory = histories.find(h => h.actionType === "return");

//             if (returnHistory || hasReturnedItems) {
//                 if (!returnHistory) {
//                     const returnItems = order.items
//                         .filter(item => item.returned > 0)
//                         .map(item => ({
//                             subCategory: item.subCategory._id || item.subCategory,
//                             quantity: item.quantity,
//                             returned: item.returned,
//                             rentedAt: item.rentedAt || order.orderDate,
//                             returnedAt: item.returnedAt || new Date()
//                         }));

//                     returnHistory = await OrderHistory.create([{
//                         order: order._id,
//                         actionType: "return",
//                         items: returnItems,
//                         date: order.orderDate,
//                         timestamp: new Date()
//                     }], { session });

//                     console.log(`🔁 Return History Created 🆕 → ${returnHistory[0]._id}`);
//                     newHistoryIds.push(returnHistory[0]._id);
//                 } else {
//                     let isModified = false;

//                     for (let hItem of returnHistory.items) {
//                         const id = hItem.subCategory.toString();
//                         const orderItem = itemMapFromOrder.get(id);

//                         if (!orderItem) continue;

//                         if (
//                             hItem.returned !== orderItem.returned ||
//                             hItem.returnedAt?.getTime() !== orderItem.returnedAt?.getTime()
//                         ) {
//                             console.log(`✏️ Updating Return Item → ${id}`);
//                             hItem.returned = orderItem.returned;
//                             hItem.returnedAt = orderItem.returnedAt;
//                             isModified = true;
//                         }
//                     }

//                     // Add new ones if not already
//                     for (let [subCatId, orderItem] of itemMapFromOrder) {
//                         const exists = returnHistory.items.find(i => i.subCategory.toString() === subCatId);
//                         if (!exists && orderItem.returned > 0) {
//                             console.log(`➕ Adding Missing Return Item → ${subCatId}`);
//                             returnHistory.items.push({
//                                 subCategory: subCatId,
//                                 quantity: orderItem.quantity,
//                                 returned: orderItem.returned,
//                                 rentedAt: orderItem.rentedAt,
//                                 returnedAt: orderItem.returnedAt
//                             });
//                             isModified = true;
//                         }
//                     }

//                     if (isModified) {
//                         returnHistory.timestamp = new Date();
//                         await returnHistory.save({ session });
//                         console.log(`✅ Return History Updated (${returnHistory._id})`);
//                     } else {
//                         console.log("✅ Return History Already Correct");
//                     }
//                 }
//             }

//             // 🔗 Attach missing history refs
//             const existingIds = order.orderHistory.map(id => id.toString());
//             for (let hist of [rentHistory, returnHistory]) {
//                 if (hist && !existingIds.includes(hist._id.toString())) {
//                     order.orderHistory.push(hist._id);
//                     console.log(`🔗 Linked History → ${hist._id}`);
//                 }
//             }

//             if (newHistoryIds.length) {
//                 await order.save({ session });
//                 console.log(`💾 Order updated with new history references.`);
//                 updatedCount++;
//             }

//             console.log("------------------------------------------------------\n");
//         }

//         await session.commitTransaction();
//         session.endSession();

//         console.log(`✅ DONE: Fixed order histories for ${updatedCount} order(s) under site '${site.sitename}'\n`);
//     } catch (err) {
//         await session.abortTransaction();
//         session.endSession();
//         console.error("❌ ERROR:", err.message);
//     }
// };

