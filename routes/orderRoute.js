const express = require("express");
const { addOrder } = require("../controllers/orderController");
const routes = express.Router()  

routes.post("/addorder",addOrder)

module.exports = routes;