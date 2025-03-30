const express = require("express");
const {
  addOrderItems,
  returnOrderItems,
  getCustomerRentedItems,
  getSubcategoriesOnRentBySite,
  addLostOrDamagedItem,
} = require("../controllers/orderController");
const routes = express.Router();

routes.post("/addorder", addOrderItems);
routes.post("/returnorder", returnOrderItems);
routes.post("/getCustomerRentedItems", getCustomerRentedItems);
routes.post("/getOrderItems", getSubcategoriesOnRentBySite);
routes.post("/addlostItem", addLostOrDamagedItem);


module.exports = routes;