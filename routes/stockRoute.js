const express = require("express");
const {
  addStock,
  deleteStock,
  editStock,
  getStockBySubCategory,
  getAllStock,
} = require("../controllers/stockController");
const routes = express.Router();

routes.post("/add", addStock);
routes.delete("/delete", deleteStock);
routes.post("/edit", editStock);
routes.post("/bySubcategory", getStockBySubCategory);
routes.post("/getallstocks", getAllStock);

module.exports = routes;