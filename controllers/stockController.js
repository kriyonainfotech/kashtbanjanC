const Stock = require("../models/stock");
const SubCategory = require("../models/subcategory");
const mongoose = require("mongoose");

exports.addStock = async (req, res) => {
  try {
    const { subCategory, quantity, pricePerItem } = req.body;

    console.log("📩 Received Request:", {
      subCategory,
      quantity,
      pricePerItem,
    });

    // 1️⃣ Validate SubCategory ID
    if (!mongoose.Types.ObjectId.isValid(subCategory)) {
      console.log("❌ Invalid SubCategory ID:", subCategory);
      return res
        .status(400)
        .json({ success: false, message: "Invalid SubCategory ID" });
    }

    // 2️⃣ Check if SubCategory exists
    const subCategoryExists = await SubCategory.exists({ _id: subCategory });
    if (!subCategoryExists) {
      console.log("⚠️ SubCategory Not Found:", subCategory);
      return res
        .status(404)
        .json({ success: false, message: "SubCategory does not exist" });
    }

    // 3️⃣ Always Create a New Stock Entry
    const newStock = new Stock({
      subCategory,
      quantity,
      availableStock: quantity, // Initially available stock = total quantity
      pricePerItem,
    });

    await newStock.save();
    console.log("🎉 New Stock Added:", newStock);

    // 4️⃣ Send Success Response
    res.status(201).json({
      success: true,
      message: "Stock added successfully",
      stock: newStock,
    });
  } catch (error) {
    console.error("❌ Error in addStock:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.deleteStock = async (req, res) => {
  console.log("🗑️ Attempting to delete stock...");

  try {
    const { stockId } = req.body;
    console.log(`🔍 Stock ID: ${stockId}`);

    if (!stockId) {
      console.log("❌ Stock ID is required");
      return res.status(400).send({ message: "Stock ID is required" });
    }

    // 🔍 Find stock first
    const stock = await Stock.findById(stockId);

    if (!stock) {
      console.log("⚠️ Stock not found!");
      return res.status(404).send({ message: "Stock not found!" });
    }

    // 🚨 Prevent deletion if items are still on rent
    if (stock.OnRent > 0) {
      console.log(
        `⛔ Cannot delete stock. ${stock.OnRent} items are still on rent!`
      );
      return res.status(400).send({
        success: false,
        message: `Cannot delete stock. ${stock.OnRent} items are still on rent! Please settle them first.`,
      });
    }

    // 🗑️ Proceed with deletion
    await Stock.findByIdAndDelete(stockId);

    console.log("✅ Stock deleted successfully");
    res.status(200).send({
      success: true,
      message: "Stock deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error in deleteStock:", error.message);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// exports.editStock = async (req, res) => {
//   console.log("✍️ Attempting to edit stock...");
//   try {
//     const { stockId, quantity, pricePerItem } = req.body;
//     console.log(`🔍 Stock ID: ${stockId}`);

//     if (!stockId) {
//       console.log("❌ Stock ID is required");
//       return res
//         .status(400)
//         .send({ success: false, message: "Stock ID is required" });
//     }

//     // Fetch existing stock details
//     const stock = await Stock.findById(stockId);
//     if (!stock) {
//       console.log("⚠️ Stock not found!");
//       return res
//         .status(404)
//         .send({ success: false, message: "Stock not found!" });
//     }

//     // 1️⃣ 🔄 Prevent Redundant Updates
//     if (stock.quantity === quantity && stock.pricePerItem === pricePerItem) {
//       return res.status(200).json({
//         success: true,
//         message: "No changes detected, stock remains the same.",
//         stock,
//       });
//     }

//     // 2️⃣ 🔍 Check if Rented Items Exist (New Quantity Cannot Be Less Than Rented)
//     if (quantity < stock.OnRent) {
//       return res.status(400).json({
//         success: false,
//         message: `Cannot reduce quantity below rented items! Currently rented: ${stock.OnRent}`,
//       });
//     }

//     // 3️⃣ 📊 Adjust Available Stock
//     let stockDifference = quantity - stock.quantity; // Difference in quantity

//     // Prevent availableStock from going negative
//     let newAvailableStock = stock.availableStock + stockDifference;
//     if (newAvailableStock < 0) {
//       return res.status(400).json({
//         success: false,
//         message: `Cannot decrease stock below available quantity! Current available stock: ${stock.availableStock}`,
//       });
//     }

//     // Update stock values
//     stock.quantity = quantity;
//     stock.availableStock = newAvailableStock;
//     stock.pricePerItem = pricePerItem;

//     // Save updated stock
//     await stock.save();
//     console.log("✅ Stock edited successfully");

//     res.status(200).send({
//       success: true,
//       message: "Stock edited successfully",
//       stock,
//     });
//   } catch (error) {
//     console.error("❌ Error in editStock:", error.message);
//     res.status(500).send({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };

exports.editStock = async (req, res) => {
  console.log("✍️ Attempting to edit stock...");
  try {
    const { stockId, quantity, pricePerItem } = req.body;
    console.log(`🔍 Stock ID: ${stockId}`);

    if (!stockId) {
      console.log("❌ Stock ID is required");
      return res.status(400).send({
        success: false,
        message: "Stock ID is required",
      });
    }

    // Fetch existing stock details
    const stock = await Stock.findById(stockId);
    if (!stock) {
      console.log("⚠️ Stock not found!");
      return res.status(404).send({
        success: false,
        message: "Stock not found!",
      });
    }

    let updateFields = {}; // Store only the fields that need updating

    // 🛠 **Update Quantity & Available Stock Only if `quantity` is Provided**
    if (quantity !== undefined) {
      if (quantity < stock.OnRent) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce quantity below rented items! Currently rented: ${stock.OnRent}`,
        });
      }

      let stockDifference = quantity - stock.quantity; // Difference in quantity
      let newAvailableStock = stock.availableStock + stockDifference;

      if (newAvailableStock < 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot decrease stock below available quantity! Current available stock: ${stock.availableStock}`,
        });
      }

      updateFields.quantity = quantity;
      updateFields.availableStock = newAvailableStock;
    }

    // 🏷 **Update Price Per Item Only if Provided**
    if (pricePerItem !== undefined) {
      updateFields.pricePerItem = pricePerItem;
    }

    // 🚀 **If No Fields Were Provided for Update**
    if (Object.keys(updateFields).length === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes detected, stock remains the same.",
        stock,
      });
    }

    // ✅ **Perform the Update**
    const updatedStock = await Stock.findByIdAndUpdate(stockId, updateFields, {
      new: true, // Return the updated document
      runValidators: true, // Ensure data integrity
    });

    console.log("✅ Stock edited successfully");
    res.status(200).send({
      success: true,
      message: "Stock edited successfully",
      stock: updatedStock,
    });
  } catch (error) {
    console.error("❌ Error in editStock:", error.message);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.getStockBySubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.body;
    console.log(`🔍 Fetching stock for SubCategory ID: ${subCategoryId}`);

    if (!subCategoryId) {
      console.log("⚠️ Missing subCategoryId in request");
      return res
        .status(400)
        .json({ success: false, message: "SubCategory ID is required" });
    }

    const stockItems = await Stock.find({ subCategory: subCategoryId })
      .populate({
        path: "subCategory",
        populate: {
          path: "category",
          select: "name",
        },
        select: "name size category",
      })
      .lean();

    if (!stockItems.length) {
      console.log("⚠️ No stock found for this subcategory");
      return res.send({ success: false, message: "No stock found", stock: [] });
    }

    console.log(`✅ Found ${stockItems.length} stock items`);
    res.status(200).json({ success: true, stock: stockItems });
  } catch (error) {
    console.error("🚨 Error fetching stock by subCategory:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getAllStock = async (req, res) => {
  try {
    console.log("📝 [GET ALL STOCK] API hit");

    // ✅ Fetch all stock items and populate subcategory name
    const stockItems = await Stock.find()
      .lean()
      .populate("subCategory", "name") // Populate subcategory name only
      .select("subCategory quantity OnRent availableStock pricePerItem"); // Select required fields

    if (!stockItems.length) {
      return res.status(404).json({
        success: false,
        message: "No stock available!",
      });
    }

    res.status(200).json({
      success: true,
      message: "✅ Stock fetched successfully!",
      stock: stockItems,
    });
  } catch (error) {
    console.error("❌ [Error] Fetching stock:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

