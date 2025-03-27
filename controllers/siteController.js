const Site = require("../models/site")
const Customer = require("../models/customer")
const mongoose = require("mongoose");

exports.addSite = async (req, res) => {
  try {
    console.log("🚀 [ADD SITE] API hit");

    const { customer, sitename, address } = req.body;

    // ✅ Validate required fields
    if (!customer || !sitename || !address) {
      console.warn("⚠️ [Validation Failed] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Customer, Site Name, and Address are required!",
      });
    }

    // ✅ Check if customer exists
    if (!mongoose.Types.ObjectId.isValid(customer)) {
      console.log("❌ [Invalid Customer ID]:", customer);
      return res.status(400).json({
        success: false,
        message: "Invalid Customer ID!",
      });
    }

    const customerExists = await Customer.exists({ _id: customer });
    if (!customerExists) {
      console.log("⚠️ [Customer Not Found]:", customer);
      return res.status(404).json({
        success: false,
        message: "Customer does not exist!",
      });
    }

    console.log("📝 [Creating Site] Saving new site in database...");

    const newSite = await Site.create({
      customer,
      sitename,
      address,
    });

    console.log(
      `✅ [Site Created] ID: ${newSite._id} for Customer: ${customerExists}`
    );

    // ✅ Add the new site ID to the customer's sites array
    await Customer.findByIdAndUpdate(
      customer,
      { $push: { sites: newSite._id } },
      { new: true }
    );

    console.log(
      `✅ [Customer Updated] Site ${newSite._id} added to customer ${customer}`
    );

    res.status(201).json({
      success: true,
      message: "🎉 Site added successfully",
      site: newSite,
    });
  } catch (error) {
    console.error("❌ [Error] Adding Site:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.getSitesByCustomer = async (req, res) => {
  try {
    console.log("🎉 [GET SITES BY CUSTOMER] API hit");

    const { customer } = req.body;

    // ✅ Validate required fields
    if (!customer) {
      console.warn("⚠️ [Validation Failed] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Customer ID is required!",
      });
    }

    // ✅ Check if customer exists
    if (!mongoose.Types.ObjectId.isValid(customer)) {
      console.log("❌ [Invalid Customer ID]:", customer);
      return res.status(400).json({
        success: false,
        message: "Invalid Customer ID!",
      });
    }

    const customerExists = await Customer.exists({ _id: customer });
    if (!customerExists) {
      console.log("⚠️ [Customer Not Found]:", customer);
      return res.status(404).json({
        success: false,
        message: "Customer does not exist!",
      });
    }

    console.log("🔍 [Query] Fetching sites for customer:", customer);

    const sites = await Site.find({ customer });

    console.log(
      `✅ [Sites Fetched] Found ${sites.length} sites for customer: ${customer}`
    );

    res.status(200).json({
      success: true,
      message: "😊 Sites fetched successfully",
      sites,
    });
  } catch (error) {
    console.error("❌ [Error] Fetching Sites:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.editSite = async (req, res) => {
  try {
    console.log("🎉 [EDIT SITE] API hit");

    const { siteId, sitename, address } = req.body;

    // ✅ Validate required fields
    if (!siteId || !sitename || !address) {
      console.warn("⚠️ [Validation Failed] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Site ID, Site Name, and Address are required!",
      });
    }

    // ✅ Check if site exists
    const existingSite = await Site.findById(siteId);
    if (!existingSite) {
      console.log("⚠️ [Site Not Found]:", siteId);
      return res.status(404).json({
        success: false,
        message: "Site does not exist!",
      });
    }

    console.log("🔧 [Updating Site] Updating site:", siteId);

    const updatedSite = await Site.findByIdAndUpdate(
      siteId,
      { sitename, address },
      {
        new: true,
        runValidators: true,
      }
    );

    console.log(`✅ [Site Updated] ID: ${updatedSite._id}`);

    res.status(200).json({
      success: true,
      message: "🎉 Site updated successfully",
      site: updatedSite,
    });
  } catch (error) {
    console.error("❌ [Error] Updating Site:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// exports.getSiteHistory = async (req, res) => {
//   try {
//     const { siteId } = req.body;
//     console.log(`📌 Fetching history for site: ${siteId}`);

//     const site = await Site.findById(siteId)
//       .select("history")
//       .populate("history.order history.customer");

//     if (!site) {
//       console.log(`⚠️ Site not found: ${siteId}`);
//       return res.status(404).json({
//         success: false,
//         message: "Site not found",
//       });
//     }

//     console.log(`✅ Successfully fetched history for site: ${siteId}`);
//     res.status(200).json({
//       success: true,
//       history: site.history,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching site history:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// };

// exports.getSiteHistory = async (req, res) => {
//   try {
//     const { siteId } = req.body;
//     console.log(`📌 Fetching history for site: ${siteId}`);

//     const site = await Site.findById(siteId)
//       .select("history")
//       .populate({
//         path: "history.order",
//         populate: {
//           path: "items.subCategory",
//           select: "name",
//         },
//       })
//       .populate({
//         path: "payments",
//         select: "amount paymentMethod paymentType date", // Fetch amount & payment details
//       });

//     if (!site) {
//       console.log(`⚠️ Site not found: ${siteId}`);
//       return res.status(404).json({
//         success: false,
//         message: "Site not found",
//       });
//     }

//     if (!site.history.length && !site.payments.length) {
//       console.log(`ℹ️ No history or payments found for site: ${siteId}`);
//       return res.status(200).json({
//         success: true,
//         history: [],
//         payments: [],
//       });
//     }

//     // Formatting response safely
//     const formattedHistory = site.history
//       .filter((entry) => entry.order && entry.order.items) // Ensure order & items exist
//       .map((entry) => ({
//         type: entry.actionType?.toLowerCase() || "unknown",
//         items: entry.order.items
//           .filter((item) => item.subCategory) // Ensure subCategory exists
//           .map((item) => ({
//             subCategory: item.subCategory.name,
//             quantity:
//               entry.actionType === "RETURN" ? item.returned : item.quantity,
//           })),
//       }));

//     const formattedPayments = site.payments.map((payment) => ({
//       amount: payment.amount,
//       method: payment.paymentMethod,
//       type: payment.paymentType,
//       date: payment.date,
//     }));

//     console.log(`✅ Successfully fetched history for site: ${siteId}`);
//     res.status(200).json({
//       success: true,
//       history: formattedHistory,
//       payments: formattedPayments,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching site history:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// };
exports.getSiteHistory = async (req, res) => {
  try {
    const { siteId } = req.body;
    console.log(`📌 Fetching history for site: ${siteId}`);

    // Fetch site with history and payment details

    // Fetch site with history and payments
    const site = await Site.findById(siteId)
      .select("name history payments dueAmount") // Include site name & due amount
      .populate({
        path: "history.order",
        populate: {
          path: "items.subCategory",
          select: "name",
        },
      });

    if (!site) {
      console.log(`⚠️ Site not found: ${siteId}`);
      return res.status(404).json({
        success: false,
        message: "Site not found",
      });
    }

    // 🛠️ Format Complete History (Orders + Payments)
    const formattedHistory = site.history
      .map((entry) => {
        if (entry.actionType === "payment") {
          // ✅ Format payments stored in history
          return {
            type: "payment",
            date: entry.timestamp || new Date(),
            details: {
              amount: entry.details.amount || 0,
              method: entry.details.paymentMethod || "N/A",
              type: entry.details.paymentType || "N/A",
              remarks: entry.details.remarks || "No remarks",
            },
          };
        } else {
          // ✅ Format order-related history
          return {
            type: entry.actionType || "UNKNOWN",
            date: entry.date || new Date(),
            items:
              entry.order?.items
                .filter((item) => item.subCategory) // Ensure valid items
                .map((item) => ({
                  subCategory: item.subCategory.name,
                  quantity:
                    entry.actionType === "return"
                      ? item.returned
                      : item.quantity,
                })) || [],
          };
        }
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort oldest first

    console.log(`✅ Successfully fetched site history for: ${siteId}`);
    res.status(200).json({
      success: true,
      siteName: site.name,
      dueAmount: site.dueAmount, // 🔹 Include due amount
      history: formattedHistory,
    });
  } catch (error) {
    console.error("❌ Error fetching site history:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
