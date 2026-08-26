# Next Updates Plan

**Project:** Saudi Authentic Product — Multi-Shop BMS  
**Source Date:** August 26, 2026  
**Status:** Next Development Phases

## Phase 1 — Critical Fixes (Do These First)

These are small, low-risk fixes that should be completed before adding more features.

### 1. Refund Rejection Bug
- Fix the refund rejection flow.
- Currently, if the **Reject** action is clicked and the user cancels the reason prompt, the refund may still be rejected.
- Cancelling the prompt must not change the refund status.

### 2. Unused `ASSIGN_AGENT_ROLES` Constant
- Remove the unused `ASSIGN_AGENT_ROLES` constant, or implement it properly if it is actually required.
- It should not remain unused and cause confusion.

### 3. Editable Employee `joinedAt` Date
- Make the employee `joinedAt` / joining date editable.
- Currently, it is automatically set to the current date during creation and cannot be corrected later.

---

# Phase 2 — Missing Core Features

These are important business features that are still missing.

## 1. Employee NID Information

Add:

- NID number field
- NID card image upload
- Backend storage and validation
- Upload route
- Employee form integration
- Employee profile/view display

Reuse the existing Cloudinary upload pattern where appropriate.

## 2. Printable Order Invoice

Create a professional printable invoice containing:

- Company logo
- Customer information
- Customer address
- Order number
- Order date
- Product list
- Subtotal
- Shipping cost
- Discount
- Total amount
- Payment status

Add a:

**Print Invoice**

button.

The existing Order API already contains the required data, so this should mainly be a frontend implementation.

## 3. Daily Allowance

Add a Daily Allowance feature for employees.

Before implementation, decide whether it should be:

- A separate field, or
- A line item inside `SalaryPayment`

The data model should be finalized before implementation.

## 4. Customer Refund Request Form

Create a customer-side:

**Request Refund**

form.

The backend endpoint already exists, so the main missing part is the frontend UI.

---

# Phase 3 — UX/UI Improvements and Admin Panel Polish

## 1. Shared Confirm Dialog

Create a reusable `ConfirmDialog` component based on the existing modal pattern.

Replace raw `window.confirm()` usage across the project, especially for sensitive actions such as:

- Delete
- Reject
- Other irreversible actions

The confirmation UI should be used consistently across all relevant pages.

## 2. Consistent CRUD Action Colors

Use the following color system consistently:

- **Edit / Update:** Light Blue → Darker Blue on hover
- **Delete:** Light Red → Darker Red on hover
- **Save / Approve:** Light Green → Darker Green on hover

Requirements:

- Use text actions where appropriate instead of icon-only actions.
- Add smooth hover transitions.
- Use `cursor: pointer`.
- Keep the design consistent across CRUD pages.

Priority pages include:

- Shops
- Employees
- Purchases
- Customers
- Refunds

## 3. Tooltips for Icon-Only Buttons

Add hover tooltips to icon-only buttons.

`aria-label` should remain for accessibility, but users should also see a visible tooltip on hover.

## 4. Purchase Landed Cost in Finance P&L

Review whether purchase landed cost should be included in the Finance Profit & Loss summary.

- Confirm whether the current behavior is intentional.
- If it is a missing feature, implement it properly.

---

# Phase 4 — Testing and Security

## 1. Run the Full Integration Test Suite

Run the complete integration test suite locally or in CI.

The full suite previously had:

- 16 test files
- 198 passing tests

Verify that the project still passes correctly after the new changes.

## 2. Add Tests for New Features

Write tests for the Phase 2 features:

- Employee NID
- Printable Invoice
- Daily Allowance
- Customer Refund Request

## 3. Permission Security Review

Whenever new custom roles are added, review the permission escalation paths and sensitive permissions.

Make sure unauthorized users cannot gain access to sensitive actions.

---

# Phase 5 — Production Hardening

## 1. Update Documentation

Refresh:

- `README.md`
- `CLAUDE.md`

Remove outdated information and make sure the documentation matches the current system features.

## 2. Production Environment Configuration

Before production release, verify that the correct production credentials are configured for:

- Cloudinary
- SMTP / Email service
- Other required production services

Check the production environment on:

- Render
- Vercel

## 3. Payment Gateway — Postponed for 2 Days

The payment gateway integration will be added **2 days later**.

For now:

- Do not implement the real payment gateway yet.
- Keep the payment system ready for future integration.
- Do not break the existing payment selection UI.
- Prepare the project so that a real provider such as **bKash** or **Nagad** can be integrated later.

After 2 days, the next step will be to implement the real payment gateway flow, including:

- Payment initiation
- Secure payment redirect/API flow
- Payment callback handling
- Transaction verification
- Payment status updates
- Failed payment handling
- Successful payment confirmation
- Order status synchronization
- Database transaction/payment records

## 4. Render Cold Start Review

Review whether Render free-tier cold starts, which may take more than 50 seconds, are negatively affecting the customer experience.

If necessary, consider a production hosting upgrade or optimization strategy.

---

# Recommended Development Order

The recommended order is:

1. Complete all Phase 1 critical fixes.
2. Move directly to Phase 2:
   - Employee NID
   - Printable Invoice
   - Daily Allowance
   - Customer Refund Request
3. Complete Phase 3 UX/UI improvements.
4. Add testing and security improvements in Phase 4.
5. Complete production hardening in Phase 5.
6. Add the real payment gateway integration in 2 days as the next major update.

## Important Note

The current project plan indicates that payment methods may already be selectable in the UI, but a real payment charge/transaction flow is not yet implemented. Therefore, the real payment gateway should be treated as a separate production-ready integration phase and added when the required payment provider credentials and configuration are available.
