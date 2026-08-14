import { connectDatabase, disconnectDatabase } from "../config/db";
import { env } from "../config/env";
import { UserModel } from "../models/User.model";
import { CategoryModel } from "../models/Category.model";
import { ProductModel } from "../models/Product.model";
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
];

async function seed() {
  await connectDatabase();
  console.log("🌱 Seeding database...");

  // -- Super admin --
  const existingSuperAdmin = await UserModel.findOne({ role: "super_admin" });
  if (!existingSuperAdmin) {
    await UserModel.create({
      name: env.SEED_SUPER_ADMIN_NAME,
      email: env.SEED_SUPER_ADMIN_EMAIL,
      password: env.SEED_SUPER_ADMIN_PASSWORD,
      role: "super_admin",
      staffMeta: {
        employeeId: "EMP-0001",
        department: "Management",
        designation: "Super Admin",
      },
    });
    console.log(`✅ Super admin created: ${env.SEED_SUPER_ADMIN_EMAIL}`);
  } else {
    console.log("ℹ️  Super admin already exists, skipping.");
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
    `✅ Sample staff accounts ready (password for any new ones: ${SAMPLE_STAFF_PASSWORD}).`,
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
  console.log(`✅ ${CATEGORIES.length} categories upserted.`);

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
    `✅ ${createdCount} sample products created (${DATE_PRODUCTS.length - createdCount} already existed).`,
  );

  console.log("🌱 Seeding complete.");
  await disconnectDatabase();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
