const express = require("express");
const {
  addPayment,
  getPaymentByOrder,
  editPayment,
} = require("../controllers/paymentController");
const routes = express.Router();

routes.post("/add-payment", addPayment);
routes.post("/getPaymentByOrder", getPaymentByOrder);
routes.post("/edit-payment", editPayment);

module.exports = routes;
