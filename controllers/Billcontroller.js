const easyinvoice = require("easyinvoice");
const fs = require("fs");
const path = require("path");

// API endpoint to generate invoice
exports.generatePDF = async (req, res) => {
  try {
    // Get invoice data from request body
    const invoiceData = req.body;

    // Generate invoice PDF
    const result = await easyinvoice.createInvoice(invoiceData);
    const pdfBuffer = Buffer.from(result.pdf, "base64");

    // Save PDF file locally (optional)
    const filePath = path.join(__dirname, "invoice.pdf");
    fs.writeFileSync(filePath, pdfBuffer);

    // Send PDF as response (inline display)
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=invoice.pdf");
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error.message);
    res
      .status(500)
      .json({ error: "Failed to generate invoice", details: error.message });
  }
};

