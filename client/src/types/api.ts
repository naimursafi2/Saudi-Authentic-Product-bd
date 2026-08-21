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
  twoFactorEnabled: boolean;
  /** Set while a failed-login lockout is in effect. */
  lockedUntil?: string;
  addresses: ApiAddress[];
  staffMeta?: ApiStaffMeta;
  /** Shops this staff member may record/view purchases for. Ids as returned
   * by `GET /users`; populated shop documents from `GET /shops/users/:id`. */
  assignedShops?: (string | ApiShop)[];
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
  | "productShowcase";

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
  isApproved: boolean;
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
  deliveryNotes?: string;
  failureReason?: string;
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
  | "product.delete"
  | "product.stock.update"
  | "inventory.adjust"
  | "refund.request"
  | "refund.approve"
  | "expense.confirm";
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
  note?: string;
  status: ExpenseStatus;
  recordedBy: string | { _id: string; name: string; email: string };
  recordedByRole: Role;
  confirmedBy?: string | { _id: string; name: string; email: string };
  confirmedAt?: string;
  reviewNote?: string;
  linkedRefund?: string;
  createdAt: string;
  updatedAt: string;
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

export interface FinanceSummary {
  totalRevenueBDT: number;
  totalOrders: number;
  totalInvestmentBDT: number;
  totalExpensesBDT: number;
  netProfitBDT: number;
  cashBalanceBDT: number;
  expensesByCategory: Record<ExpenseCategory, number>;
}

// -- Purchasing: shops, purchase batches & flexible landed costs --

export interface ApiShop {
  _id: string;
  name: string;
  code: string;
  location?: string;
  note?: string;
  isActive: boolean;
  createdBy: string | { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

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
  shop: string | { _id: string; name: string; code: string; isActive: boolean };
  product?: string | { _id: string; name: string; slug: string; images: ApiProductImage[] };
  variantId?: string;
  variantLabel?: string;
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
  recordedBy: string | { _id: string; name: string; email: string };
  recordedByRole: Role;
  /** Derived server-side on every read (Mongoose virtuals) — never stored. */
  additionalCostBDT: number;
  totalLandedCostBDT: number;
  unitCostBDT: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCostHistory {
  purchases: ApiPurchase[];
  totalQuantity: number;
  totalLandedCostBDT: number;
  averageUnitCostBDT: number;
}

export interface ApiUserShopAssignment {
  _id: string;
  name: string;
  email: string;
  role: Role;
  assignedShops: ApiShop[];
}
