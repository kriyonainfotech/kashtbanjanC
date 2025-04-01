const User = require("../models/user");
const Category = require("../models/category");
const SubCategory = require("../models/subcategory");
const Stock = require("../models/stock");
const Site = require("../models/site");
const Order = require("../models/order");
const Payment = require("../models/payment");
const Customer = require("../models/customer");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      mobileNumber,
      password,
      storeName,
      storeAddress,
      city,
      state,
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists!" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      mobileNumber,
      password: hashedPassword,
      storeName,
      storeAddress,
      city,
      state,
    });
    console.log("User created:", user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ message: "Invalid Email" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password!" });

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.body;
    console.log(req.body, "------------------");
    console.log(`🔍 User ID: ${userId}`);

    const user = await User.findById(userId);

    console.log(`✅ User found: ${user}`);

    if (!user)
      return res
        .status(404)
        .json({ success: true, message: "User not found!" });

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteUserData = async (req, res) => {
  try {
    const { userId } = req.body; // 🔥 Get userId from params

    console.log(`🗑️ Deleting all data for user: ${userId}`);

    // 🚀 Start transaction for safety
    const session = await mongoose.startSession();
    session.startTransaction();

    // 1️⃣ Find all customers of this user
    const customers = await Customer.find({ userId }).session(session);
    const customerIds = customers.map((cust) => cust._id);
    console.log(`👤 Found ${customers.length} customers to delete`);

    // 2️⃣ Find all sites linked to these customers
    const sites = await Site.find({ customer: { $in: customerIds } }).session(
      session
    );
    const siteIds = sites.map((site) => site._id);
    console.log(`🏢 Found ${sites.length} sites to delete`);

    // 3️⃣ Find all orders related to these sites
    const orders = await Order.find({ site: { $in: siteIds } }).session(
      session
    );
    const orderIds = orders.map((order) => order._id);
    console.log(`📦 Found ${orders.length} orders to delete`);

    // 4️⃣ Find all payments related to these orders or customers
    const payments = await Payment.find({
      $or: [{ order: { $in: orderIds } }, { customer: { $in: customerIds } }],
    }).session(session);
    console.log(`💰 Found ${payments.length} payments to delete`);

    // 5️⃣ Find all categories and subcategories created by the user
    const categories = await Category.find({ userId }).session(session);
    const categoryIds = categories.map((cat) => cat._id);
    const subCategories = await SubCategory.find({ userId }).session(session);
    const subCategoryIds = subCategories.map((sub) => sub._id);
    console.log(
      `📂 Found ${categories.length} categories and ${subCategories.length} subcategories to delete`
    );

    // 6️⃣ Find all stocks linked to subcategories
    const stocks = await Stock.find({
      subCategory: { $in: subCategoryIds },
    }).session(session);
    console.log(`📦 Found ${stocks.length} stock items to delete`);

    // 🚨 Deleting all related data
    await Payment.deleteMany({
      _id: { $in: payments.map((p) => p._id) },
    }).session(session);
    await Order.deleteMany({ _id: { $in: orderIds } }).session(session);
    await Site.deleteMany({ _id: { $in: siteIds } }).session(session);
    await Customer.deleteMany({ _id: { $in: customerIds } }).session(session);
    await Stock.deleteMany({ _id: { $in: stocks.map((s) => s._id) } }).session(
      session
    );
    await SubCategory.deleteMany({ _id: { $in: subCategoryIds } }).session(
      session
    );
    await Category.deleteMany({ _id: { $in: categoryIds } }).session(session);
    await User.findByIdAndDelete(userId).session(session);

    console.log("✅ All user data deleted successfully!");

    // 🎉 Commit transaction
    await session.commitTransaction();
    session.endSession();

    res
      .status(200)
      .json({ message: "User and all related data deleted successfully!" });
  } catch (error) {
    console.error("❌ Error deleting user data:", error);

    // ❌ Rollback transaction on error
    await session.abortTransaction();
    session.endSession();

    res.status(500).json({ message: "Internal Server Error" });
  }
};
