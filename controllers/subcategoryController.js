const SubCategory = require("../models/subcategory");
const Category = require("../models/category");
const mongoose = require("mongoose");
const Stock = require("../models/stock");

exports.createSubCategory = async (req, res) => {
  try {
    const { name, category, size, minStock, rentalRate } = req.body;

    console.log("📝 Received request to create subcategory:", name);

    // Check if category exists
    const existingCategory = await Category.findById(category).lean();
    if (!existingCategory) {
      console.log("❌ Category not found:", category);
      return res
        .status(400)
        .send({ success: false, message: "Category does not exist!" });
    }

    // Check if SubCategory already exists
    const existingSubCategory = await SubCategory.findOne({ name }).lean();
    if (existingSubCategory) {
      console.log("⚠️ SubCategory already exists:", name);
      return res
        .status(400)
        .send({ success: false, message: "SubCategory already exists!" });
    }

    // Create new SubCategory
    const subCategory = await SubCategory.create({
      name,
      category,
      size,
      minStock,
      rentalRate,
    });

    console.log("✅ SubCategory created successfully:", subCategory.name);
    res.status(201).send({
      success: true,
      message: "SubCategory created successfully",
      subCategory,
    });
  } catch (error) {
    console.error("🚨 Error creating subcategory:", error.message);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};

exports.editSubCategory = async (req, res) => {
  try {
    const { subCategoryId, ...updateFields } = req.body; // Extract ID and update fields

    if (!subCategoryId) {
      return res.status(400).send({ message: "SubCategory ID is required" });
    }

    // Get all keys from the request body
    const keys = Object.keys(updateFields); // Store field names separately

    // Create update object dynamically
    let updateObj = {};
    keys.forEach((key) => {
      if (updateFields[key] !== undefined) {
        updateObj[key] = updateFields[key];
      }
    });

    const subCategory = await SubCategory.findByIdAndUpdate(
      subCategoryId,
      { $set: updateObj }, // Update only provided fields
      { new: true }
    );

    if (!subCategory) {
      return res.status(404).send({ message: "SubCategory not found!" });
    }

    res.status(200).send({
      success: true,
      message: "SubCategory updated successfully",
      subCategory,
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteSubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.body;
    console.log(
      `🗑️ [Delete SubCategory] Request received for ID: ${subCategoryId}`
    );

    // 1️⃣ Validate ID
    if (!subCategoryId) {
      console.log("⚠️ SubCategory ID is required!");
      return res
        .status(400)
        .send({ success: false, message: "SubCategory ID is required!" });
    }

    // 2️⃣ Check if the SubCategory exists
    const subCategory = await SubCategory.findById(subCategoryId);
    if (!subCategory) {
      console.log("⚠️ SubCategory not found!");
      return res
        .status(404)
        .send({ success: false, message: "SubCategory not found!" });
    }

    // 3️⃣ Check if any stock under this SubCategory has items on rent
    const stockWithOnRent = await Stock.findOne({
      subCategory: subCategoryId,
      OnRent: { $gt: 0 },
    });

    if (stockWithOnRent) {
      console.log(
        `🚫 Cannot delete! Stock under this subcategory has ${stockWithOnRent.OnRent} items on rent.`
      );
      return res.status(400).send({
        success: false,
        message:
          "Cannot delete SubCategory with stock items currently on rent. Clear rentals first!",
      });
    }

    // 4️⃣ Delete all stock associated with this subCategory (safe because no items are on rent)
    await Stock.deleteMany({ subCategory: subCategoryId });

    // 5️⃣ Delete the subCategory itself
    await SubCategory.findByIdAndDelete(subCategoryId);
    console.log("✅ SubCategory and associated stock deleted successfully");

    res.status(200).send({
      success: true,
      message: "SubCategory and its stock deleted successfully!",
    });
  } catch (error) {
    console.error("❌ [Error] Deleting SubCategory:", error);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.getSubCategoryById = async (req, res) => {
  console.log("🔍 Fetching SubCategory by ID...");

  try {
    const subCategoryId =
      req.body.subCategoryId ||
      req.params.subCategoryId ||
      req.query.subCategoryId;

    console.log("📩 Request Body:", req.body);
    console.log(`🔍 SubCategory ID: ${subCategoryId}`);

    if (!subCategoryId) {
      console.log("❌ SubCategory ID is required");
      return res.status(400).send({ message: "SubCategory ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(subCategoryId)) {
      console.log("❌ Invalid SubCategory ID format:", subCategoryId);
      return res
        .status(400)
        .send({ message: "Invalid SubCategory ID format!" });
    }

    // Debug if the ID exists
    const checkExists = await SubCategory.exists({ _id: subCategoryId });
    console.log("🔍 SubCategory Exists in DB:", checkExists);

    if (!checkExists) {
      console.log(`⚠️ SubCategory not found in DB: ${subCategoryId}`);
      return res.status(404).send({ message: "SubCategory not found!" });
    }

    // Fetch SubCategory with populated category name
    const subCategory = await SubCategory.findById(
      new mongoose.Types.ObjectId(subCategoryId)
    )
      .populate("category", "name")
      .lean();

    console.log("📌 Mongoose Query Debug:", {
      id: subCategoryId,
      queryResult: subCategory,
    });

    if (!subCategory) {
      console.log(`⚠️ SubCategory not found after query: ${subCategoryId}`);
      return res.status(404).send({ message: "SubCategory not found!" });
    }

    console.log("✅ SubCategory Found:", subCategory);
    res.status(200).send({ success: true, subCategory });
  } catch (error) {
    console.error("🚨 Error fetching SubCategory:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.getSubCategoriesByCategory = async (req, res) => {
  console.log("🔍 Fetching SubCategories by Category...");
  try {
    const { categoryId } = req.body;
    console.log(`🔍 Category ID: ${categoryId}`);

    if (!categoryId) {
      console.log(`❌ Category ID is required`);
      return res.status(400).send({ message: "Category ID is required" });
    }

    // Fetch all subcategories under the given category
    const subCategories = await SubCategory.find({ category: categoryId })
      .populate("category", "name")
      .lean(); // Convert to plain JS objects

    if (!subCategories || subCategories.length === 0) {
      console.log(`⚠️ No SubCategories found for Category ID: ${categoryId}`);
      return res.send({
          success: true,
          message: "No SubCategories found!",
          subCategories,
        });
    }

    // Fetch OnRent items for each subcategory
    const subCategoryIds = subCategories.map((sub) => sub._id);

    const stockData = await Stock.aggregate([
      { $match: { subCategory: { $in: subCategoryIds } } }, // Filter by subcategories
      {
        $group: {
          _id: "$subCategory",
          totalOnRent: { $sum: "$OnRent" }, // Sum OnRent per subcategory
          totalStock: { $sum: "$quantity" }, // Sum total available stock
        },
      },
    ]);

    // Convert stock data into an object { subCategoryId: {totalOnRent, totalStock} }
    const stockMap = {};
    stockData.forEach((item) => {
      stockMap[item._id.toString()] = {
        totalOnRent: item.totalOnRent,
        totalStock: item.totalStock,
      };
    });

    // Attach OnRent & Available Stock value to each subcategory
    const subCategoriesWithStock = subCategories.map((sub) => ({
      ...sub,
      totalOnRent: stockMap[sub._id.toString()]?.totalOnRent || 0, // Default 0 if no stock found
      totalStock: stockMap[sub._id.toString()]?.totalStock || 0, // Default 0 if no stock found
    }));

    console.log(`✅ SubCategories found: ${subCategories.length} items`);
    res.status(200).send({
      success: true,
      message: "SubCategories fetched successfully",
      subCategories: subCategoriesWithStock,
    });
  } catch (error) {
    console.log(`❌ Error fetching SubCategories: ${error.message}`);
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

