const express = require("express");
const {
  addPayment,
  getPaymentByOrder,
} = require("../controllers/paymentController");
const routes = express.Router();

routes.post("/add-payment", addPayment);
routes.post("/getPaymentByOrder", getPaymentByOrder);

module.exports = routes;
