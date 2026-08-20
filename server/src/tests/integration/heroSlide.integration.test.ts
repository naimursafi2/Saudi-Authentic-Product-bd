/**
 * Hero-slide (homepage banner carousel) integration tests.
 *
 * Cloudinary is stubbed rather than configured: uploads are guarded by
 * `isCloudinaryConfigured`, so the real module would reject every create with
 * a 503 in the test environment and none of the CRUD/RBAC behaviour below
 * could be exercised. Same pattern as notification.integration.test.ts —
 * mock first, import the app after, so the service picks up the stub.
 */
const uploadBufferToCloudinary = jest
  .fn()
  .mockResolvedValue({ url: "https://cdn.test/banner.jpg", publicId: "hero/banner" });
const deleteCloudinaryImage = jest.fn().mockResolvedValue(undefined);

jest.mock("../../config/cloudinary", () => ({
  uploadBufferToCloudinary: (...args: unknown[]) => uploadBufferToCloudinary(...args),
  deleteCloudinaryImage: (...args: unknown[]) => deleteCloudinaryImage(...args),
}));

import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { HeroSlideModel } from "../../models/HeroSlide.model";

const app = createApp();
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** Creates a slide through the HTTP API as the given staff token. */
function postSlide(token: string, fields: Record<string, string>) {
  const req = request(app).post("/api/v1/hero-slides").set(...authHeader(token));
  for (const [key, value] of Object.entries(fields)) req.field(key, value);
  return req.attach("image", PIXEL, "banner.png");
}

describe("Hero slides (homepage banner carousel)", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("serves only active slides publicly, in sort order, while the admin view sees all", async () => {
    await HeroSlideModel.create([
      { title: "Second", sortOrder: 2, isActive: true },
      { title: "First", sortOrder: 1, isActive: true },
      { title: "Hidden", sortOrder: 0, isActive: false },
    ]);

    const publicRes = await request(app).get("/api/v1/hero-slides");
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.slides.map((s: { title: string }) => s.title)).toEqual([
      "First",
      "Second",
    ]);

    const { token } = await createAuthedUser({ role: "admin" });
    const adminRes = await request(app)
      .get("/api/v1/hero-slides?includeInactive=true")
      .set(...authHeader(token));
    expect(adminRes.body.data.slides.map((s: { title: string }) => s.title)).toEqual([
      "Hidden",
      "First",
      "Second",
    ]);
  });

  it("lets a co-admin create a slide, including both CTA buttons", async () => {
    const { token } = await createAuthedUser({ role: "co_admin" });

    const res = await postSlide(token, {
      title: "Eid Collection",
      subtitle: "Gift boxes, ready to send",
      ctaLabel: "Shop Now",
      ctaHref: "/shop",
      secondaryCtaLabel: "Explore Dates",
      secondaryCtaHref: "/shop?category=dates",
      sortOrder: "3",
      isActive: "true",
    });

    expect(res.status).toBe(201);
    const slide = res.body.data.slide;
    expect(slide.image.url).toBe("https://cdn.test/banner.jpg");
    expect(slide.secondaryCtaLabel).toBe("Explore Dates");
    expect(slide.secondaryCtaHref).toBe("/shop?category=dates");
    expect(uploadBufferToCloudinary).toHaveBeenCalledTimes(1);
  });

  it("rejects slide creation from a customer, an employee and an anonymous visitor", async () => {
    const anon = await request(app).post("/api/v1/hero-slides").field("title", "Nope");
    expect(anon.status).toBe(401);

    for (const role of ["customer", "employee", "order_manager"] as const) {
      const { token } = await createAuthedUser({ role });
      const res = await postSlide(token, { title: "Nope" });
      expect(res.status).toBe(403);
    }
    expect(uploadBufferToCloudinary).not.toHaveBeenCalled();
  });

  it("requires an image when creating a slide", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/hero-slides")
      .set(...authHeader(token))
      .field("title", "No picture");

    expect(res.status).toBe(400);
    expect(await HeroSlideModel.countDocuments()).toBe(0);
  });

  /**
   * The admin table toggles `isActive` (and reorders) by PATCHing that one
   * field alone. `updateHeroSlideSchema` is `createHeroSlideSchema.partial()`,
   * and the create schema carries `.default()`s — so this locks in that a
   * one-field PATCH does not quietly reset everything else to its default.
   */
  it("toggles a slide off without disturbing its other fields", async () => {
    const { token } = await createAuthedUser({ role: "co_admin" });
    const created = await postSlide(token, {
      title: "Ramadan",
      ctaLabel: "Shop Now",
      secondaryCtaLabel: "Explore Dates",
      sortOrder: "7",
      isActive: "true",
    });

    const res = await request(app)
      .patch(`/api/v1/hero-slides/${created.body.data.slide._id}`)
      .set(...authHeader(token))
      .field("isActive", "false");

    expect(res.status).toBe(200);
    const slide = res.body.data.slide;
    expect(slide.isActive).toBe(false);
    expect(slide.sortOrder).toBe(7);
    expect(slide.title).toBe("Ramadan");
    expect(slide.ctaLabel).toBe("Shop Now");
    expect(slide.secondaryCtaLabel).toBe("Explore Dates");
    expect(slide.image.url).toBe("https://cdn.test/banner.jpg");

    // A disabled slide drops out of the carousel the storefront renders.
    const publicRes = await request(app).get("/api/v1/hero-slides");
    expect(publicRes.body.data.slides).toHaveLength(0);
  });

  it("reorders slides by swapping sortOrder, changing the public carousel order", async () => {
    const { token } = await createAuthedUser({ role: "co_admin" });
    const [first, second] = await HeroSlideModel.create([
      { title: "Alpha", sortOrder: 0, isActive: true },
      { title: "Beta", sortOrder: 1, isActive: true },
    ]);

    await Promise.all([
      request(app)
        .patch(`/api/v1/hero-slides/${first._id}`)
        .set(...authHeader(token))
        .field("sortOrder", "1"),
      request(app)
        .patch(`/api/v1/hero-slides/${second._id}`)
        .set(...authHeader(token))
        .field("sortOrder", "0"),
    ]);

    const publicRes = await request(app).get("/api/v1/hero-slides");
    expect(publicRes.body.data.slides.map((s: { title: string }) => s.title)).toEqual([
      "Beta",
      "Alpha",
    ]);
  });

  /**
   * The mirror of the toggle test above, and the other half of the bug that
   * `updateHeroSlideSchema`'s explicit shape fixes: reordering sends only
   * `sortOrder`, which under a `.partial()`-derived schema re-applied
   * `isActive`'s default and switched a disabled slide back on — publishing
   * a banner nobody asked to publish.
   */
  it("keeps a disabled slide disabled when it is reordered", async () => {
    const { token } = await createAuthedUser({ role: "co_admin" });
    const slide = await HeroSlideModel.create({
      title: "Retired campaign",
      sortOrder: 5,
      isActive: false,
    });

    const res = await request(app)
      .patch(`/api/v1/hero-slides/${slide._id}`)
      .set(...authHeader(token))
      .field("sortOrder", "1");

    expect(res.status).toBe(200);
    expect(res.body.data.slide.sortOrder).toBe(1);
    expect(res.body.data.slide.isActive).toBe(false);

    const publicRes = await request(app).get("/api/v1/hero-slides");
    expect(publicRes.body.data.slides).toHaveLength(0);
  });

  it("lets an admin delete a slide and cleans up its uploaded image", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    const created = await postSlide(token, { title: "Temporary" });

    const res = await request(app)
      .delete(`/api/v1/hero-slides/${created.body.data.slide._id}`)
      .set(...authHeader(token));

    expect(res.status).toBe(200);
    expect(await HeroSlideModel.countDocuments()).toBe(0);
    expect(deleteCloudinaryImage).toHaveBeenCalledWith("hero/banner");
  });

  /**
   * Deletion is deliberately Admin/Super Admin only, matching the project-wide
   * convention that a Co-Admin runs day-to-day content but never deletes.
   * They can still disable a slide, which removes it from the storefront.
   */
  it("refuses slide deletion by a co-admin", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const created = await postSlide(adminToken, { title: "Protected" });

    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const res = await request(app)
      .delete(`/api/v1/hero-slides/${created.body.data.slide._id}`)
      .set(...authHeader(coAdminToken));

    expect(res.status).toBe(403);
    expect(await HeroSlideModel.countDocuments()).toBe(1);
  });
});
