import { UserModel } from "../models/User.model";
import {
  sendNewOrderStaffAlertEmail,
  sendLowStockAlertEmail,
  sendDeliveryFailedAlertEmail,
} from "./email.service";
import type { Role } from "../constants/roles";

/**
 * Operational alerts for the three events that actually matter day-to-day
 * (a new order landing, stock running out, a delivery failing). This is
 * deliberately not a full notification matrix — there is no per-user
 * subscription model and no in-app inbox; each event just fans an email out
 * to whichever active staff roles own that workflow.
 *
 * Every function here is fire-and-forget at the call site and swallows its
 * own errors, so a mail outage can never fail the operation it describes.
 */
async function recipientsFor(roles: Role[]): Promise<{ email: string; name: string }[]> {
  const users = await UserModel.find({ role: { $in: roles }, isActive: true }).select("email name");
  return users.map((u) => ({ email: u.email, name: u.name }));
}

async function fanOut(roles: Role[], send: (email: string, name: string) => Promise<void>) {
  try {
    const recipients = await recipientsFor(roles);
    await Promise.all(recipients.map((r) => send(r.email, r.name)));
  } catch (err) {
    console.error("[notify] failed to dispatch alert:", (err as Error).message);
  }
}

const ORDER_ROLES: Role[] = ["order_manager", "co_admin", "admin", "super_admin"];
const INVENTORY_ROLES: Role[] = ["co_admin", "admin", "super_admin"];

export async function notifyNewOrder(opts: {
  orderNumber: string;
  totalBDT: number;
  customerName: string;
  itemCount: number;
}): Promise<void> {
  await fanOut(ORDER_ROLES, (email, name) => sendNewOrderStaffAlertEmail(email, name, opts));
}

export async function notifyLowStock(opts: {
  productName: string;
  variantLabel: string;
  stock: number;
  threshold: number;
}): Promise<void> {
  await fanOut(INVENTORY_ROLES, (email, name) => sendLowStockAlertEmail(email, name, opts));
}

export async function notifyDeliveryFailed(opts: {
  orderNumber: string;
  agentName: string;
  failureReason: string;
}): Promise<void> {
  await fanOut(ORDER_ROLES, (email, name) => sendDeliveryFailedAlertEmail(email, name, opts));
}
