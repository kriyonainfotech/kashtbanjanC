const express = require("express");
const { register, loginUser, getUserById, deleteUser } = require("../controllers/userController");
const routes = express.Router();

routes.post("/register", register);
routes.post("/login", loginUser);
routes.post("/byId", getUserById)
routes.delete("/delete", deleteUser)


module.exports = routes;
