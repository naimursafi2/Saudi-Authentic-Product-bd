// TEMPORARY scratch script for browser verification. Creates one throwaway
// admin in the local dev DB. Delete this file when done.
require("./dev-dns-preload.cjs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const EMAIL = "gw-verify-admin@example.test";

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection("users");
  await users.deleteMany({ email: EMAIL });
  await users.insertOne({
    name: "Gateway Admin",
    email: EMAIL,
    password: await bcrypt.hash("VerifyPass123", 10),
    role: "admin",
    isActive: true,
    isEmailVerified: true,
    twoFactorEnabled: false,
    tokenVersion: 0,
    addresses: [],
    failedLoginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("created:", EMAIL);
  await mongoose.disconnect();
})();
