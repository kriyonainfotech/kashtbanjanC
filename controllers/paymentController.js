const Payment = require("../models/payment");
const Site = require("../models/site");
const Order = require("../models/order");
const OrderHistory = require("../models/orderHistory");
const mongoose = require("mongoose");

// exports.addPayment = async (req, res) => {
//   try {
//     console.log("📥 Received Payment Request:", req.body);

//     const { site, order, customer, amount, paymentMethod,paymentType, remarks } = req.body;

//     // ✅ Validate required fields
//     if (!site || !customer || !amount || !paymentMethod) {
//       console.log("❌ Missing required fields!");
//       return res.status(400).json({
//         success: false,
//         message: "Site, customer, amount, and payment method are required.",
//       });
//     }

//     console.log("✅ Validation Passed! Creating payment record...");

//     // ✅ Create new payment
//     const payment = await Payment.create({
//       site,
//       order,
//       customer,
//       amount,
//       paymentMethod,paymentType,
//       remarks,
//       status: "Completed", // Default status
//     });

//     console.log("💰 Payment Created Successfully:", payment);

//     // ✅ Attach payment to the site
//     await Site.updateOne({ _id: site }, { $push: { payments: payment._id } });

//     console.log("🔗 Payment linked to Site:", site);

//     res.status(201).json({
//       success: true,
//       message: "✅ Payment added successfully!",
//       payment,
//     });
//   } catch (error) {
//     console.error("🔥 Error adding payment:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

// exports.addPayment = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction(); // 🔄 Start transaction

//   try {
//     console.log("📥 Received Payment Request:", req.body);

//     const {
//       site,
//       order,
//       customer,
//       amount,
//       paymentMethod,
//       paymentType,
//       remarks,
//     } = req.body;

//     if (!site || !customer || !amount || !paymentMethod) {
//       console.log("❌ Missing required fields!");
//       return res.status(400).json({
//         success: false,
//         message: "Site, customer, amount, and payment method are required.",
//       });
//     }

//     console.log("✅ Validation Passed! Checking site existence...");

//     const existingSite = await Site.findById(site).session(session);
//     if (!existingSite) {
//       console.log("❌ Site not found:", site);
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, message: "Site not found." });
//     }

//     console.log("✅ Site verified! Creating payment record...");

//     const payment = await Payment.create(
//       [
//         {
//           site,
//           order,
//           customer,
//           amount,
//           paymentMethod,
//           paymentType,
//           remarks,
//           status: "Completed",
//           date: new Date(),
//         },
//       ],
//       { session }
//     );

//     console.log("💰 Payment Created Successfully:", payment);

//     // 🔥 Reduce dueAmount by payment amount
//     const updatedDueAmount = Math.max(0, existingSite.dueAmount - amount);

//     // ✅ Add history entry
//     const historyEntry = {
//       actionType: "payment",
//       order: order || null,
//       details: { amount, paymentMethod, paymentType, remarks },
//       timestamp: new Date(),
//     };

//     // ✅ Update the site's dueAmount, add payment ID, and push history
//     await Site.updateOne(
//       { _id: site },
//       {
//         $set: { dueAmount: updatedDueAmount },
//         $push: {
//           payments: payment[0]._id,
//           history: historyEntry, // 🔥 Adding history here
//         },
//       },
//       { session }
//     );

//     console.log("🔗 Payment linked to Site, dueAmount updated & history added");

//     await session.commitTransaction(); // ✅ Commit transaction
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       message: "✅ Payment added successfully!",
//       payment: payment[0],
//       updatedDueAmount,
//     });
//   } catch (error) {
//     await session.abortTransaction(); // 🚨 Rollback on error
//     session.endSession();

//     console.error("🔥 Error adding payment:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

exports.addPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      site,
      order,
      customer,
      amount,
      paymentMethod,
      paymentType,
      remarks,
      date,
    } = req.body;

    console.log("📝 New Payment Request Received", req.body);

    // 🔍 Basic validation
    if (!site || !customer || !amount || !paymentMethod || !paymentType) {
      await session.abortTransaction();
      session.endSession();
      console.log("❗ Missing required payment fields.");
      return res.status(400).json({
        success: false,
        message: "Missing required payment fields.",
      });
    }

    // 🧾 Create the payment
    const payment = new Payment({
      site,
      order,
      customer,
      amount,
      paymentMethod,
      paymentType,
      remarks,
      date,
    });

    await payment.save({ session });
    console.log("💰 Payment Saved:", payment);

    // 💸 Update dueAmount based on paymentType
    if (
      paymentType === "HalfPayment" ||
      paymentType === "FullPayment" ||
      paymentType === "Discount"
    ) {
      await Site.updateOne(
        { _id: site },
        { $inc: { dueAmount: -amount } },
        { session }
      );
      console.log(
        `🏦 Site (${site}) dueAmount updated by ₹${amount} - ${paymentType}`
      );
    }

    // 🔗 If order is linked, push payment ID and check payment completion
    if (order) {
      const orderDoc = await Order.findById(order)
        .populate("payments")
        .session(session);

      if (!orderDoc) {
        throw new Error("Order not found");
      }

      // Push new payment
      orderDoc.payments = orderDoc.payments || [];
      orderDoc.payments.push(payment._id);

      // 🧮 Calculate total paid amount (existing + new)
      const existingTotal = orderDoc.payments.reduce((acc, pay) => {
        return acc + (pay.amount || 0);
      }, 0);

      const totalPaid = existingTotal + amount;
      console.log(
        `💳 Total paid after this: ₹${totalPaid}, Order Total: ₹${orderDoc.totalCostAmount}`
      );

      // ✅ If fully paid, mark paymentDone
      if (totalPaid >= orderDoc.totalCostAmount) {
        orderDoc.paymentDone = true;
        console.log("✅ Payment completed. Marking order as fully paid.");
      }

      await orderDoc.save({ session });
      console.log(`📌 Payment ID (${payment._id}) pushed to Order (${order})`);
    }

    await session.commitTransaction();
    session.endSession();

    console.log("✅ Payment transaction committed successfully.");
    return res.status(201).json({
      success: true,
      message: "✅ Payment added successfully",
      payment,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Error adding payment:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while adding payment.",
    });
  }
};

// exports.editPayment = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction(); // 🔄 Start transaction

//   try {
//     console.log("✏️ [EDIT PAYMENT] API hit");

//     const { paymentId, amount, paymentMethod, paymentType, remarks } = req.body;

//     // ✅ Validate required fields
//     if (!paymentId || !amount || !paymentMethod) {
//       console.warn("⚠️ [Validation Failed] Missing required fields");
//       return res.status(400).json({
//         success: false,
//         message: "Payment ID, amount, and payment method are required!",
//       });
//     }

//     // ✅ Check if payment exists
//     const existingPayment = await Payment.findById(paymentId).session(session);
//     if (!existingPayment) {
//       console.log("⚠️ [Payment Not Found]:", paymentId);
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({
//         success: false,
//         message: "Payment does not exist!",
//       });
//     }

//     console.log("🔧 [Updating Payment] ID:", paymentId);

//     // 🔥 Fetch the related site
//     const existingSite = await Site.findById(existingPayment.site).session(
//       session
//     );
//     if (!existingSite) {
//       console.log(
//         "❌ [Site Not Found] Linked to Payment:",
//         existingPayment.site
//       );
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, message: "Site not found." });
//     }

//     // 🔄 Recalculate dueAmount based on the new payment amount
//     const oldAmount = existingPayment.amount;
//     const amountDifference = amount - oldAmount;
//     const updatedDueAmount = Math.max(
//       0,
//       existingSite.dueAmount - amountDifference
//     );

//     // ✅ Update payment details
//     const updatedPayment = await Payment.findByIdAndUpdate(
//       paymentId,
//       { amount, paymentMethod, paymentType, remarks },
//       { new: true, runValidators: true, session }
//     );

//     console.log(`✅ [Payment Updated] ID: ${updatedPayment._id}`);

//     // ✅ Add history entry for the update
//     const historyEntry = {
//       actionType: "payment",
//       order: existingPayment.order || null,
//       details: { amount, paymentMethod, paymentType, remarks, edited: true },
//       timestamp: new Date(),
//     };

//     // ✅ Update the site's dueAmount & add history
//     await Site.updateOne(
//       { _id: existingPayment.site },
//       {
//         $set: { dueAmount: updatedDueAmount },
//         $push: { history: historyEntry }, // 🔥 Adding history entry
//       },
//       { session }
//     );

//     console.log("🔗 [Site Updated] dueAmount & History Updated");

//     await session.commitTransaction(); // ✅ Commit transaction
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: "🎉 Payment updated successfully",
//       payment: updatedPayment,
//       updatedDueAmount,
//     });
//   } catch (error) {
//     await session.abortTransaction(); // 🚨 Rollback on error
//     session.endSession();

//     console.error("❌ [Error] Updating Payment:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

exports.deletePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // 🔄 Start transaction

  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      console.log("❌ [Missing Payment ID]");
      return res.status(400).json({
        success: false,
        message: "Payment ID is required!",
      });
    }

    console.log("❌ [Deleting Payment] Deleting payment:", paymentId);

    // ✅ Find the payment record
    const existingPayment = await Payment.findById(paymentId).session(session);
    if (!existingPayment) {
      console.log("⚠️ [Payment Not Found]:", paymentId);
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Payment does not exist!",
      });
    }

    // 🔥 Fetch the related site
    const existingSite = await Site.findById(existingPayment.site).session(
      session
    );
    if (!existingSite) {
      console.log(
        "❌ [Site Not Found] Linked to Payment:",
        existingPayment.site
      );
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "Site not found." });
    }

    // 🔄 Adjust dueAmount by adding back the deleted payment amount
    const updatedDueAmount = existingSite.dueAmount + existingPayment.amount;

    // ✅ Add history entry for deletion
    const historyEntry = {
      actionType: "payment_deleted",
      order: existingPayment.order || null,
      details: {
        amount: existingPayment.amount,
        paymentMethod: existingPayment.paymentMethod,
        paymentType: existingPayment.paymentType,
        remarks: existingPayment.remarks,
      },
      timestamp: new Date(),
    };

    // ✅ Remove payment reference & update dueAmount & history in Site
    await Site.updateOne(
      { _id: existingPayment.site },
      {
        $set: { dueAmount: updatedDueAmount },
        $pull: { payments: paymentId }, // 🔥 Remove payment reference
        $push: { history: historyEntry }, // 🔥 Add deletion history
      },
      { session }
    );

    // ✅ Delete the payment record
    await Payment.findByIdAndDelete(paymentId, { session });

    console.log(`✅ [Payment Deleted] ID: ${paymentId}`);
    console.log("🔗 [Site Updated] dueAmount & History Updated");

    await session.commitTransaction(); // ✅ Commit transaction
    session.endSession();

    res.status(200).json({
      success: true,
      message: "✅ Payment deleted successfully!",
      updatedDueAmount,
    });
  } catch (error) {
    await session.abortTransaction(); // 🚨 Rollback on error
    session.endSession();

    console.error("❌ [Error] Deleting Payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getPaymentByOrder = async (req, res) => {
  const { orderId } = req.body;

  console.log(
    "📥 [Request Received] getPaymentByOrder with orderId:",
    req.body
  );

  if (!orderId) {
    console.log("❌ [Validation Error] Missing Order ID");
    return res.status(400).json({
      success: false,
      message: "Order ID is required!",
    });
  }

  try {
    console.log("🔍 [Querying] Fetching payment related to order...");

    const payment = await Payment.find({ order: orderId })
      .sort({ createdAt: -1 })
      .populate("site", "sitename");

    if (!payment || payment.length === 0) {
      console.log("⚠️ [No Payment Found] For Order ID:", orderId);
      return res.status(404).json({
        success: false,
        message: "Payment does not exist!",
      });
    }

    console.log("✅ [Success] Payment(s) found for Order:", orderId);
    console.log("📦 [Payment Data]:", payment, payment.length);

    res.status(200).json({
      success: true,
      message: "Payment found!",
      payment,
    });
  } catch (error) {
    console.error("💥 [Server Error] While getting payment by order:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.editPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      paymentId, // paymentId is must for editing
      site,
      order,
      customer,
      amount,
      paymentMethod,
      paymentType,
      remarks,
      date,
    } = req.body;

    console.log("✏️ Edit Payment Request Received", req.body);

    if (!paymentId) {
      await session.abortTransaction();
      session.endSession();
      console.log("❗ Missing paymentId.");
      return res.status(400).json({
        success: false,
        message: "Payment ID is required.",
      });
    }

    const existingPayment = await Payment.findById(paymentId).session(session);
    if (!existingPayment) {
      await session.abortTransaction();
      session.endSession();
      console.log("❗ Payment not found.");
      return res.status(404).json({
        success: false,
        message: "Payment not found.",
      });
    }

    // 🧮 Reverse old dueAmount if old paymentType affects it
    if (
      existingPayment.paymentType === "HalfPayment" ||
      existingPayment.paymentType === "FullPayment" ||
      existingPayment.paymentType === "Discount"
    ) {
      await Site.updateOne(
        { _id: existingPayment.site },
        { $inc: { dueAmount: existingPayment.amount } },
        { session }
      );
      console.log(`↩️ Reversed old dueAmount ₹${existingPayment.amount}`);
    }

    // 📝 Update only provided fields
    if (site) existingPayment.site = site;
    if (order) existingPayment.order = order;
    if (customer) existingPayment.customer = customer;
    if (amount !== undefined) existingPayment.amount = amount; // amount can be 0
    if (paymentMethod) existingPayment.paymentMethod = paymentMethod;
    if (paymentType) existingPayment.paymentType = paymentType;
    if (remarks) existingPayment.remarks = remarks;
    if (date) existingPayment.date = date;

    await existingPayment.save({ session });
    console.log("✏️ Payment updated:", existingPayment);

    // 💵 Apply new dueAmount adjustment if new paymentType affects it
    if (
      existingPayment.paymentType === "HalfPayment" ||
      existingPayment.paymentType === "FullPayment" ||
      existingPayment.paymentType === "Discount"
    ) {
      await Site.updateOne(
        { _id: existingPayment.site },
        { $inc: { dueAmount: -existingPayment.amount } },
        { session }
      );
      console.log(`🏦 Updated dueAmount by ₹${existingPayment.amount}`);
    }

    // 🔗 If order exists, recheck paymentDone status
    if (existingPayment.order) {
      const orderDoc = await Order.findById(existingPayment.order)
        .populate("payments")
        .session(session);

      if (!orderDoc) {
        throw new Error("Order not found");
      }

      // 🧮 Recalculate total paid
      const totalPaid = orderDoc.payments.reduce((acc, pay) => {
        return acc + (pay.amount || 0);
      }, 0);

      orderDoc.paymentDone = totalPaid >= orderDoc.totalCostAmount;
      await orderDoc.save({ session });

      console.log(
        `💳 Rechecked total paid ₹${totalPaid}, Order total ₹${orderDoc.totalCostAmount}`
      );
    }

    await session.commitTransaction();
    session.endSession();

    console.log("✅ Payment edit transaction committed successfully.");
    return res.status(200).json({
      success: true,
      message: "✅ Payment updated successfully",
      payment: existingPayment,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Error editing payment:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while editing payment.",
    });
  }
};

