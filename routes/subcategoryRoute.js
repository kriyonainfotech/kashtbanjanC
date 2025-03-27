const express = require("express");
const { createSubCategory, editSubCategory, deleteSubCategory, getSubCategoryById, getSubCategoriesByCategory } = require("../controllers/subcategoryController");
const routes = express.Router();

routes.post("/create", createSubCategory);
routes.post("/edit", editSubCategory);
routes.delete("/delete", deleteSubCategory);
routes.post("/byId", getSubCategoryById);
routes.post("/byCategory", getSubCategoriesByCategory);


module.exports = routes;
