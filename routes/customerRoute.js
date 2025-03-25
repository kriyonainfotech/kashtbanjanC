const express = require("express");
const { createCustomer } = require("../controllers/customerController");
const routes = express.Router();

routes.post("/add", createCustomer);
routes.get("/all");

module.exports = routes;