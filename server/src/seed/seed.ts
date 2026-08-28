import fs from "fs";
import path from "path";
import { connectDatabase, disconnectDatabase } from "../config/db";
import { ensureSystemRoles } from "../services/role.service";
import { env, isCloudinaryConfigured } from "../config/env";
import { uploadBufferToCloudinary } from "../config/cloudinary";
import { UserModel } from "../models/User.model";
import { CategoryModel } from "../models/Category.model";
import { ProductModel } from "../models/Product.model";
import { HomepageSectionModel } from "../models/HomepageSection.model";
import { HeroSlideModel } from "../models/HeroSlide.model";
import { slugify } from "../utils/slugify";

const CATEGORIES = [
  {
    name: "Dates",
    description:
      "Premium Saudi & Madinah dates — Ajwa, Safawi, Mabroom and more.",
    isComingSoon: false,
    sortOrder: 1,
  },
  {
    name: "Watches",
    description: "Elegant watches, coming soon.",
    isComingSoon: true,
    sortOrder: 2,
  },
  {
    name: "Chocolates",
    description: "Arabian chocolates, coming soon.",
    isComingSoon: true,
    sortOrder: 3,
  },
  {
    name: "Perfumes",
    description: "Authentic Arabian perfumes, coming soon.",
    isComingSoon: true,
    sortOrder: 4,
  },
  {
    name: "Gift Items",
    description: "Curated gift sets, coming soon.",
    isComingSoon: true,
    sortOrder: 5,
  },
  {
    name: "Nuts",
    description: "Premium nuts & dry fruits, coming soon.",
    isComingSoon: true,
    sortOrder: 6,
  },
] as const;

const DATE_PRODUCTS = [
  {
    name: "Ajwa Dates - Premium Madinah",
    tagline: "The Prophet's dates, straight from Madinah's orchards",
    description:
      "Ajwa dates are among the most sought-after dates in the world, grown exclusively in the orchards of Madinah, Saudi Arabia. Soft, dark, and rich with a subtle raisin-like sweetness, they are prized for both their taste and their significance.",
    origin: "Madinah, Saudi Arabia",
    badge: "Best Seller" as const,
    isBestSeller: true,
    isFeatured: true,
    highlights: [
      "100% authentic Madinah Ajwa",
      "Soft & naturally sweet",
      "Rich in fiber and antioxidants",
    ],
    storageInstructions:
      "Store in a cool, dry place. Refrigerate after opening for extended freshness.",
    variants: [
      {
        label: "500g",
        priceBDT: 1200,
        compareAtPriceBDT: 1400,
        stock: 50,
        sku: "AJW-500",
      },
      {
        label: "1kg",
        priceBDT: 2200,
        compareAtPriceBDT: 2600,
        stock: 30,
        sku: "AJW-1000",
      },
    ],
  },
  {
    name: "Safawi Dates - Royal Madinah",
    tagline: "Deep, dark, and irresistibly soft",
    description:
      "Safawi dates are known for their almost-black color, soft texture, and rich caramel-like sweetness. Grown in Madinah, they are a favorite for daily consumption and gifting alike.",
    origin: "Madinah, Saudi Arabia",
    badge: "Authentic" as const,
    isBestSeller: true,
    isFeatured: true,
    highlights: [
      "Deep caramel sweetness",
      "Soft, moist texture",
      "Great source of natural energy",
    ],
    storageInstructions:
      "Store in a cool, dry place. Refrigerate after opening for extended freshness.",
    variants: [
      {
        label: "500g",
        priceBDT: 950,
        compareAtPriceBDT: 1100,
        stock: 60,
        sku: "SAF-500",
      },
      {
        label: "1kg",
        priceBDT: 1800,
        compareAtPriceBDT: 2100,
        stock: 40,
        sku: "SAF-1000",
      },
    ],
  },
  {
    name: "Mabroom Dates - Premium Saudi",
    tagline: "Long, elegant, and delicately sweet",
    description:
      "Mabroom dates are easily recognized by their long, slender shape and semi-firm texture. With a delicate sweetness and pleasant chew, they are a premium choice for connoisseurs.",
    origin: "Qassim, Saudi Arabia",
    badge: "New" as const,
    isFeatured: true,
    highlights: [
      "Distinct long shape",
      "Semi-firm, chewy texture",
      "Delicately sweet flavor",
    ],
    storageInstructions:
      "Store in a cool, dry place. Refrigerate after opening for extended freshness.",
    variants: [
      { label: "500g", priceBDT: 1100, stock: 45, sku: "MAB-500" },
      { label: "1kg", priceBDT: 2000, stock: 25, sku: "MAB-1000" },
    ],
  },
  {
    name: "Sukkari Dates - Golden Saudi",
    tagline: "Sweet, crunchy, and golden brown",
    description:
      "Sukkari dates, meaning 'sugary' in Arabic, are famous for their golden-brown color and satisfying crunch, followed by a burst of natural sweetness. A favorite among dates lovers across Saudi Arabia.",
    origin: "Qassim, Saudi Arabia",
    badge: "Limited" as const,
    highlights: [
      "Golden-brown color",
      "Light, crunchy texture",
      "Naturally very sweet",
    ],
    storageInstructions:
      "Store in a cool, dry place. Refrigerate after opening for extended freshness.",
    variants: [
      { label: "500g", priceBDT: 1050, stock: 35, sku: "SUK-500" },
      { label: "1kg", priceBDT: 1950, stock: 20, sku: "SUK-1000" },
    ],
  },
  {
    name: "Khudri Dates - Everyday Madinah",
    tagline: "A Madinah household staple, soft and mildly sweet",
    description:
      "Khudri dates are a everyday favorite across Saudi Arabia — reddish-brown, semi-soft, and delicately sweet. Versatile enough for daily snacking, baking, or breaking the fast.",
    origin: "Madinah, Saudi Arabia",
    badge: "Authentic" as const,
    highlights: [
      "Everyday Madinah variety",
      "Semi-soft, mild sweetness",
      "Great for cooking & baking",
    ],
    storageInstructions:
      "Store in a cool, dry place. Refrigerate after opening for extended freshness.",
    variants: [
      { label: "500g", priceBDT: 850, stock: 55, sku: "KHU-500" },
      { label: "1kg", priceBDT: 1600, stock: 30, sku: "KHU-1000" },
    ],
  },
  {
    name: "Anbara Dates - Rare Madinah Reserve",
    tagline: "Large, exceptionally rare, reserved for connoisseurs",
    description:
      "Anbara dates are among the largest and rarest date varieties grown in Madinah, prized for their size, soft chew, and deep sweetness. A reserve-tier gift for those who know dates best.",
    origin: "Madinah, Saudi Arabia",
    badge: "Limited" as const,
    isFeatured: true,
    highlights: [
      "Rare, large-format dates",
      "Reserve-tier Madinah harvest",
      "Deep, rounded sweetness",
    ],
    storageInstructions:
      "Store in a cool, dry place. Refrigerate after opening for extended freshness.",
    variants: [
      {
        label: "500g",
        priceBDT: 1500,
        compareAtPriceBDT: 1750,
        stock: 20,
        sku: "ANB-500",
      },
      {
        label: "1kg",
        priceBDT: 2800,
        compareAtPriceBDT: 3200,
        stock: 12,
        sku: "ANB-1000",
      },
    ],
  },
  {
    name: "Segai Dates - Two-Toned Madinah",
    tagline: "Half golden, half brown — a striking natural bicolor",
    description:
      "Segai dates are instantly recognizable by their natural two-tone skin — golden at the crown, deep brown at the base — with a firm bite and balanced sweetness. A conversation-starting addition to any gift box.",
    origin: "Madinah, Saudi Arabia",
    badge: "New" as const,
    isFeatured: true,
    highlights: [
      "Naturally two-toned skin",
      "Firm, balanced sweetness",
      "Striking gift-box centerpiece",
    ],
    storageInstructions:
      "Store in a cool, dry place. Refrigerate after opening for extended freshness.",
    variants: [
      { label: "500g", priceBDT: 1150, stock: 40, sku: "SEG-500" },
      { label: "1kg", priceBDT: 2150, stock: 22, sku: "SEG-1000" },
    ],
  },
  {
    name: "Zahidi Dates - Golden Qassim",
    tagline: "Light, firm, and lightly sweet — the everyday classic",
    description:
      "Zahidi dates are a golden-yellow variety from Qassim, firmer and less syrupy than most, with a light, nutty sweetness. A popular everyday choice that pairs well with tea and coffee.",
    origin: "Qassim, Saudi Arabia",
    badge: "Authentic" as const,
    highlights: [
      "Golden-yellow Qassim variety",
      "Firm texture, light sweetness",
      "Pairs well with tea & coffee",
    ],
    storageInstructions:
      "Store in a cool, dry place. Refrigerate after opening for extended freshness.",
    variants: [
      {
        label: "500g",
        priceBDT: 900,
        compareAtPriceBDT: 1050,
        stock: 48,
        sku: "ZAH-500",
      },
      {
        label: "1kg",
        priceBDT: 1700,
        compareAtPriceBDT: 1950,
        stock: 26,
        sku: "ZAH-1000",
      },
    ],
  },
  {
    name: "Barhi Dates - Soft Honey Dates",
    tagline: "Caramel-soft with a honeyed finish",
    description:
      "Barhi dates are famous for their exceptionally soft, almost custard-like texture and honeyed sweetness. Best enjoyed fresh or lightly chilled — a fast favorite wherever they're introduced.",
    origin: "Qassim, Saudi Arabia",
    badge: "Best Seller" as const,
    isBestSeller: true,
    isFeatured: true,
    highlights: [
      "Exceptionally soft texture",
      "Honeyed, caramel-like finish",
      "Best served fresh or chilled",
    ],
    storageInstructions:
      "Refrigerate immediately on arrival — best enjoyed within a few weeks for peak softness.",
    variants: [
      { label: "500g", priceBDT: 1300, stock: 32, sku: "BAR-500" },
      { label: "1kg", priceBDT: 2400, stock: 18, sku: "BAR-1000" },
    ],
  },
  {
    name: "Khalas Dates - Amber Reserve",
    tagline: "The Gulf's most celebrated everyday date",
    description:
      "Khalas dates are one of the most widely loved varieties across the Gulf — amber-brown, semi-dry, and richly sweet with a subtle toffee note. A pantry essential for any household.",
    origin: "Al-Ahsa, Saudi Arabia",
    badge: "New" as const,
    highlights: [
      "Amber-brown, semi-dry texture",
      "Rich sweetness with toffee notes",
      "A Gulf pantry essential",
    ],
    storageInstructions:
      "Store in a cool, dry place. Refrigerate after opening for extended freshness.",
    variants: [
      { label: "500g", priceBDT: 980, stock: 44, sku: "KHA-500" },
      { label: "1kg", priceBDT: 1850, stock: 24, sku: "KHA-1000" },
    ],
  },
];

const PRODUCT_SHOWCASE_SECTIONS = [
  {
    title: "Premium Dates",
    subtitle: "Our finest Saudi & Madinah dates, handpicked for gifting and everyday indulgence.",
    productMode: "category" as const,
    categorySlug: "dates",
    limit: 8,
    ctaLabel: "Shop All Dates",
    ctaHref: "/shop?category=dates",
    isVisible: true,
    sortOrder: 3,
  },
  {
    title: "More Saudi Date Varieties",
    subtitle: "Rare and regional varieties from across the Kingdom.",
    productMode: "category" as const,
    categorySlug: "dates",
    limit: 6,
    ctaLabel: "View All Varieties",
    ctaHref: "/shop?category=dates",
    isVisible: true,
    sortOrder: 4,
  },
  {
    title: "New Arrivals",
    subtitle: "The latest additions to our collection.",
    productMode: "newArrivals" as const,
    limit: 4,
    ctaLabel: "Shop New Arrivals",
    ctaHref: "/shop",
    isVisible: true,
    sortOrder: 5,
  },
  {
    title: "Today's Offers",
    subtitle: "Limited-time savings on select favorites.",
    productMode: "onSale" as const,
    limit: 4,
    ctaLabel: "View All Offers",
    ctaHref: "/offers",
    isVisible: true,
    sortOrder: 6,
  },
];

async function seed() {
  await connectDatabase();
  // The seven built-in roles carry every account's permissions, so a seeded
  // database should have them even before the server first boots.
  await ensureSystemRoles();
  console.log("Seeding database...");

  // -- Super admin --
  const existingSuperAdmin = await UserModel.findOne({ role: "super_admin" });
  if (!existingSuperAdmin) {
    await UserModel.create({
      name: env.SEED_SUPER_ADMIN_NAME,
      email: env.SEED_SUPER_ADMIN_EMAIL,
      password: env.SEED_SUPER_ADMIN_PASSWORD,
      role: "super_admin",
      isEmailVerified: true,
      staffMeta: {
        employeeId: "EMP-0001",
        department: "Management",
        designation: "Super Admin",
      },
    });
    console.log(`Super admin created: ${env.SEED_SUPER_ADMIN_EMAIL}`);
  } else {
    console.log("Super admin already exists, skipping.");
  }

  // -- Sample staff accounts (admin / co-admin / employees) --
  const SAMPLE_STAFF = [
    {
      name: "Ahmed Rahman",
      email: "admin@saudiauthenticproduct.com",
      role: "admin" as const,
      employeeId: "EMP-0002",
      department: "Management",
      designation: "Operations Admin",
      baseSalaryBDT: 60000,
    },
    {
      name: "Fatima Islam",
      email: "coadmin@saudiauthenticproduct.com",
      role: "co_admin" as const,
      employeeId: "EMP-0003",
      department: "Operations",
      designation: "Co-Admin",
      baseSalaryBDT: 45000,
    },
    {
      name: "Karim Hasan",
      email: "employee1@saudiauthenticproduct.com",
      role: "employee" as const,
      employeeId: "EMP-0004",
      department: "Warehouse",
      designation: "Inventory Associate",
      baseSalaryBDT: 25000,
    },
    {
      name: "Nusrat Jahan",
      email: "employee2@saudiauthenticproduct.com",
      role: "employee" as const,
      employeeId: "EMP-0005",
      department: "Customer Support",
      designation: "Support Associate",
      baseSalaryBDT: 25000,
    },
  ];
  const SAMPLE_STAFF_PASSWORD = "Employee123!";

  for (const staff of SAMPLE_STAFF) {
    const existing = await UserModel.findOne({ email: staff.email });
    if (existing) continue;
    await UserModel.create({
      name: staff.name,
      email: staff.email,
      password: SAMPLE_STAFF_PASSWORD,
      role: staff.role,
      isEmailVerified: true,
      staffMeta: {
        employeeId: staff.employeeId,
        department: staff.department,
        designation: staff.designation,
        baseSalaryBDT: staff.baseSalaryBDT,
        joinedAt: new Date(),
      },
    });
  }
  console.log(
    `Sample staff accounts ready (password for any new ones: ${SAMPLE_STAFF_PASSWORD}).`,
  );

  // -- Categories (upsert by slug) --
  const categoryIdByName = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const slug = slugify(cat.name);
    const doc = await CategoryModel.findOneAndUpdate(
      { slug },
      { $set: { ...cat, slug } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    categoryIdByName.set(cat.name, doc._id.toString());
  }
  console.log(`${CATEGORIES.length} categories upserted.`);

  // -- Sample date products --
  const datesCategoryId = categoryIdByName.get("Dates");
  let createdCount = 0;
  for (const product of DATE_PRODUCTS) {
    const slug = slugify(product.name);
    const existing = await ProductModel.findOne({ slug });
    if (existing) continue;
    await ProductModel.create({
      ...product,
      slug,
      categories: datesCategoryId ? [datesCategoryId] : [],
      images: [],
    });
    createdCount += 1;
  }
  console.log(
    `${createdCount} sample products created (${DATE_PRODUCTS.length - createdCount} already existed).`,
  );

  // -- Default homepage product-showcase sections (upsert by title; safe to re-run) --
  let showcaseCount = 0;
  for (const section of PRODUCT_SHOWCASE_SECTIONS) {
    const result = await HomepageSectionModel.findOneAndUpdate(
      { type: "productShowcase", title: section.title },
      { $setOnInsert: { ...section, type: "productShowcase" } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    if (!result) showcaseCount += 1;
  }
  console.log(`${showcaseCount} homepage product-showcase sections created (rest already existed).`);

  // -- Default homepage banner-carousel images (upsert by title; safe to
  // re-run) — three so a fresh install's carousel already shows the
  // "more than two banners" behaviour, not just the two-up desktop case.
  // Admin/Co-Admin/Super Admin can still replace/add/remove/reorder them
  // from /admin/homepage exactly like any other `banner`-type section.
  // Skipped entirely when Cloudinary isn't configured, same guard the live
  // upload endpoints use.
  const BANNER_SEEDS = [
    { title: "demo1", file: "banner1.png", sortOrder: 0.5 },
    { title: "demo2", file: "banner2.png", sortOrder: 0.6 },
    { title: "offer", file: "offer.png", sortOrder: 0.7 },
  ];
  if (isCloudinaryConfigured) {
    let bannerCount = 0;
    for (const banner of BANNER_SEEDS) {
      const existing = await HomepageSectionModel.findOne({ type: "banner", title: banner.title });
      if (existing) continue;
      const filePath = path.join(__dirname, "assets", banner.file);
      if (!fs.existsSync(filePath)) continue;
      const buffer = fs.readFileSync(filePath);
      const uploaded = await uploadBufferToCloudinary(buffer, {
        folder: "saudi-authentic-product/homepage",
      });
      await HomepageSectionModel.create({
        type: "banner",
        title: banner.title,
        image: { url: uploaded.url, publicId: uploaded.publicId },
        isVisible: true,
        sortOrder: banner.sortOrder,
      });
      bannerCount += 1;
    }
    console.log(`${bannerCount} homepage banners created (rest already existed).`);
  } else {
    console.log("Cloudinary not configured — skipped demo banner seeding.");
  }

  // -- Default homepage hero-carousel slides (upsert by title; safe to
  // re-run). The storefront hero is image-only (no title/subtitle/CTA
  // rendered — see HeroCarousel.tsx), so `title` here is purely an internal
  // label for the admin table; it reuses the same "Premium Dates" artwork
  // as the banner-carousel seeds above rather than duplicating image files.
  // Skipped entirely when Cloudinary isn't configured, same guard as above.
  const HERO_SLIDE_SEEDS = [
    { title: "Premium Dates — Ramadan", file: "banner1.png", sortOrder: 0 },
    { title: "Premium Dates — Nature's Gift", file: "banner2.png", sortOrder: 1 },
  ];
  if (isCloudinaryConfigured) {
    let heroSlideCount = 0;
    for (const slide of HERO_SLIDE_SEEDS) {
      const existing = await HeroSlideModel.findOne({ title: slide.title });
      if (existing) continue;
      const filePath = path.join(__dirname, "assets", slide.file);
      if (!fs.existsSync(filePath)) continue;
      const buffer = fs.readFileSync(filePath);
      const uploaded = await uploadBufferToCloudinary(buffer, {
        folder: "saudi-authentic-product/hero",
      });
      await HeroSlideModel.create({
        title: slide.title,
        image: { url: uploaded.url, publicId: uploaded.publicId },
        isActive: true,
        sortOrder: slide.sortOrder,
      });
      heroSlideCount += 1;
    }
    console.log(`${heroSlideCount} homepage hero slides created (rest already existed).`);
  } else {
    console.log("Cloudinary not configured — skipped hero slide seeding.");
  }

  console.log("Seeding complete.");
  await disconnectDatabase();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
