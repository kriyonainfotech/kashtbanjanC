const express = require("express");
const { createSubCategory, editSubCategory, deleteSubCategory, getSubCategoryById, getSubCategoriesByCategory } = require("../controllers/subcategoryController");
const router = express.Router();

router.post("/create", createSubCategory) 
router.post("/edit", editSubCategory)
router.delete("/delete",deleteSubCategory)
router.post("/byId", getSubCategoryById)
router.post("/byCategory", getSubCategoriesByCategory)

module.exports = router;
