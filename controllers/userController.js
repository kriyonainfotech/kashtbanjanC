const User = require("../models/user");
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
    console.log(req.body,'------------------')
    console.log(`🔍 User ID: ${userId}`);

    const user = await User.findById(userId);

    console.log(`✅ User found: ${user}`);

    if (!user) return res.status(404).json({success:true, message: "User not found!" });

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

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.body;
    console.log(`🔥 Deleting user with ID: ${userId}`);

    const user = await User.findByIdAndDelete(userId);

    if (!user) return res.status(404).json({success:true, message: "User not found!" });

    console.log(`💥 User deleted: ${user}`);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
