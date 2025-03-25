const Payment = require("../models/payment");
const Site = require("../models/site");

exports.addPayment = async (req, res) => {
  try {
    console.log("📥 Received Payment Request:", req.body);

    const { site, order, customer, amount, paymentMethod,paymentType, remarks } = req.body;

    // ✅ Validate required fields
    if (!site || !customer || !amount || !paymentMethod) {
      console.log("❌ Missing required fields!");
      return res.status(400).json({
        success: false,
        message: "Site, customer, amount, and payment method are required.",
      });
    }

    console.log("✅ Validation Passed! Creating payment record...");

    // ✅ Create new payment
    const payment = await Payment.create({
      site,
      order,
      customer,
      amount,
      paymentMethod,paymentType,
      remarks,
      status: "Completed", // Default status
    });

    console.log("💰 Payment Created Successfully:", payment);

    // ✅ Attach payment to the site
    await Site.updateOne({ _id: site }, { $push: { payments: payment._id } });

    console.log("🔗 Payment linked to Site:", site);

    res.status(201).json({
      success: true,
      message: "✅ Payment added successfully!",
      payment,
    });
  } catch (error) {
    console.error("🔥 Error adding payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.editPayment = async (req, res) => {
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
    const existingPayment = await Payment.findById(paymentId);
    if (!existingPayment) {
      console.log("⚠️ [Payment Not Found]:", paymentId);
      return res.status(404).json({
        success: false,
        message: "Payment does not exist!",
      });
    }

    console.log("🔧 [Updating Payment] Updating payment:", paymentId);

    const updatedPayment = await Payment.findByIdAndUpdate(
      paymentId,
      { amount, paymentMethod, paymentType, remarks },
      { new: true, runValidators: true }
    );

    console.log(`✅ [Payment Updated] ID: ${updatedPayment._id}`);

    res.status(200).json({
      success: true,
      message: "🎉 Payment updated successfully",
      payment: updatedPayment,
    });
  } catch (error) {
    console.error("❌ [Error] Updating Payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.deletePayment = async (req, res) => {
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

    const deletedPayment = await Payment.findByIdAndRemove(paymentId);

    if (!deletedPayment) {
      console.log("⚠️ [Payment Not Found]:", paymentId);
      return res.status(404).json({
        success: false,
        message: "Payment does not exist!",
      });
    }

    console.log(`✅ [Payment Deleted] ID: ${deletedPayment._id}`);

    res.status(200).json({
      success: true,
      message: "Payment deleted successfully!",
    });
  } catch (error) {
    console.error("❌ [Error] Deleting Payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
