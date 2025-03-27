const express = require("express");
const {
  createCustomer,
  getAllCustomers,
} = require("../controllers/customerController");
const routes = express.Router();

routes.post("/add", createCustomer);
routes.post("/allcustomers", getAllCustomers);


module.exports = routes;