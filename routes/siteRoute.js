const express = require("express");
const {
  addSite,
  getSitesByCustomer,
  editSite,
  getSiteHistory,
} = require("../controllers/siteController");
const routes = express.Router();

routes.post("/addsite", addSite);
routes.post("/getSitesByCustomer", getSitesByCustomer);
routes.post("/editsite", editSite);
routes.post("/getSiteHistory", getSiteHistory);

module.exports = routes;