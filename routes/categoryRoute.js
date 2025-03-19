const express = require("express");
const { createCategory, editCategory, deleteCategory, getAllCategories } = require("../controllers/categoryController");
const router = express.Router();

router.post("/create", createCategory)
router.post("/edit", editCategory)
router.delete("/delete", deleteCategory)
router.get("/all",getAllCategories)

module.exports = router;
