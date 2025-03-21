const express = require("express");
const { addSite, getSitesByCustomer, editSite } = require("../controllers/siteController");
const routes = express.Router();

routes.post("/addsite", addSite)
routes.post("/getSitesByCustomer", getSitesByCustomer)
routes.post("/editsite",editSite)

module.exports = routes;