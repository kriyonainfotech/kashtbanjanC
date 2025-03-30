const express = require("express");
const {
  addSite,
  getSitesByCustomer,
  editSite,
  getSiteHistory,
  deleteSite,
} = require("../controllers/siteController");
const routes = express.Router();

routes.post("/addsite", addSite);
routes.post("/getSitesByCustomer", getSitesByCustomer);
routes.post("/editsite", editSite);
routes.post("/getSiteHistory", getSiteHistory);
routes.delete("/deletesite", deleteSite);

module.exports = routes;