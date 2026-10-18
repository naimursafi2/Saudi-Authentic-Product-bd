/**
 * One-off migration: bKash and Nagad were removed as payment methods (online
 * payment now goes through SSLCommerz). Orders still stored with
 * `paymentMethod: "bkash" | "nagad"` fail Mongoose validation the next time
 * they are saved (e.g. when staff change their status), so this moves them to
 * `cod`. `isPaid` is left exactly as it is, so an order already marked paid
 * stays paid.
 *
 *   npm run migrate:legacy-payment-methods            # dry run: lists what would change
 *   npm run migrate:legacy-payment-methods -- --apply # actually updates
 *
 * Old bKash Payment records are kept untouched as financial history.
 */
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db";

const LEGACY_METHODS = ["bkash", "nagad"];

async function main() {
  const apply = process.argv.includes("--apply");
  await connectDatabase();

  const orders = mongoose.connection.collection("orders");
  const filter = { paymentMethod: { $in: LEGACY_METHODS } };
  const affected = await orders
    .find(filter, { projection: { orderNumber: 1, paymentMethod: 1, isPaid: 1, status: 1 } })
    .toArray();

  if (affected.length === 0) {
    console.log("No orders use bKash or Nagad — nothing to migrate.");
  } else {
    console.log(`${affected.length} order(s) still use bKash/Nagad:`);
    for (const o of affected) {
      console.log(`  ${o.orderNumber}  ${o.paymentMethod}  status=${o.status}  ${o.isPaid ? "paid" : "unpaid"}`);
    }
    if (apply) {
      const result = await orders.updateMany(filter, { $set: { paymentMethod: "cod" } });
      console.log(`Updated ${result.modifiedCount} order(s) to paymentMethod "cod".`);
    } else {
      console.log('Dry run only. Re-run with "-- --apply" to switch them to "cod".');
    }
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
