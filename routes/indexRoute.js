const express = require("express");
const router = express.Router();

router.use("/user", require("./userRoute"));
router.use("/category", require("./categoryRoute"));
router.use("/subcategory", require("./subcategoryRoute"));
router.use("/stock", require("./stockRoute"));
router.use("/site", require("./siteRoute"));
router.use("/customer", require("./customerRoute"));
router.use("/order", require("./orderRoute"));

module.exports = router;
