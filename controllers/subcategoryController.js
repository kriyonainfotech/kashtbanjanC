const SubCategory = require("../models/subcategory");
const Category = require("../models/category");
const mongoose = require("mongoose");
const Stock = require("../models/stock");

exports.createSubCategory = async (req, res) => {
  try {
    const { name, category, size, minStock, rentalRate, userId } = req.body;

    console.log("📝 Received request to create subcategory:", name);

    // Check if category exists
    const existingCategory = await Category.findOne({
      _id: category,
      userId,
    }).lean();
    if (!existingCategory) {
      console.log("❌ Category not found or unauthorized:", category);
      return res.status(400).send({
        success: false,
        message: "Category does not exist or unauthorized!",
      });
    }

    // Check if SubCategory already exists for the user
    const existingSubCategory = await SubCategory.findOne({
      name,
      userId,
    }).lean();
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
      userId, // 🔹 Attach userId
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

// exports.editSubCategory = async (req, res) => {
//   try {
//     const { userId, subCategoryId, ...updateFields } = req.body; // Extract ID and update fields
//     console.log("User ID:", userId);
//     console.log("Sub Category ID:", subCategoryId);
//     console.log("Update Fields:", updateFields);

//     if (!subCategoryId) {
//       return res
//         .status(400)
//         .send({ success: false, message: "SubCategory ID is required" });
//     }

//     if (!userId) {
//       return res
//         .status(400)
//         .send({ success: false, message: "User ID is required" });
//     }

//     const subCategory = await SubCategory.findOne({
//       _id: subCategoryId,
//       userId,
//     });
//     if (!subCategory) {
//       return res.status(404).send({
//         success: false,
//         message: "SubCategory not found or unauthorized!",
//       });
//     }

//     // Filter out undefined values from updateFields
//     let updateObj = {};
//     Object.keys(updateFields).forEach((key) => {
//       if (updateFields[key] !== undefined) {
//         updateObj[key] = updateFields[key];
//       }
//     });

//     // Perform update
//     const updatedSubCategory = await SubCategory.findByIdAndUpdate(
//       subCategoryId,
//       { $set: updateObj },
//       { new: true }
//     );
//     console.log("SubCategory updated successfully:", updatedSubCategory);
//     res.status(200).send({
//       success: true,
//       message: "SubCategory updated successfully",
//       subCategory: updatedSubCategory,
//     });
//   } catch (error) {
//     console.log(error, "error");
//     res.status(500).send({
//       success: false,
//       message: error.message,
//     });
//   }
// };

exports.editSubCategory = async (req, res) => {
  try {
    console.log("🚀 Incoming request to edit subcategory");
    console.log("📥 Request Body:", req.body);

    const { userId, subCategoryId, ...updateFields } = req.body; // Extract ID and update fields
    console.log("🆔 User ID:", userId);
    console.log("🔖 Sub Category ID:", subCategoryId);
    console.log("🛠️ Update Fields:", updateFields);

    if (!subCategoryId) {
      console.log("❌ Missing SubCategory ID");
      return res
        .status(400)
        .send({ success: false, message: "SubCategory ID is required" });
    }

    if (!userId) {
      console.log("❌ Missing User ID");
      return res
        .status(400)
        .send({ success: false, message: "User ID is required" });
    }

    console.log("🔍 Searching for subcategory...");
    const subCategory = await SubCategory.findOne({
      _id: subCategoryId,
      userId,
    });

    if (!subCategory) {
      console.log("⚠️ SubCategory not found or unauthorized!");
      return res.status(404).send({
        success: false,
        message: "SubCategory not found or unauthorized!",
      });
    }

    // Filter out undefined values from updateFields
    let updateObj = {};
    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] !== undefined) {
        updateObj[key] = updateFields[key];
      }
    });

    console.log("📦 Filtered Update Object:", updateObj);

    // Perform update
    console.log("🔄 Updating SubCategory...");
    const updatedSubCategory = await SubCategory.findByIdAndUpdate(
      subCategoryId,
      { $set: updateObj },
      { new: true }
    );

    if (!updatedSubCategory) {
      console.log("❌ Update failed");
      return res.status(500).send({
        success: false,
        message: "Failed to update subcategory",
      });
    }

    console.log("✅ SubCategory updated successfully:", updatedSubCategory);
    res.status(200).send({
      success: true,
      message: "SubCategory updated successfully",
      subCategory: updatedSubCategory,
    });
  } catch (error) {
    console.log("💥 Error:", error);
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};


exports.deleteSubCategory = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { subCategoryId, userId } = req.body;

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

    // 2️⃣ Check if SubCategory exists & belongs to the user
    const subCategory = await SubCategory.findOne({
      _id: subCategoryId,
      userId,
    }).session(session);
    if (!subCategory) {
      console.log("⚠️ SubCategory not found or unauthorized!");
      return res.status(404).send({
        success: false,
        message: "SubCategory not found or unauthorized!",
      });
    }

    // 3️⃣ Check if any stock under this SubCategory has items on rent
    const stockWithOnRent = await Stock.findOne({
      subCategory: subCategoryId,
      OnRent: { $gt: 0 },
    }).session(session);

    if (stockWithOnRent) {
      console.log(`🚫 Cannot delete! ${stockWithOnRent.OnRent} items on rent.`);
      return res.status(400).send({
        success: false,
        message:
          "Cannot delete SubCategory with stock items currently on rent. Clear rentals first!",
      });
    }

    // 4️⃣ Delete all associated stock & subCategory using transactions
    await Stock.deleteMany({ subCategory: subCategoryId }).session(session);
    await SubCategory.findByIdAndDelete(subCategoryId).session(session);

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    console.log("✅ SubCategory and associated stock deleted successfully");
    res.status(200).send({
      success: true,
      message: "SubCategory and its stock deleted successfully!",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ [Error] Deleting SubCategory:", error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};

exports.getSubCategoryById = async (req, res) => {
  try {
    console.log("🔍 [Fetch SubCategory] Request received...");

    const { subCategoryId, userId } = req.body;

    console.log("📩 Request Body:", req.body);

    if (!subCategoryId || !userId) {
      console.log("❌ Missing SubCategory ID or User ID");
      return res.status(400).json({
        success: false,
        message: "SubCategory ID and User ID are required!",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(subCategoryId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      console.log("❌ Invalid ID format:", { subCategoryId, userId });
      return res.status(400).json({
        success: false,
        message: "Invalid SubCategory ID or User ID format!",
      });
    }

    // Fetch SubCategory with user validation and populated category name
    const subCategory = await SubCategory.findOne({
      _id: subCategoryId,
      userId: userId, // Ensures the user owns this subCategory
    })
      .populate("category", "name")
      .lean();

    if (!subCategory) {
      console.log(
        `⚠️ SubCategory not found or does not belong to user: ${userId}`
      );
      return res
        .status(404)
        .json({
          success: false,
          message: "SubCategory not found or access denied!",
        });
    }

    console.log("✅ SubCategory Found:", subCategory);
    res.status(200).json({ success: true, subCategory });
  } catch (error) {
    console.error("🚨 [Error] Fetching SubCategory:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
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

