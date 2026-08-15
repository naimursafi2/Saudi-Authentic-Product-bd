/**
 * Types mirroring the backend's actual JSON shapes (see backend/src/models
 * and backend/src/validators). Kept separate from the legacy mock-data
 * shapes in `product.ts` so the two are never accidentally mixed up while
 * the storefront transitions from local fixtures to the real API.
 */

export type Role = "customer" | "employee" | "co_admin" | "admin" | "super_admin";

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
  phone?: string;
  avatar?: { url: string; publicId: string };
  isActive: boolean;
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

export interface ApiHeroSlide {
  _id: string;
  title: string;
  subtitle?: string;
  image?: { url: string; publicId: string };
  ctaLabel?: string;
  ctaHref?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type HomepageSectionType =
  | "hero"
  | "featuredCategories"
  | "bestSellers"
  | "productStory"
  | "customerReviews"
  | "promoBanner"
  | "productShowcase";

/** `productShowcase` sections only — how the product grid is resolved. */
export type ProductShowcaseMode = "category" | "bestSellers" | "newArrivals" | "onSale";

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
  createdAt: string;
  updatedAt: string;
}

export interface ApiSiteSettings {
  _id: string;
  siteName: string;
  logo?: { url: string; publicId: string };
  announcementText?: string;
  contactEmail?: string;
  contactPhone?: string;
  footerTagline?: string;
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

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
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
  totalBDT: number;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string; note?: string }[];
  createdAt: string;
  updatedAt: string;
}
