const express = require("express");
const {
  addOrderItems,
  returnOrderItems,
} = require("../controllers/orderController");
const routes = express.Router();

routes.post("/addorder", addOrderItems);
routes.post("/returnorder", returnOrderItems);

module.exports = routes;