const Category = require("../models/category");

exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    const existingCategory = await Category.findOne({ name });
    if (existingCategory)
      return res.status(400).send({ message: "Category already exists!" });

    const category = await Category.create({ name });

    res.status(201).send({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

exports.editCategory = async (req, res) => {
  try {
    const {categoryId, name } = req.body;

    const category = await Category.findByIdAndUpdate(
      categoryId,
      { name },
      { new: true }
    );

    if (!category)
      return res.status(404).send({ message: "Category not found!" });

    res.status(200).send({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;

    // 🔹 Check if the category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).send({ message: "Category not found!" });
    }

    // 🔹 Delete the category
    await Category.findByIdAndDelete(categoryId);

    // 🔹 Delete all subcategories under this category
    await SubCategory.deleteMany({ category: categoryId });

    res.status(200).send({
      success: true,
      message: "Category and its subcategories deleted successfully",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: "subcategories", // ✅ Correct collection name
          localField: "_id",
          foreignField: "category", // ✅ Matches `SubCategory` model field name
          as: "subCategories",
        },
      },
      {
        $addFields: {
          subCategoryCount: { $size: "$subCategories" }, // ✅ Count subcategories
        },
      },
      {
        $project: {
          subCategories: 0, // ✅ Hide subCategories array if not needed
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


