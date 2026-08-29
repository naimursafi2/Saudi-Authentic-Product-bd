/**
 * Types mirroring the backend's actual JSON shapes (see backend/src/models
 * and backend/src/validators). Kept separate from the legacy mock-data
 * shapes in `product.ts` so the two are never accidentally mixed up while
 * the storefront transitions from local fixtures to the real API.
 */

export type Role =
  | "customer"
  | "employee"
  | "delivery_agent"
  | "co_admin"
  | "order_manager"
  | "admin"
  | "super_admin";

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiAddress {
  _id: string;
  label: string;
  fullAddress: string;
  district: string;
  cityArea: string;
  phone: string;
  isDefault: boolean;
}

export interface ApiStaffMeta {
  employeeId: string;
  department?: string;
  designation?: string;
  joinedAt?: string;
  baseSalaryBDT?: number;
  nidNumber?: string;
  nidImage?: { url: string; publicId: string };
}

export interface ApiUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  /** Populated custom role (key + name only) when one is assigned. It ADDS
   * permissions on top of `role` and never replaces it. */
  customRole?: { _id: string; key: string; name: string } | null;
  phone?: string;
  avatar?: { url: string; publicId: string };
  isActive: boolean;
  isEmailVerified: boolean;
  /** Set while a failed-login lockout is in effect. */
  lockedUntil?: string;
  addresses: ApiAddress[];
  staffMeta?: ApiStaffMeta;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCategoryRef {
  _id: string;
  name: string;
  slug: string;
}

export interface ApiCategory extends ApiCategoryRef {
  description?: string;
  image?: { url: string; publicId: string };
  isComingSoon: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface ApiProductImage {
  url: string;
  publicId: string;
  isPrimary?: boolean;
}

export interface ApiProductVariant {
  _id: string;
  label: string;
  priceBDT: number;
  compareAtPriceBDT?: number;
  stock: number;
  lowStockThreshold: number;
  sku?: string;
}

export type ProductBadge = "Authentic" | "Best Seller" | "New" | "Limited";

export interface ApiProduct {
  _id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  origin: string;
  categories: ApiCategoryRef[] | string[];
  images: ApiProductImage[];
  badge?: ProductBadge;
  variants: ApiProductVariant[];
  highlights: string[];
  storageInstructions?: string;
  ratingAverage: number;
  ratingCount: number;
  isBestSeller: boolean;
  isFeatured: boolean;
  isActive: boolean;
  minPriceBDT: number;
  createdAt: string;
  updatedAt: string;
}

/** A role document from `GET /roles` — built-in (isSystem) or custom. */
export interface ApiRole {
  _id: string;
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  /** How many users currently have this role — the panel warns before a
   * delete that would strand them. */
  assignedUserCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPermissionGroup {
  group: string;
  permissions: { key: string; label: string }[];
}

export interface ApiUserPermissions {
  user: { id: string; name: string; email: string; role: Role };
  customRole: { id: string; key: string; name: string } | null;
  permissions: string[];
}

export interface ApiHeroSlide {
  _id: string;
  title: string;
  subtitle?: string;
  image?: { url: string; publicId: string };
  ctaLabel?: string;
  ctaHref?: string;
  /** Optional second button beside the main CTA — see HeroSlide.model.ts. */
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type HomepageSectionType =
  | "hero"
  | "trustStrip"
  | "featuredCategories"
  | "bestSellers"
  | "productStory"
  | "customerReviews"
  | "promoBanner"
  | "productShowcase"
  | "banner";

/** `productShowcase` sections only — how the product grid is resolved. */
export type ProductShowcaseMode = "category" | "bestSellers" | "newArrivals" | "onSale";

/** `trustStrip` sections only — one benefit/trust icon+label item. */
export interface ApiTrustStripBlock {
  icon: StaticPageBlockIcon;
  label: string;
  isVisible: boolean;
}

export interface ApiHomepageSection {
  _id: string;
  type: HomepageSectionType;
  title?: string;
  subtitle?: string;
  description?: string;
  image?: { url: string; publicId: string };
  ctaLabel?: string;
  ctaHref?: string;
  isVisible: boolean;
  sortOrder: number;
  categorySlug?: string;
  productMode?: ProductShowcaseMode;
  limit?: number;
  blocks?: ApiTrustStripBlock[];
  createdAt: string;
  updatedAt: string;
}

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "twitter"
  | "youtube"
  | "linkedin"
  | "whatsapp"
  | "tiktok";

export interface ApiSocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface ApiSiteSettings {
  _id: string;
  siteName: string;
  logo?: { url: string; publicId: string };
  /** Storefront renders the announcement strip only when this is true. */
  announcementEnabled?: boolean;
  announcementText?: string;
  contactEmail?: string;
  contactPhone?: string;
  footerTagline?: string;
  socialLinks: ApiSocialLink[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin-editable shipping rules. The storefront uses these to *display* a
 * shipping estimate; the server recomputes the charged fee from its own copy
 * on every order, so these values are never authoritative client-side.
 */
export interface ApiShippingSettings {
  _id: string;
  insideDhakaChargeBDT: number;
  outsideDhakaChargeBDT: number;
  expressSurchargeBDT: number;
  freeShippingEnabled: boolean;
  freeShippingMinOrderBDT: number;
  freeShippingAppliesToExpress: boolean;
  standardDeliveryDays: number;
  expressDeliveryDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiNavLink {
  _id: string;
  label: string;
  href: string;
  sortOrder: number;
  isVisible: boolean;
  openInNewTab: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiFooterLink {
  label: string;
  href: string;
  sortOrder: number;
}

export interface ApiFooterColumn {
  _id: string;
  heading: string;
  sortOrder: number;
  isVisible: boolean;
  links: ApiFooterLink[];
  createdAt: string;
  updatedAt: string;
}

export type StaticPageType = "about" | "contact" | "shippingPolicy";

export type StaticPageBlockIcon =
  | "BadgeCheck"
  | "ShieldCheck"
  | "Globe"
  | "HandCoins"
  | "Truck"
  | "Clock"
  | "Package"
  | "Award"
  | "Star"
  | "Leaf";

export interface ApiStaticPageBlock {
  title: string;
  body: string;
  icon?: StaticPageBlockIcon;
  isVisible: boolean;
}

export interface ApiStaticPage {
  _id: string;
  type: StaticPageType;
  heroTitle?: string;
  heroDescription?: string;
  heroImage?: { url: string; publicId: string };
  introText?: string;
  addressLine?: string;
  blocks: ApiStaticPageBlock[];
  ctaTitle?: string;
  ctaDescription?: string;
  ctaButtonLabel?: string;
  ctaButtonHref?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiReview {
  _id: string;
  product: string | { _id: string; name: string; slug: string };
  customer: string | { _id: string; name: string; email?: string };
  rating: number;
  comment: string;
  images: { url: string; publicId: string }[];
  isApproved: boolean;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "ready_for_dispatch"
  | "assigned_to_agent"
  | "picked_up"
  | "out_for_delivery"
  | "otp_verified"
  | "delivered"
  | "delivery_failed"
  | "cancelled"
  | "returned"
  | "refunded";
export type DeliveryMethod = "standard" | "express";
export type PaymentMethod = "cod" | "bkash" | "nagad";

export interface ApiOrderItem {
  product: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  unitPriceBDT: number;
  quantity: number;
  lineTotalBDT: number;
}

export interface ApiShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  fullAddress: string;
  district: string;
  cityArea: string;
}

export interface ApiOrder {
  _id: string;
  orderNumber: string;
  customer: string | { _id: string; name: string; email: string };
  items: ApiOrderItem[];
  shippingAddress: ApiShippingAddress;
  deliveryMethod: DeliveryMethod;
  shippingFeeBDT: number;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  subtotalBDT: number;
  couponCode?: string;
  discountBDT: number;
  totalBDT: number;
  status: OrderStatus;
  statusHistory: {
    status: OrderStatus;
    previousStatus?: OrderStatus;
    at: string;
    note?: string;
    changedBy?: string;
    changedByRole?: Role;
  }[];
  assignedAgent?: string | { _id: string; name: string; email: string };
  /** Present whenever an OTP is currently outstanding (never the code itself —
   * that's owner-only, see `otp` on the API response). Used to tell whether
   * "Send Delivery OTP" or the code-entry form should render. */
  otpGeneratedAt?: string;
  otpExpiresAt?: string;
  /** True only once a `delivered` transition went through real OTP verification. */
  deliveryVerified?: boolean;
  deliveredAt?: string;
  deliveredBy?: string | { _id: string; name: string; email: string };
  deliveryNotes?: string;
  failureReason?: string;
  deliveryProofImage?: { url: string; publicId: string };
  /** Derived, never stored — absent once the order is delivered/cancelled/returned/refunded/delivery_failed. */
  estimatedDeliveryDate?: string;
  createdAt: string;
  updatedAt: string;
}

// -- Payments (bKash gateway transactions) --

/** Only gateway-settled payments get a record — a `cod` order is fully described by the Order itself. */
export type PaymentProvider = "bkash";

export type PaymentStatus =
  | "unpaid"
  | "initiated"
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export interface ApiPayment {
  _id: string;
  order: string | { _id: string; orderNumber: string; totalBDT: number; status: OrderStatus };
  customer: string | { _id: string; name: string; email: string };
  provider: PaymentProvider;
  /** Always the server-computed order total — never anything the browser sent. */
  amountBDT: number;
  currency: string;
  status: PaymentStatus;
  gatewayPaymentId: string;
  /** bKash's own transaction id, present only once the payment is verified. */
  transactionId?: string;
  merchantInvoiceNumber: string;
  paidAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** The safe subset returned when a payment is created — enough to send the customer to bKash, nothing more. */
export interface ApiCreatedPayment {
  id: string;
  gatewayPaymentId: string;
  bkashURL: string;
  amountBDT: number;
  currency: string;
  status: PaymentStatus;
}

// -- Internal upload lifecycle (staff/admin uploads; customer uploads excluded) --

export type InternalAssetStatus = "active" | "delete_requested" | "recycled" | "purged";
export type InternalAssetKind = "image" | "document" | "other";

export interface ApiInternalAssetEvent {
  action:
    | "uploaded"
    | "delete_requested"
    | "delete_rejected"
    | "recycled"
    | "restored"
    | "purged"
    | "purge_failed";
  at: string;
  by?: string | { _id: string; name: string; email: string };
  byRole?: Role;
  note?: string;
}

export interface ApiInternalAsset {
  _id: string;
  publicId: string;
  url: string;
  fileName?: string;
  mimeType?: string;
  kind: InternalAssetKind;
  bytes?: number;
  /** Mongoose model the file hangs off — generic, so no module is hardcoded. */
  resource: string;
  resourceId?: string;
  fieldPath?: string;
  module?: string;
  uploadedBy: string | { _id: string; name: string; email: string };
  uploadedByRole: Role;
  status: InternalAssetStatus;
  deleteRequestedBy?: string | { _id: string; name: string; email: string };
  deleteRequestedByRole?: Role;
  deleteRequestedAt?: string;
  deleteReason?: string;
  reviewedBy?: string | { _id: string; name: string; email: string };
  reviewedAt?: string;
  reviewNote?: string;
  recycledAt?: string;
  /** When the scheduler may permanently delete it. Present only in the Recycle Bin. */
  purgeAfter?: string;
  purgedAt?: string;
  purgeAttempts: number;
  purgeError?: string;
  history: ApiInternalAssetEvent[];
  createdAt: string;
  updatedAt: string;
}

export type CouponDiscountType = "percentage" | "fixed";
export type CouponStatus = "scheduled" | "active" | "expired" | "disabled";

export interface ApiCoupon {
  _id: string;
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmountBDT: number;
  startsAt: string;
  expiresAt: string;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
  status: CouponStatus;
  createdAt: string;
  updatedAt: string;
}

// -- Approval gate (pending_actions) & audit logging --

export type PendingActionType =
  | "coupon.create"
  | "coupon.update"
  | "product.create"
  | "product.delete"
  | "product.stock.update"
  | "inventory.adjust"
  | "refund.request"
  | "refund.approve"
  | "expense.confirm"
  | "expense.edit"
  | "purchase.receive";
export type PendingActionStatus = "pending" | "granted" | "denied";

export interface ApiPendingAction {
  _id: string;
  actionType: PendingActionType;
  payload: Record<string, unknown>;
  /**
   * Other still-pending stock requests writing to a variant this one also
   * touches. Both would apply in grant order — deltas compose, absolute
   * updates are last-grant-wins — so the reviewer is warned before granting.
   * Always empty for non-stock action types.
   */
  conflictingActionIds?: string[];
  requestedBy: string | { _id: string; name: string; email: string };
  requestedByRole: Role;
  status: PendingActionStatus;
  note?: string;
  reviewedBy?: string | { _id: string; name: string; email: string };
  reviewedAt?: string;
  reviewNote?: string;
  resultResourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiAuditLog {
  _id: string;
  actor: string | { _id: string; name: string; email: string };
  actorRole: Role;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  note?: string;
  createdAt: string;
}

export interface ApiApprovalSettings {
  _id: string;
  couponAutoApprovePercent: number;
  couponSuperAdminOnlyAbovePercent: number;
  refundAutoApproveThresholdBDT: number;
  expenseApprovalThresholdBDT: number;
  createdAt: string;
  updatedAt: string;
}

// -- Finance module --

export interface ApiInvestment {
  _id: string;
  investorName: string;
  amountBDT: number;
  investedAt: string;
  note?: string;
  recordedBy: string | { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory =
  | "product_purchase"
  | "packaging"
  | "delivery"
  | "shipping"
  | "marketing"
  | "advertising"
  | "warehouse"
  | "salaries"
  | "software"
  | "payment_fees"
  | "refund"
  | "other";
export type ExpenseStatus = "pending" | "confirmed" | "rejected";

export interface ApiExpense {
  _id: string;
  category: ExpenseCategory;
  amountBDT: number;
  incurredAt: string;
  reason: string;
  otherCategoryDetail?: string;
  note?: string;
  cashMemo?: { url: string; publicId?: string };
  status: ExpenseStatus;
  recordedBy: string | { _id: string; name: string; email: string };
  recordedByRole: Role;
  confirmedBy?: string | { _id: string; name: string; email: string };
  confirmedAt?: string;
  reviewNote?: string;
  linkedRefund?: string;
  /** Set once this record has been edited — directly by a Super Admin, or via an approved edit request. */
  lastEditedAt?: string;
  lastEditedBy?: string | { _id: string; name: string; email: string };
  /** True when `lastEditedAt`/`lastEditedBy` were set by an approved `expense.edit` request rather than a direct edit. */
  lastEditViaRequest: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One archived calendar month's worth of expenses — see "Monthly Expense Pages / Archive". */
export interface ExpenseMonthSummary {
  /** `"YYYY-MM"` */
  month: string;
  totalBDT: number;
  count: number;
}

export type RefundReasonCategory = "damaged" | "wrong_item" | "not_as_described" | "changed_mind" | "other";
export type RefundStatus = "pending_review" | "pending_approval" | "approved" | "rejected";

export interface ApiRefund {
  _id: string;
  order: string | { _id: string; orderNumber: string; totalBDT: number };
  customer: string | { _id: string; name: string; email: string };
  reasonCategory: RefundReasonCategory;
  requestedAmountBDT: number;
  note?: string;
  status: RefundStatus;
  requestedBy: string | { _id: string; name: string; email: string };
  requestedByRole: Role;
  reviewedBy?: string | { _id: string; name: string; email: string };
  reviewedAt?: string;
  reviewNote?: string;
  approvedBy?: string | { _id: string; name: string; email: string };
  approvedAt?: string;
  linkedExpense?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReturnRequestType = "return" | "exchange";
export type ReturnRequestStatus = "pending" | "approved" | "rejected";

export interface ApiReturnRequest {
  _id: string;
  order: string | { _id: string; orderNumber: string; totalBDT: number; status: OrderStatus };
  customer: string | { _id: string; name: string; email: string };
  type: ReturnRequestType;
  reasonCategory: RefundReasonCategory;
  note?: string;
  desiredExchangeDetails?: string;
  status: ReturnRequestStatus;
  reviewedBy?: string | { _id: string; name: string; email: string };
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiDeliveryAgentPerformance {
  agentId: string;
  name: string;
  email: string;
  isActive: boolean;
  assignedCount: number;
  deliveredCount: number;
  failedCount: number;
  successRate: number | null;
  averageDeliveryHours: number | null;
}

/** The profit-and-loss statement for a date range. Reads top to bottom:
 * net selling revenue − cost of goods sold = gross profit, then − operating
 * expenses = net profit/loss. See `server/src/services/finance.service.ts`. */
export interface FinanceSummary {
  /** Top-line sales including the shipping charged to customers. */
  totalRevenueBDT: number;
  totalOrders: number;
  /** Subtotal minus discount — shipping excluded, since it is pass-through rather than merchandise revenue. */
  netSellingRevenueBDT: number;
  /** Each sold unit's actual landed cost, frozen onto the order at sale time from its Purchase batch. */
  costOfGoodsSoldBDT: number;
  grossProfitBDT: number;
  /** Orders holding at least one item with no purchase-batch cost history — the COGS figure is a partial total. */
  ordersWithUnknownCostBasis: number;
  totalInvestmentBDT: number;
  totalExpensesBDT: number;
  /** Gross profit minus operating expenses — nets both merchandise cost and operational spend. */
  netProfitBDT: number;
  cashBalanceBDT: number;
  expensesByCategory: Record<ExpenseCategory, number>;
}

// -- Purchasing: purchase batches & flexible landed costs --

/** One free-text cost attached to a purchase. There is no category enum here
 * on purpose — see `server/src/models/Purchase.model.ts`. */
export interface ApiPurchaseCostItem {
  _id: string;
  name: string;
  amountBDT: number;
  note?: string;
  proof?: { url: string; publicId: string };
  addedBy: string | { _id: string; name: string; email: string };
  addedAt: string;
}

export type PurchaseStatus = "draft" | "awaiting_stock_approval" | "received" | "cancelled";

export interface ApiPurchase {
  _id: string;
  reference: string;
  product?: string | { _id: string; name: string; slug: string; images: ApiProductImage[] };
  variantId?: string;
  variantLabel?: string;
  category?: string | { _id: string; name: string; slug: string };
  itemName: string;
  supplierName?: string;
  purchasedAt: string;
  quantity: number;
  unit: string;
  productCostBDT: number;
  costItems: ApiPurchaseCostItem[];
  note?: string;
  status: PurchaseStatus;
  stockPendingActionId?: string;
  receivedAt?: string;
  /** How many of `quantity` units haven't been drawn on by a sale yet — `0` until the batch is `received`. */
  remainingQuantity: number;
  recordedBy: string | { _id: string; name: string; email: string };
  recordedByRole: Role;
  /** Derived server-side on every read (Mongoose virtuals) — never stored. */
  additionalCostBDT: number;
  totalLandedCostBDT: number;
  unitCostBDT: number;
  /** `quantity - remainingQuantity` once received, `0` before that. */
  soldQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseInventoryMovement {
  _id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  note?: string;
  actor?: { _id: string; name: string };
  unitCostBDT?: number;
  createdAt: string;
}

export interface PurchaseRelatedOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  quantityDrawn: number;
}

export interface PurchaseTraceability {
  movements: PurchaseInventoryMovement[];
  relatedOrders: PurchaseRelatedOrder[];
}

export interface ProductCostHistory {
  purchases: ApiPurchase[];
  totalQuantity: number;
  totalLandedCostBDT: number;
  averageUnitCostBDT: number;
}

// -- Customer Messaging / Campaign Management --

export type CampaignStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "rejected"
  | "failed";

export type CampaignScheduleType = "now" | "weekly" | "monthly" | "custom";
export type CampaignChannel = "email" | "sms" | "website";
export type CampaignAudienceType = "all" | "selected" | "specific";

export interface ApiCampaignSchedule {
  type: CampaignScheduleType;
  sendAt?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour?: number;
  minute?: number;
}

export interface ApiCampaignTargetAudience {
  type: CampaignAudienceType;
  customerIds: string[];
}

export interface ApiCampaignChannelResult {
  channel: CampaignChannel;
  status: "sent" | "failed" | "skipped";
  recipientCount: number;
  successCount: number;
  failureCount: number;
  skippedReason?: string;
  failures: { recipient: string; reason: string }[];
}

export interface ApiCampaignDelivery {
  _id: string;
  triggeredAt: string;
  triggeredBy?: string;
  trigger: "scheduled" | "manual";
  recipientCount: number;
  channelResults: ApiCampaignChannelResult[];
}

export interface ApiCampaign {
  _id: string;
  title: string;
  message: string;
  image?: { url: string; publicId: string };
  targetAudience: ApiCampaignTargetAudience;
  channels: CampaignChannel[];
  schedule: ApiCampaignSchedule;
  status: CampaignStatus;
  approvalStatus: "not_required" | "pending" | "approved" | "rejected";
  createdBy: string | { _id: string; name: string; email: string };
  createdByRole: Role;
  reviewedBy?: string | { _id: string; name: string; email: string };
  reviewedAt?: string;
  reviewNote?: string;
  nextRunAt?: string;
  lastSentAt?: string;
  sendCount: number;
  deliveries: ApiCampaignDelivery[];
  createdAt: string;
  updatedAt: string;
}

export interface CampaignChannelStatus {
  email: boolean;
  sms: boolean;
  website: boolean;
}

export interface CampaignAudiencePreview {
  total: number;
  withEmail: number;
  withPhone: number;
}

export interface CustomerStats {
  total: number;
  verified: number;
  unverified: number;
  active: number;
  inactive: number;
}

export type ProductAlertType = "price_drop" | "back_in_stock";

/** The "Notify Me" subscriptions on a product page — see `productAlert.service.ts`. */
export interface ApiProductAlert {
  _id: string;
  product: ApiProduct | string;
  variantId: string;
  variantLabel: string;
  type: ProductAlertType;
  referencePriceBDT?: number;
  isActive: boolean;
  notifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiNotification {
  _id: string;
  campaign?: string;
  title: string;
  message: string;
  image?: { url: string; publicId: string };
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}
