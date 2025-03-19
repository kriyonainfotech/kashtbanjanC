const SubCategory = require("../models/subcategory");

exports.createSubCategory = async (req, res) => {
  try {
    const { name, category, size, minStock, rentalRate } = req.body;

    const existingSubCategory = await SubCategory.findOne({ name });
    if (existingSubCategory)
      return res.status(400).send({ message: "SubCategory already exists!" });

    const subCategory = await SubCategory.create({
      name,
      Category:category,
      size,
      minStock,
      rentalRate,
    });

    res.status(201).send({
      success: true,
      message: "SubCategory created successfully",
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

    if (!subCategoryId) {
      return res.status(400).send({ message: "SubCategory ID is required" });
    }

    const subCategory = await SubCategory.findByIdAndDelete(subCategoryId);

    if (!subCategory) {
      return res.status(404).send({ message: "SubCategory not found!" });
    }

    res.status(200).send({
      success: true,
      message: "SubCategory deleted successfully",
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

exports.getSubCategoryById = async (req, res) => {
  console.log("🔍 Fetching SubCategory by ID...");
  try {
    const { subCategoryId } = req.body;
    console.log(`🔍 SubCategory ID: ${subCategoryId}`);

    if (!subCategoryId) {
      console.log(`❌ SubCategory ID is required`);
      return res.status(400).send({ message: "SubCategory ID is required" });
    }

    const subCategory = await SubCategory.findById(subCategoryId);

    if (!subCategory) {
      return res.status(404).send({ message: "SubCategory not found!" });
    }

    console.log(`✅ SubCategory found: ${subCategory.name}`);
    res.status(200).send({
      success: true,
      message: "SubCategory fetched successfully",
      subCategory,
    });
  } catch (error) {
    console.log(`❌ Error fetching SubCategory: ${error.message}`);
    res.status(500).send({
      success: false,
      message: error.message,
    });
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

    const subCategories = await SubCategory.find({ Category: categoryId });     

    if (!subCategories || subCategories.length === 0) {
      console.log(`⚠️ No SubCategories found for Category ID: ${categoryId}`);
      return res.status(404).send({ message: "No SubCategories found!" });
    }

    console.log(`✅ SubCategories found: ${subCategories.length} items`);
    res.status(200).send({
      success: true,
      message: "SubCategories fetched successfully",
      subCategories,
    });
  } catch (error) {
    console.log(`❌ Error fetching SubCategories: ${error.message}`);
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

