const express = require("express");
const {
  addOrderItems,
  returnOrderItems,
  getCustomerRentedItems,
  getSubcategoriesOnRentBySite,
  addLostOrDamagedItem,
  getOrdersBySite,
  getReturnedOrderItems,
  getOrdersByCustomer,
} = require("../controllers/orderController");
const routes = express.Router();

routes.post("/addorder", addOrderItems);
routes.post("/returnorder", returnOrderItems);
routes.post("/getCustomerRentedItems", getCustomerRentedItems);
routes.post("/getOrderItems", getSubcategoriesOnRentBySite);
routes.post("/addlostItem", addLostOrDamagedItem);
routes.post("/getOrdersBysite", getOrdersBySite);
routes.post("/getReturnedOrderItems", getReturnedOrderItems);
routes.post("/getOrdersByCustomer", getOrdersByCustomer);

module.exports = routes;