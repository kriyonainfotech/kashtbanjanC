const Customer = require("../models/customer");

exports.createCustomer = async (req, res) => {
  try {
    console.log("🚀 [CREATE CUSTOMER] API hit");

    const {
      name,
      email,
      phone,
      address,
      pancardNumber,
      aadhaarNumber,
      adhaarImage,
      panCardImage,
    } = req.body;

    // ✅ Validate required fields
    if (!name || !address || !phone) {
      console.log("⚠️ [Validation Failed] Missing required fields");
      return res.status(400).send({
        success: false,
        message: "Name, Email, and Phone are required!",
      });
    }

    // ✅ Check if customer already exists (based on email)
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      console.log(
        `⚠️ [Duplicate] Customer with email ${email} already exists`
      );
      return res.status(409).send({
        success: false,
        message: "Customer with this email already exists",
      });
    }

    // ✅ Create a new customer
    console.log("📝 [Saving Customer] Creating new customer...");
    const customer = new Customer({
      name,
      email,
      phone,
      address,
      pancardNumber,
      aadhaarNumber,
      adhaarImage,
      panCardImage,
    });

    await customer.save();

    console.log(`✅ [Customer Created] ID: ${customer._id}`);
    res.status(201).send({
      success: true,
      message: "🎉 Customer created successfully",
      customer,
    });
  } catch (error) {
    console.log("❌ [Error] Creating customer:", error);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

