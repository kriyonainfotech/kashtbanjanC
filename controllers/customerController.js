const Customer = require("../models/customer");
const User = require("../models/user");

exports.createCustomer = async (req, res) => {
  try {
    console.log("🚀 [CREATE CUSTOMER] API hit");

    const { name, phone, address, pancardNumber, aadhaarNumber, userId } =
      req.body;

    // ✅ Validate required fields
    if (!name || !address || !phone || !userId) {
      console.log("⚠️ [Validation Failed] Missing required fields");
      return res.status(400).send({
        success: false,
        message: "Name, Address, Phone, and User ID are required!",
      });
    }

    // ✅ Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      console.log(`❌ [Error] User with ID ${userId} does not exist`);
      return res.status(404).send({
        success: false,
        message: "User not found! Cannot create customer.",
      });
    }

    // ✅ Check if customer already exists for this user
    const existingCustomer = await Customer.findOne({ phone, userId });
    if (existingCustomer) {
      console.log(
        `⚠️ [Duplicate] Customer with phone ${phone} already exists for this user`
      );
      return res.status(409).send({
        success: false,
        message: "Customer with this phone already exists for this user",
      });
    }

    // ✅ Create a new customer
    console.log("📝 [Saving Customer] Creating new customer...");
    const customer = await Customer.create({
      userId, // ✅ Save userId
      name,
      phone,
      address,
      pancardNumber,
      aadhaarNumber,
    });

    // ✅ Push customerId into User model
    await User.findByIdAndUpdate(userId, {
      $push: { customers: customer._id }, // Assuming User model has a 'customers' array
    });

    console.log(
      `✅ [Customer Created] ID: ${customer._id} and linked to User ${userId}`
    );

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

exports.getAllCustomers = async (req, res) => {
  try {
    console.log("📝 [GET ALL CUSTOMERS] API hit");

    const { userId } = req.body; // ✅ Get userId from request

    // ✅ Fetch only customers linked to the logged-in user
    const allCustomers = await Customer.find({ userId })
      .populate("sites", "dueAmount")
      .lean(); // Use `.lean()` for better performance

    // ✅ Add site count & total due amount for each customer
    const customersWithCalculations = allCustomers.map((customer) => {
      const totalDueAmount = customer.sites
        ? customer.sites.reduce((sum, site) => sum + (site.dueAmount || 0), 0)
        : 0;

      return {
        ...customer,
        siteCount: customer.sites ? customer.sites.length : 0,
        totalDueAmount, // ✅ Added total due amount
      };
    });

    console.log(
      "✅ [User's Customers Fetched] Count:",
      customersWithCalculations.length
    );

    res.status(200).send({
      success: true,
      message: "🎉 User's customers fetched successfully",
      customers: customersWithCalculations, // ✅ Updated response
    });
  } catch (error) {
    console.log("❌ [Error] Fetching customers:", error);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    console.log("🚀 [UPDATE CUSTOMER] API hit");

    const { customerId, userId, ...updateData } = req.body;

    console.log(
      `📌 [Received Data] customerId: ${customerId}, userId: ${userId}`
    );

    // ✅ Validate required fields
    if (!customerId || !userId) {
      console.log("⚠️ [Validation Failed] Missing required fields ❌");
      return res.status(400).send({
        success: false,
        message: "Customer ID and User ID are required!",
      });
    }

    // ✅ Check if customer exists
    console.log(
      `🔎 [Checking Customer] Looking for Customer ID: ${customerId}`
    );
    const customer = await Customer.findOne({ _id: customerId, userId });
    if (!customer) {
      console.log(`❌ [Error] Customer with ID ${customerId} not found`);
      return res.status(404).send({
        success: false,
        message: "Customer not found!",
      });
    }

    console.log(
      `✅ [Customer Found] Name: ${customer.name}, Phone: ${customer.phone}`
    );

    // ✅ Prevent duplicate phone numbers for the same user
    if (updateData.phone && updateData.phone !== customer.phone) {
      console.log(
        `📞 [Checking Phone] Validating phone number: ${updateData.phone}`
      );
      const existingCustomer = await Customer.findOne({
        phone: updateData.phone,
        userId,
      });
      if (existingCustomer) {
        console.log(
          `⚠️ [Duplicate] Customer with phone ${updateData.phone} already exists for this user ❌`
        );
        return res.status(409).send({
          success: false,
          message: "Customer with this phone already exists for this user",
        });
      }
      console.log(
        `✅ [Phone Valid] No duplicates found for ${updateData.phone}`
      );
    }

    // ✅ Update only provided fields
    console.log("📝 [Updating Customer] Updating provided fields...");
    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      updateData,
      { new: true }
    );

    console.log(
      `✅ [Customer Updated] ID: ${customerId}, Updated Fields:`,
      updateData
    );

    res.status(200).send({
      success: true,
      message: "🎉 Customer updated successfully",
      customer: updatedCustomer,
    });
  } catch (error) {
    console.log("❌ [Error] Updating customer:", error);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    console.log("🚀 [DELETE CUSTOMER] API hit");

    const { userId, customerId } = req.body;

    console.log(
      `📌 [Received Data] customerId: ${customerId}, userId: ${userId}`
    );

    // ✅ Validate required fields
    if (!customerId || !userId) {
      console.log("⚠️ [Validation Failed] Missing required fields ❌");
      return res.status(400).send({
        success: false,
        message: "Customer ID and User ID are required!",
      });
    }

    // ✅ Check if customer exists
    console.log(
      `🔎 [Checking Customer] Looking for Customer ID: ${customerId}`
    );
    const customer = await Customer.findOne({ _id: customerId, userId });
    if (!customer) {
      console.log(`❌ [Error] Customer with ID ${customerId} not found`);
      return res.status(404).send({
        success: false,
        message: "Customer not found!",
      });
    }

    console.log(
      `✅ [Customer Found] Name: ${customer.name}, Phone: ${customer.phone}`
    );

    // ✅ Delete customer
    console.log("🗑️ [Deleting Customer] Removing customer from database...");
    await Customer.findByIdAndDelete(customerId);

    // ✅ Remove customer ID from User's 'customers' array
    console.log("🔄 [Updating User] Removing customer reference from user...");
    await User.findByIdAndUpdate(userId, { $pull: { customers: customerId } });

    console.log(`✅ [Customer Deleted] ID: ${customerId} successfully removed`);

    res.status(200).send({
      success: true,
      message: "🗑️ Customer deleted successfully",
    });
  } catch (error) {
    console.log("❌ [Error] Deleting customer:", error);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
