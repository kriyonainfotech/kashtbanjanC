const express = require("express");
const { addPayment } = require("../controllers/paymentController");
const routes = express.Router();

routes.post("/add-payment",addPayment)

module.exports = routes;
