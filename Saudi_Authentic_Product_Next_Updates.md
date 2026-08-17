# Saudi Authentic Product — Next Updates

## Priority
**Payment Gateway is intentionally skipped for now.**
Do not implement bKash, Nagad, SSLCommerz, webhook, callback, or payment verification in this phase.

## 1. Email Verification — High Priority
Current issue: a newly registered customer can enter the dashboard without completing email verification.

Implement:
- Registration creates the account in an unverified state.
- Send a secure, expiring verification link using the existing SMTP/email service.
- Backend verification endpoint + frontend verification page.
- Handle success, expired, already-used, and invalid states.
- Add resend-verification with expiry/rate-limit protection.
- Enforce the existing auth policy so unverified users cannot access protected customer features.
- Test: registration → verification email → verify → login → dashboard.

## 2. Coupon / Promo Code System — High Priority
Add a real backend-driven coupon system.

Admin/Super Admin:
- Create, edit, delete, enable/disable coupons.
- Coupon code.
- Discount: percentage or fixed amount.
- Start date/time and expiry date/time.
- Minimum order amount.
- Usage limit if supported by the current architecture.
- Status: scheduled / active / expired / disabled.

Customer:
- Coupon field on cart/checkout.
- Validate coupon through the backend.
- Show discount and updated total.
- Reject invalid, inactive, expired, or not-yet-active coupons.
- Final discount must be validated/calculated server-side during order creation; never trust the frontend.

## 3. Access Token Refresh
Fix session expiry:
- Use the existing refresh-token mechanism automatically when the access token expires.
- Retry the failed request after successful refresh.
- Logout only when refresh genuinely fails.
- Verify a session can remain active beyond the access-token lifetime.

## 4. CORS
If multiple origins are intended, properly parse comma-separated `CLIENT_ORIGIN` values while keeping production security strict.

## 5. Co-admin Route UX
Keep backend RBAC/security unchanged, but restricted frontend pages should redirect or show a proper unauthorized state instead of appearing blank/broken when accessed directly.

## 6. Contact Information
Replace the placeholder phone number with the real business contact information when provided.

## 7. Testing
After changes, run backend/frontend typecheck, lint, build and tests, plus browser verification for:
- Registration + email verification
- Coupon → checkout → final order total
- Admin coupon CRUD
- Token refresh
- Protected routes and role restrictions

Do not claim completion without testing the actual flow.

## Important Rule
Before implementing anything, inspect the current codebase. If a feature is already fully implemented and verified, **skip it** and move to the next incomplete item.

Keep `README.md` and `CLAUDE.md` updated with only verified changes.

## Deferred
**Real payment gateway integration is postponed for a later phase.**
