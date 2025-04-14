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
    console.log("💰 Payment Saved:", payment._id);

    // 💸 Reduce dueAmount in Site
    await Site.updateOne(
      { _id: site },
      { $inc: { dueAmount: -amount } },
      { session }
    );
    console.log(`🏦 Site (${site}) dueAmount reduced by ₹${amount}`);

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


exports.editPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // 🔄 Start transaction

  try {
    console.log("✏️ [EDIT PAYMENT] API hit");

    const { paymentId, amount, paymentMethod, paymentType, remarks } = req.body;

    // ✅ Validate required fields
    if (!paymentId || !amount || !paymentMethod) {
      console.warn("⚠️ [Validation Failed] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Payment ID, amount, and payment method are required!",
      });
    }

    // ✅ Check if payment exists
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

    console.log("🔧 [Updating Payment] ID:", paymentId);

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

    // 🔄 Recalculate dueAmount based on the new payment amount
    const oldAmount = existingPayment.amount;
    const amountDifference = amount - oldAmount;
    const updatedDueAmount = Math.max(
      0,
      existingSite.dueAmount - amountDifference
    );

    // ✅ Update payment details
    const updatedPayment = await Payment.findByIdAndUpdate(
      paymentId,
      { amount, paymentMethod, paymentType, remarks },
      { new: true, runValidators: true, session }
    );

    console.log(`✅ [Payment Updated] ID: ${updatedPayment._id}`);

    // ✅ Add history entry for the update
    const historyEntry = {
      actionType: "payment",
      order: existingPayment.order || null,
      details: { amount, paymentMethod, paymentType, remarks, edited: true },
      timestamp: new Date(),
    };

    // ✅ Update the site's dueAmount & add history
    await Site.updateOne(
      { _id: existingPayment.site },
      {
        $set: { dueAmount: updatedDueAmount },
        $push: { history: historyEntry }, // 🔥 Adding history entry
      },
      { session }
    );

    console.log("🔗 [Site Updated] dueAmount & History Updated");

    await session.commitTransaction(); // ✅ Commit transaction
    session.endSession();

    res.status(200).json({
      success: true,
      message: "🎉 Payment updated successfully",
      payment: updatedPayment,
      updatedDueAmount,
    });
  } catch (error) {
    await session.abortTransaction(); // 🚨 Rollback on error
    session.endSession();

    console.error("❌ [Error] Updating Payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

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


