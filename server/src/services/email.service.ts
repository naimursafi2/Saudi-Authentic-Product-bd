import { env } from "../config/env";
import { sendMail } from "../config/mailer";
import { DELIVERY_OTP_TTL_MINUTES, REGISTRATION_OTP_TTL_MINUTES } from "../constants/security";

const BRAND = {
  cream: "#fbf9f5",
  green: "#1b4332",
  greenDark: "#012d1d",
  gold: "#d4af37",
  ink: "#1b1c1a",
};

const FRONTEND_URL = env.CLIENT_ORIGIN;

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.cream};font-family:Georgia,'Times New Roman',serif;color:${BRAND.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:${BRAND.greenDark};padding:24px 32px;">
                <span style="color:${BRAND.cream};font-size:20px;letter-spacing:0.03em;">Saudi Authentic Product</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="font-size:20px;margin:0 0 16px;color:${BRAND.green};">${title}</h1>
                <div style="font-size:15px;line-height:1.6;color:${BRAND.ink};">${bodyHtml}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #eae8e4;font-size:12px;color:#705a4c;">
                Saudi Authentic Product &middot; This is an automated message, please do not reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:${BRAND.gold};color:${BRAND.greenDark};text-decoration:none;font-weight:bold;border-radius:4px;">${label}</a>`;
}

/** Never throws — email delivery is best-effort and must not fail the caller's request. */
async function safeSend(to: string, subject: string, html: string): Promise<void> {
  try {
    await sendMail({ to, subject, html });
  } catch (err) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, (err as Error).message);
  }
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/account/reset-password?token=${token}`;
  const html = layout(
    "Reset your password",
    `<p>Hi ${name},</p>
     <p>We received a request to reset your password. This link expires in 30 minutes.</p>
     ${button("Reset Password", resetUrl)}
     <p style="margin-top:24px;font-size:13px;color:#705a4c;">If you didn't request this, you can safely ignore this email.</p>`
  );
  await safeSend(to, "Reset your password — Saudi Authentic Product", html);
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const verifyUrl = `${FRONTEND_URL}/account/verify-email?token=${token}`;
  const html = layout(
    "Verify your email address",
    `<p>Hi ${name},</p>
     <p>Welcome to Saudi Authentic Product! Please confirm your email address to activate your account. This link expires in 24 hours.</p>
     ${button("Verify Email", verifyUrl)}
     <p style="margin-top:24px;font-size:13px;color:#705a4c;">If you didn't create this account, you can safely ignore this email.</p>`
  );
  await safeSend(to, "Verify your email — Saudi Authentic Product", html);
}

/**
 * Registration's primary verification path (see auth.service's
 * registerCustomer/verifyRegistrationOtp) — a code the customer types back
 * in on the same page, rather than a link they have to leave the site to
 * click. Also blocks bot signups: an automated registration can submit the
 * form, but without access to the real inbox it can never get past this
 * step to a working account.
 */
export async function sendVerificationOtpEmail(to: string, name: string, code: string): Promise<void> {
  const html = layout(
    "Verify your email address",
    `<p>Hi ${name},</p>
     <p>Welcome to Saudi Authentic Product! Enter this code on the site to verify your email and finish creating
     your account:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:0.15em;color:${BRAND.green};margin:20px 0;">${code}</p>
     <p style="font-size:13px;color:#705a4c;">This code expires in ${REGISTRATION_OTP_TTL_MINUTES} minutes. If you didn't create this account, you can safely ignore this email.</p>`
  );
  await safeSend(to, "Your verification code — Saudi Authentic Product", html);
}

export async function sendStaffWelcomeEmail(
  to: string,
  name: string,
  opts: { role: string; employeeId?: string; temporaryPassword?: string }
): Promise<void> {
  const html = layout(
    "Welcome to the team",
    `<p>Hi ${name},</p>
     <p>An account has been created for you on Saudi Authentic Product's staff portal as <strong>${opts.role.replace("_", " ")}</strong>.</p>
     ${opts.employeeId ? `<p>Employee ID: <strong>${opts.employeeId}</strong></p>` : ""}
     ${opts.temporaryPassword ? `<p>Temporary password: <strong>${opts.temporaryPassword}</strong> — please change it after your first login.</p>` : ""}
     ${button("Go to Portal", `${FRONTEND_URL}/account`)}`
  );
  await safeSend(to, "Welcome to Saudi Authentic Product", html);
}

export async function sendOrderConfirmationEmail(
  to: string,
  name: string,
  opts: { orderNumber: string; totalBDT: number }
): Promise<void> {
  const html = layout(
    "Order confirmed",
    `<p>Hi ${name},</p>
     <p>Thank you for your order <strong>#${opts.orderNumber}</strong>. We're preparing it now.</p>
     <p>Order total: <strong>৳ ${new Intl.NumberFormat("en-IN").format(Math.round(opts.totalBDT))}</strong></p>`
  );
  await safeSend(to, `Order confirmed — #${opts.orderNumber}`, html);
}

export async function sendDeliveryOtpEmail(
  to: string,
  name: string,
  opts: { orderNumber: string; otp: string }
): Promise<void> {
  const html = layout(
    "Your delivery verification code",
    `<p>Hi ${name},</p>
     <p>Your order <strong>#${opts.orderNumber}</strong> is out for delivery. Share this code with the
     delivery agent once your order arrives to confirm receipt:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:0.15em;color:${BRAND.green};margin:20px 0;">${opts.otp}</p>
     <p style="font-size:13px;color:#705a4c;">This code expires in ${DELIVERY_OTP_TTL_MINUTES} minutes and is also visible on your order tracking page.</p>`
  );
  await safeSend(to, `Delivery code — #${opts.orderNumber}`, html);
}

export async function sendAccountLockedEmail(to: string, name: string, lockMinutes: number): Promise<void> {
  const html = layout(
    "Your account has been temporarily locked",
    `<p>Hi ${name},</p>
     <p>We detected too many failed sign-in attempts on your account, so it has been locked for
     <strong>${lockMinutes} minutes</strong> as a precaution.</p>
     <p>If this was you, simply wait and try again. If it wasn't, reset your password as soon as the lock lifts.</p>
     ${button("Reset Password", `${FRONTEND_URL}/account`)}`
  );
  await safeSend(to, "Account temporarily locked — Saudi Authentic Product", html);
}

export async function sendNewOrderStaffAlertEmail(
  to: string,
  name: string,
  opts: { orderNumber: string; totalBDT: number; customerName: string; itemCount: number }
): Promise<void> {
  const amount = new Intl.NumberFormat("en-IN").format(Math.round(opts.totalBDT));
  const html = layout(
    "New order received",
    `<p>Hi ${name},</p>
     <p>Order <strong>#${opts.orderNumber}</strong> has just been placed by <strong>${opts.customerName}</strong>.</p>
     <p>${opts.itemCount} item(s) &middot; Total: <strong>৳ ${amount}</strong></p>
     ${button("Open Orders", `${FRONTEND_URL}/admin/orders`)}`
  );
  await safeSend(to, `New order — #${opts.orderNumber}`, html);
}

export async function sendLowStockAlertEmail(
  to: string,
  name: string,
  opts: { productName: string; variantLabel: string; stock: number; threshold: number }
): Promise<void> {
  const html = layout(
    "Low stock alert",
    `<p>Hi ${name},</p>
     <p><strong>${opts.productName}</strong> (${opts.variantLabel}) has dropped to
     <strong>${opts.stock}</strong> unit(s), at or below its threshold of ${opts.threshold}.</p>
     ${button("Open Inventory", `${FRONTEND_URL}/admin/inventory`)}`
  );
  await safeSend(to, `Low stock — ${opts.productName}`, html);
}

export async function sendPriceDropAlertEmail(
  to: string,
  name: string,
  opts: { productName: string; slug: string; oldPriceBDT: number; newPriceBDT: number }
): Promise<void> {
  const oldPrice = new Intl.NumberFormat("en-IN").format(Math.round(opts.oldPriceBDT));
  const newPrice = new Intl.NumberFormat("en-IN").format(Math.round(opts.newPriceBDT));
  const html = layout(
    "Price drop on an item you're watching",
    `<p>Hi ${name},</p>
     <p><strong>${opts.productName}</strong> just dropped from
     <span style="text-decoration:line-through;color:#705a4c;">৳ ${oldPrice}</span> to
     <strong>৳ ${newPrice}</strong>.</p>
     ${button("View Product", `${FRONTEND_URL}/product/${opts.slug}`)}`
  );
  await safeSend(to, `Price drop — ${opts.productName}`, html);
}

export async function sendBackInStockAlertEmail(
  to: string,
  name: string,
  opts: { productName: string; slug: string }
): Promise<void> {
  const html = layout(
    "Back in stock",
    `<p>Hi ${name},</p>
     <p><strong>${opts.productName}</strong> is back in stock — grab it before it sells out again.</p>
     ${button("View Product", `${FRONTEND_URL}/product/${opts.slug}`)}`
  );
  await safeSend(to, `Back in stock — ${opts.productName}`, html);
}

export async function sendDeliveryFailedAlertEmail(
  to: string,
  name: string,
  opts: { orderNumber: string; agentName: string; failureReason: string }
): Promise<void> {
  const html = layout(
    "Delivery failed",
    `<p>Hi ${name},</p>
     <p>Delivery of order <strong>#${opts.orderNumber}</strong> failed and needs to be re-dispatched.</p>
     <p>Agent: <strong>${opts.agentName}</strong></p>
     <p>Reason: ${opts.failureReason}</p>
     ${button("Open Orders", `${FRONTEND_URL}/admin/orders`)}`
  );
  await safeSend(to, `Delivery failed — #${opts.orderNumber}`, html);
}

/**
 * Renders a campaign email's HTML without sending it — deliberately NOT
 * wrapped in `safeSend()` the way every other email in this file is.
 * `campaign.service.ts#dispatchCampaign` sends this itself via `sendMail()`
 * directly, one recipient at a time inside `Promise.allSettled`, because it
 * needs to know per-recipient success/failure to build the campaign's
 * delivery stats — `safeSend()` swallowing the error is exactly what every
 * *other* call site in this file wants (an incidental notification must
 * never fail the request that triggered it), but it would make bulk-send
 * results indistinguishable from real deliveries.
 */
export function renderCampaignEmailHtml(opts: { title: string; message: string; imageUrl?: string }): string {
  return layout(
    opts.title,
    `${opts.imageUrl ? `<img src="${opts.imageUrl}" alt="" style="max-width:100%;border-radius:6px;margin-bottom:16px;" />` : ""}
     <div>${opts.message.replace(/\n/g, "<br/>")}</div>`
  );
}

export async function sendCampaignSubmittedEmail(
  to: string,
  name: string,
  opts: { campaignTitle: string; submittedByName: string }
): Promise<void> {
  const html = layout(
    "Campaign submitted for approval",
    `<p>Hi ${name},</p>
     <p><strong>${opts.submittedByName}</strong> submitted the campaign <strong>"${opts.campaignTitle}"</strong> for your approval.</p>
     ${button("Review Campaign", `${FRONTEND_URL}/admin/campaigns`)}`
  );
  await safeSend(to, "Campaign submitted for approval — Saudi Authentic Product", html);
}

export async function sendCampaignReviewedEmail(
  to: string,
  name: string,
  opts: { campaignTitle: string; status: "approved" | "rejected"; reviewNote?: string }
): Promise<void> {
  const html = layout(
    `Your campaign was ${opts.status}`,
    `<p>Hi ${name},</p>
     <p>Your campaign <strong>"${opts.campaignTitle}"</strong> has been <strong>${opts.status}</strong>.</p>
     ${opts.reviewNote ? `<p>Note: ${opts.reviewNote}</p>` : ""}
     ${button("Open Campaigns", `${FRONTEND_URL}/admin/campaigns`)}`
  );
  await safeSend(to, `Campaign ${opts.status} — "${opts.campaignTitle}"`, html);
}

const PENDING_ACTION_LABELS: Record<string, string> = {
  "coupon.create": "a new coupon",
  "coupon.update": "a coupon update",
  "product.delete": "a product deletion",
  "product.stock.update": "a product stock update",
  "inventory.adjust": "a stock adjustment",
  "refund.request": "a refund request",
  "refund.approve": "a refund approval",
  "expense.confirm": "an expense confirmation",
};

export async function sendPendingActionRequestedEmail(
  to: string,
  name: string,
  opts: { actionType: string; requestedByName: string; note?: string }
): Promise<void> {
  const label = PENDING_ACTION_LABELS[opts.actionType] ?? opts.actionType;
  const html = layout(
    "Approval requested",
    `<p>Hi ${name},</p>
     <p><strong>${opts.requestedByName}</strong> has requested ${label} that requires your approval.</p>
     ${opts.note ? `<p>Note: ${opts.note}</p>` : ""}
     ${button("Review Request", `${FRONTEND_URL}/admin/approvals`)}`
  );
  await safeSend(to, "Approval requested — Saudi Authentic Product", html);
}

export async function sendPendingActionReviewedEmail(
  to: string,
  name: string,
  opts: { actionType: string; status: "granted" | "denied"; reviewNote?: string }
): Promise<void> {
  const label = PENDING_ACTION_LABELS[opts.actionType] ?? opts.actionType;
  const verb = opts.status === "granted" ? "approved" : "denied";
  const html = layout(
    `Your request was ${verb}`,
    `<p>Hi ${name},</p>
     <p>Your request for ${label} has been <strong>${verb}</strong> by a Super Admin.</p>
     ${opts.reviewNote ? `<p>Note: ${opts.reviewNote}</p>` : ""}`
  );
  await safeSend(to, `Request ${verb} — Saudi Authentic Product`, html);
}

export async function sendLeaveStatusEmail(
  to: string,
  name: string,
  opts: { status: "approved" | "rejected"; startDate: string; endDate: string; reviewNote?: string }
): Promise<void> {
  const html = layout(
    `Leave request ${opts.status}`,
    `<p>Hi ${name},</p>
     <p>Your leave request from <strong>${opts.startDate}</strong> to <strong>${opts.endDate}</strong> has been <strong>${opts.status}</strong>.</p>
     ${opts.reviewNote ? `<p>Note: ${opts.reviewNote}</p>` : ""}`
  );
  await safeSend(to, `Leave request ${opts.status}`, html);
}

export async function sendTaskAssignedEmail(
  to: string,
  name: string,
  opts: { title: string; dueDate?: string }
): Promise<void> {
  const html = layout(
    "New task assigned",
    `<p>Hi ${name},</p>
     <p>You've been assigned a new task: <strong>${opts.title}</strong>.</p>
     ${opts.dueDate ? `<p>Due: <strong>${opts.dueDate}</strong></p>` : ""}
     ${button("View Tasks", `${FRONTEND_URL}/employee/tasks`)}`
  );
  await safeSend(to, "New task assigned", html);
}

export async function sendSalaryPaymentEmail(
  to: string,
  name: string,
  opts: {
    month: number;
    year: number;
    amountBDT: number;
    dailyAllowanceBDT?: number;
    status: "paid" | "pending";
    note?: string;
  }
): Promise<void> {
  const monthName = new Date(opts.year, opts.month - 1, 1).toLocaleString("en-US", { month: "long" });
  const allowance = opts.dailyAllowanceBDT ?? 0;
  const total = opts.amountBDT + allowance;
  const format = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));
  const breakdown =
    allowance > 0
      ? `<p>Base salary: ৳ ${format(opts.amountBDT)}<br/>Daily allowance: ৳ ${format(allowance)}</p>`
      : "";
  const html =
    opts.status === "paid"
      ? layout(
          "Salary payment processed",
          `<p>Hi ${name},</p>
           <p>Your salary for <strong>${monthName} ${opts.year}</strong> has been processed.</p>
           ${breakdown}
           <p>Amount: <strong>৳ ${format(total)}</strong></p>
           ${opts.note ? `<p>Note: ${opts.note}</p>` : ""}
           ${button("View Payment History", `${FRONTEND_URL}/employee/salary`)}`
        )
      : layout(
          "Salary payment reminder",
          `<p>Hi ${name},</p>
           <p>This is a reminder that your salary for <strong>${monthName} ${opts.year}</strong> (৳ ${format(total)}) is currently marked as pending.</p>`
        );
  await safeSend(
    to,
    opts.status === "paid" ? `Salary paid — ${monthName} ${opts.year}` : `Salary pending — ${monthName} ${opts.year}`,
    html
  );
}
