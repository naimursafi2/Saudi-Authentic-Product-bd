import { env } from "../config/env";
import { sendMail } from "../config/mailer";

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
  opts: { month: number; year: number; amountBDT: number; status: "paid" | "pending"; note?: string }
): Promise<void> {
  const monthName = new Date(opts.year, opts.month - 1, 1).toLocaleString("en-US", { month: "long" });
  const amount = new Intl.NumberFormat("en-IN").format(Math.round(opts.amountBDT));
  const html =
    opts.status === "paid"
      ? layout(
          "Salary payment processed",
          `<p>Hi ${name},</p>
           <p>Your salary for <strong>${monthName} ${opts.year}</strong> has been processed.</p>
           <p>Amount: <strong>৳ ${amount}</strong></p>
           ${opts.note ? `<p>Note: ${opts.note}</p>` : ""}
           ${button("View Payment History", `${FRONTEND_URL}/employee/salary`)}`
        )
      : layout(
          "Salary payment reminder",
          `<p>Hi ${name},</p>
           <p>This is a reminder that your salary for <strong>${monthName} ${opts.year}</strong> (৳ ${amount}) is currently marked as pending.</p>`
        );
  await safeSend(
    to,
    opts.status === "paid" ? `Salary paid — ${monthName} ${opts.year}` : `Salary pending — ${monthName} ${opts.year}`,
    html
  );
}
