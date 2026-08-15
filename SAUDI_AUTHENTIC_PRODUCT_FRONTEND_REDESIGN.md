# Saudi Authentic Product — Frontend UI/UX Redesign

## Goal

Redesign the entire frontend to look **professional, modern, premium, trustworthy, and conversion-focused**, inspired by the overall e-commerce UX quality and structure of Ghorer Bazar.

Reference:
https://ghorerbazar.com/

> Do not copy their branding, text, images, or exact design. Use the reference only for UX/layout inspiration.

---


## Visual Reference — Image 999

Use the provided reference image **`image 999`** as an additional visual/UX reference for the redesign.

- Study its overall e-commerce structure, product grid, filter/sidebar layout, navbar/header, search, category navigation, product cards, pricing, discount badges, and Add to Cart presentation.
- Use it as **design inspiration only**; do not copy its logo, branding, text, exact colors, images, or exact layout.
- Recreate a similar level of polish and usability for **Saudi Authentic Product**, using our own brand identity, existing assets, and Saudi/Madinah-focused product presentation.
- The final result should feel noticeably more complete and professional than the current frontend while remaining original.

---

## 1. Navbar / Header

Create a clean, premium, responsive navbar.

- Left: Saudi Authentic Product logo/brand name
- Center: Home, Shop, Categories, Offers, About, Contact
- Right: Search, Wishlist, Account, Cart with item count
- Add a top announcement bar:
  **“Premium Authentic Saudi Products Delivered Across Bangladesh”**
- Add useful dropdowns for Categories and Account.
- Make the navbar sticky where appropriate.
- Use professional icons (prefer Lucide React).
- No emojis in UI.
- Use deep green, white, gold, and soft beige as the main visual palette.

---

## 2. Homepage / Hero Banner

Redesign the hero/banner to look premium and visually strong.

- Use the provided Saudi/Madinah/date product images from the project's assets.
- Use a strong headline and short supporting text.
- Add clear CTAs such as:
  - Shop Now
  - Explore Dates
- Add supporting benefits below/around the banner:
  - 100% Authentic
  - Imported from Saudi
  - Fast Delivery
  - Quality Assured
- Make the banner fully responsive.
- Use attractive image positioning, balanced whitespace, subtle visual effects, and premium typography.
- Do not use random or unrelated images.

---

## 3. Shop / Product Listing

Redesign the Shop page with a professional e-commerce layout.

### Sidebar Filters

Include:

- Category
- Price Range / Slider
- Brand
- Rating
- Availability
- Offers / Discount

### Product Toolbar

Add:

- Product count
- Sort by Featured
- Price: Low to High
- Price: High to Low
- Newest

### Product Grid

Each product card should include:

- High-quality product image
- Product name
- Price
- Discount / old price when applicable
- Rating
- Wishlist icon
- Clear **Add to Cart** button
- Discount badge such as “Save 20%”
- Optional Quick View

Cards should have consistent image ratios, spacing, hover effects, and clean typography.

---

## 4. Add to Cart

Add a clear and visible **Add to Cart** action on product cards and the Product Details page.

On click:

1. Add product to cart.
2. Update cart count.
3. Show a small success notification.
4. Optionally show a mini-cart/sidebar.

Mini-cart should display:

- Product image
- Product name
- Quantity
- Price
- Subtotal
- View Cart
- Checkout

Keep the existing cart/business logic intact.

---

## 5. Product Details Page

Create a premium product details layout.

Include:

- Large product image
- Thumbnail gallery
- Product name
- Price
- Discount
- Rating/reviews
- Stock status
- Short description
- Quantity selector
- Add to Cart
- Wishlist
- Delivery information
- Return/policy information
- Related products

---

## 6. Categories & Promotional Sections

Use the existing image assets properly.

Create attractive sections for:

- Saudi/Madinah Dates
- Featured Products
- Best Sellers
- New Arrivals
- Offers
- Gift Items
- Future categories such as Watches, Chocolates, Perfumes, Nuts, etc.

Keep the structure scalable so new product categories can easily be added later.

---

## 7. Design System

Use a consistent premium visual language:

- Deep green
- White
- Gold
- Soft beige/cream
- Clean typography
- Professional spacing
- Rounded cards where appropriate
- Subtle shadows
- Smooth hover/transition effects
- Professional Lucide React icons
- No unnecessary emojis

The website should feel like a **premium Saudi product brand serving Bangladeshi customers**, not a generic template.

---

## 8. Images

Review all existing image folders/assets before implementing.

- Identify the purpose of each image.
- Use the correct image in the correct section.
- Use `next/image` for optimization.
- Do not stretch or distort images.
- Maintain consistent aspect ratios.
- Avoid broken, empty, placeholder, or unrelated images.
- Organize assets logically if necessary without breaking imports.

---

## 9. Responsive Design

Everything must work properly on:

- Desktop
- Laptop
- Tablet
- Mobile

Pay special attention to:

- Mobile navbar
- Product grid
- Filters
- Product cards
- Cart
- Hero banner
- Buttons
- Typography
- Spacing

---

## 10. Important Constraints

- Improve the frontend UI/UX without breaking existing functionality.
- Do not change backend logic unnecessarily.
- Do not replace working API integration with mock data.
- Preserve MongoDB, Cloudinary, SMTP, authentication, cart, order, and other existing functionality.
- Do not use emojis where professional icons are appropriate.
- Avoid unnecessary dependencies.
- Reuse existing components where possible.
- Keep code clean, reusable, scalable, and maintainable.

---

## 11. Final Verification

After completing the redesign:

- Test Home
- Shop
- Categories
- Product Details
- Cart
- Checkout
- Login/Register
- Customer Account
- Admin/Employee portals

Verify:

- No broken images
- No layout issues
- No console errors
- No broken links
- No broken API integration
- Add to Cart works
- Filters work
- Search works
- Cart count updates
- Responsive layouts work correctly

Finally run:

- TypeScript typecheck
- Lint
- Production build

Fix all genuine issues before considering the frontend complete.
