    const mongoose = require("mongoose");

    const subCategorySchema = new mongoose.Schema({
      name: { type: String, required: true, unique: true },
      category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
      },
      size: { type: String, required: true },
      minStock: { type: Number },
      rentalRate: { type: Number, required: true }, // Daily rate per item
      // lostFee: { type: Number, }, // Replacement cost for lost items
      // damagedFee: { type: Number }, // Fee for damaged items
      createdAt: { type: Date, default: Date.now },
    });

    // ✅ Indexes for faster queries
    // subCategorySchema.index({ name: 1 });
    subCategorySchema.index({ Category: 1 });

    const SubCategory = mongoose.model("SubCategory", subCategorySchema);

    module.exports = SubCategory;
