const express = require("express");
const router = express.Router();

router.use("/user", require("./userRoute"));
router.use("/category", require("./categoryRoute"));
router.use("/subcategory",require("./subcategoryRoute"))

module.exports = router;
