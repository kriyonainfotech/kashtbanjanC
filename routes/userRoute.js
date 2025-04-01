const express = require("express");
const {
  register,
  loginUser,
  getUserById,
  deleteUserData,
} = require("../controllers/userController");
const routes = express.Router();

routes.post("/register", register);
routes.post("/login", loginUser);
routes.post("/byId", getUserById);
routes.delete("/delete", deleteUserData);


module.exports = routes;
