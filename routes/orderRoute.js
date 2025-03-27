const express = require("express");
const {
  addOrderItems,
  returnOrderItems,
  getCustomerRentedItems,
} = require("../controllers/orderController");
const routes = express.Router();

routes.post("/addorder", addOrderItems);
routes.post("/returnorder", returnOrderItems);
routes.post("/getCustomerRentedItems", getCustomerRentedItems);

module.exports = routes;