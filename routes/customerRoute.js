const express = require("express");
const {
  createCustomer,
  getAllCustomers,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");
const routes = express.Router();

routes.post("/add", createCustomer);
routes.post("/allcustomers", getAllCustomers);
routes.post("/editcustomer", updateCustomer);
routes.delete("/deletecustomer", deleteCustomer);

module.exports = routes;
