const Category = require("../models/category");
const SubCategory = require("../models/subcategory");
const Stock = require("../models/stock");

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
    const { categoryId, name } = req.body;

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
    console.log(`🗑️ [Delete Category] Request received for ID: ${categoryId}`);

    // 🔹 Check if the category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      console.log("⚠️ Category not found!");
      return res
        .status(404)
        .json({ success: false, message: "Category not found!" });
    }

    // 🔹 Check if subcategories exist
    const subCategoryCount = await SubCategory.countDocuments({
      category: categoryId,
    });
    if (subCategoryCount > 0) {
      console.log(
        `⚠️ Cannot delete! ${subCategoryCount} subcategories exist under this category.`
      );
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with existing subcategories. Delete them first!",
      });
    }

    // 🔹 Delete the category
    await Category.findByIdAndDelete(categoryId);
    console.log("✅ Category deleted successfully:", categoryId);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully!",
    });
  } catch (error) {
    console.error("❌ [Error] Deleting Category:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// exports.getAllCategories = async (req, res) => {
//   try {
//     const categories = await Category.aggregate([
//       {
//         $lookup: {
//           from: "subcategories", // ✅ Correct collection name
//           localField: "_id",
//           foreignField: "category", // ✅ Matches `SubCategory` model field name
//           as: "subCategories",
//         },
//       },
//       {
//         $addFields: {
//           subCategoryCount: { $size: "$subCategories" }, // ✅ Count subcategories
//         },
//       },
//       {
//         $project: {
//           subCategories: 0, // ✅ Hide subCategories array if not needed
//         },
//       },
//     ]);

//     res.status(200).json({
//       success: true,
//       message: "Categories fetched successfully",
//       categories,
//     });
//   } catch (error) {
//     console.error("Error fetching categories:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };
exports.getAllCategories = async (req, res) => {
  try {
    console.log("🔍 Fetching all categories...");

    // Fetch categories with subcategory count
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: "subcategories", // ✅ Correct collection name
          localField: "_id",
          foreignField: "category",
          as: "subCategories",
        },
      },
      {
        $addFields: {
          subCategoryCount: { $size: "$subCategories" }, // ✅ Count subcategories
          subCategoryIds: {
            $map: { input: "$subCategories", as: "sub", in: "$$sub._id" },
          }, // Extract subcategory IDs
        },
      },
      { $project: { subCategories: 0 } }, // ✅ Hide full subCategories array
    ]);

    if (!categories.length) {
      return res
        .status(404)
        .json({ success: false, message: "No categories found" });
    }

    // Get all subcategory IDs from categories
    const allSubCategoryIds = categories.flatMap((cat) => cat.subCategoryIds);

    // Fetch total OnRent & Available Stock per category using Stock data
    const stockData = await Stock.aggregate([
      { $match: { subCategory: { $in: allSubCategoryIds } } },
      {
        $lookup: {
          from: "subcategories",
          localField: "subCategory",
          foreignField: "_id",
          as: "subCategoryData",
        },
      },
      { $unwind: "$subCategoryData" },
      {
        $group: {
          _id: "$subCategoryData.category", // Group by category ID
          totalOnRent: { $sum: "$OnRent" },
          totalStock: { $sum: "$quantity" },
        },
      },
    ]);

    // Convert stockData into a map { categoryId: { totalOnRent, totalStock } }
    const stockMap = {};
    stockData.forEach((item) => {
      stockMap[item._id.toString()] = {
        totalOnRent: item.totalOnRent,
        totalStock: item.totalStock,
      };
    });

    // Attach stock info to each category
    const categoriesWithStock = categories.map((cat) => ({
      ...cat,
      totalOnRent: stockMap[cat._id.toString()]?.totalOnRent || 0,
      totalStock: stockMap[cat._id.toString()]?.totalStock || 0,
    }));

    console.log(
      "✅ Categories fetched successfully:",
      categoriesWithStock.length
    );
    res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      categories: categoriesWithStock,
    });
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


