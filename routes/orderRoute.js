const express = require("express");
const {
  addOrderItems,
  returnOrderItems,
  getCustomerRentedItems,
  getSubcategoriesOnRentByOrder,
  addLostOrDamagedItem,
  getOrdersBySite,
  getReturnedOrderItems,
  getOrdersByCustomer,
  deleteOrder,
  getOrderHistory,
} = require("../controllers/orderController");
const routes = express.Router();

routes.post("/addorder", addOrderItems);
routes.post("/returnorder", returnOrderItems);
routes.post("/getCustomerRentedItems", getCustomerRentedItems);
routes.post("/getOrderItems", getSubcategoriesOnRentByOrder);
routes.post("/addlostItem", addLostOrDamagedItem);
routes.post("/getOrdersBysite", getOrdersBySite);
routes.post("/getReturnedOrderItems", getReturnedOrderItems);
routes.post("/getOrdersByCustomer", getOrdersByCustomer);
routes.delete("/deleteOrder", deleteOrder);
routes.post("/getOrdersHistory", getOrderHistory);

module.exports = routes;