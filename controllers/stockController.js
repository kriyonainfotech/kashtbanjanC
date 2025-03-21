const Stock = require("../models/stock");
const SubCategory = require("../models/subcategory");
const mongoose = require("mongoose");

exports.addStock = async (req, res) => {
  try {
    const { subCategory, quantity, pricePerItem } = req.body;
    console.log("📩 Received Request:", { subCategory, quantity, pricePerItem });

    // 1️⃣ Check if SubCategory exists
    if (!mongoose.Types.ObjectId.isValid(subCategory)) {
      console.log("❌ Invalid SubCategory ID:", subCategory);
      return res.status(400).send({ success: false, message: "Invalid SubCategory ID" });
    }

    const subCategoryExists = await SubCategory.exists({ _id: subCategory });
    if (!subCategoryExists) {
      console.log("⚠️ SubCategory Not Found:", subCategory);
      return res.status(404).send({ success: false, message: "SubCategory does not exist" });
    }

    // 2️⃣ Check if Stock already exists for this SubCategory
    let stock = await Stock.findOne({ subCategory });

    if (stock) {
      console.log("🔄 Updating Existing Stock:", subCategory);
      stock.quantity += quantity;
      stock.pricePerItem = pricePerItem;
      await stock.save();
      console.log("✅ Stock Updated Successfully:", stock);
    } else {
      console.log("🆕 Creating New Stock Entry:", subCategory);
      stock = new Stock({ subCategory, quantity, pricePerItem });
      await stock.save();
      console.log("🎉 New Stock Added:", stock);
    }

    // 3️⃣ Send Success Response
    res.status(201).send({
      success: true,
      message: "Stock added successfully",
      stock,
    });
  } catch (error) {
    console.error("❌ Error in addStock:", error);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
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


exports.editStock = async (req, res) => {
  console.log("✍️ Attempting to edit stock...");
  try {
    const { stockId, quantity, pricePerItem } = req.body;
    console.log(`🔍 Stock ID: ${stockId}`);

    if (!stockId) {
      console.log("❌ Stock ID is required");
      return res.status(400).send({ message: "Stock ID is required" });
    }

    const stock = await Stock.findByIdAndUpdate(
      stockId,
      {
        quantity,
        pricePerItem,
      },
      { new: true }
    );

    if (!stock) {
      console.log("⚠️ Stock not found!");
      return res.status(404).send({ message: "Stock not found!" });
    }

    console.log("✅ Stock edited successfully");
    res.status(200).send({
      success: true,
      message: "Stock edited successfully",
      stock,
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
      return res
        .status(404)
        .json({ success: false, message: "No stock found" });
    }

    console.log(`✅ Found ${stockItems.length} stock items`);
    res.status(200).json({ success: true, stock: stockItems });
  } catch (error) {
    console.error("🚨 Error fetching stock by subCategory:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};