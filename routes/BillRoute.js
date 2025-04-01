const express = require("express");
const { generatePDF } = require("../controllers/Billcontroller");
const router = express.Router();

router.post("/generate-invoice", generatePDF);

module.exports = router;