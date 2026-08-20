import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";

const app = createApp();

/**
 * Covers the announcement strip's on/off switch (`announcementEnabled`).
 * The strip is opt-in: it must stay hidden until someone with the right role
 * deliberately turns it on, and — critically — it must be possible to turn
 * back OFF again, which is the case a naive boolean coercion breaks on this
 * multipart endpoint (every field arrives as a string, so "false" would
 * otherwise read as truthy).
 */
describe("Site settings integration (announcement strip toggle)", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("defaults announcementEnabled to false on the lazily-seeded singleton", async () => {
    const res = await request(app).get("/api/v1/site-settings");

    expect(res.status).toBe(200);
    expect(res.body.data.settings.announcementEnabled).toBe(false);
  });

  it("lets an admin switch the strip on and edit its text together", async () => {
    const { token } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .patch("/api/v1/site-settings")
      .set(...authHeader(token))
      .field("announcementEnabled", "true")
      .field("announcementText", "Eid Mubarak - free delivery this week");

    expect(res.status).toBe(200);
    expect(res.body.data.settings.announcementEnabled).toBe(true);
    expect(res.body.data.settings.announcementText).toBe("Eid Mubarak - free delivery this week");

    // The public read the storefront layout uses must reflect it too.
    const publicRead = await request(app).get("/api/v1/site-settings");
    expect(publicRead.body.data.settings.announcementEnabled).toBe(true);
  });

  it('switches the strip back off when sent the string "false" from the multipart form', async () => {
    const { token } = await createAuthedUser({ role: "super_admin" });

    await request(app)
      .patch("/api/v1/site-settings")
      .set(...authHeader(token))
      .field("announcementEnabled", "true");

    const off = await request(app)
      .patch("/api/v1/site-settings")
      .set(...authHeader(token))
      .field("announcementEnabled", "false");

    expect(off.status).toBe(200);
    expect(off.body.data.settings.announcementEnabled).toBe(false);
  });

  it("keeps the text when the strip is switched off, so it can be reused next time", async () => {
    const { token } = await createAuthedUser({ role: "admin" });

    await request(app)
      .patch("/api/v1/site-settings")
      .set(...authHeader(token))
      .field("announcementEnabled", "true")
      .field("announcementText", "Ramadan sale");

    const off = await request(app)
      .patch("/api/v1/site-settings")
      .set(...authHeader(token))
      .field("announcementEnabled", "false");

    expect(off.body.data.settings.announcementText).toBe("Ramadan sale");
  });

  it("rejects the toggle from a co_admin, a customer and an anonymous request", async () => {
    const anon = await request(app)
      .patch("/api/v1/site-settings")
      .field("announcementEnabled", "true");
    expect(anon.status).toBe(401);

    for (const role of ["co_admin", "order_manager", "employee", "customer"] as const) {
      const { token } = await createAuthedUser({ role });
      const res = await request(app)
        .patch("/api/v1/site-settings")
        .set(...authHeader(token))
        .field("announcementEnabled", "true");
      expect(res.status).toBe(403);
    }

    // Nothing above should have flipped the switch.
    const publicRead = await request(app).get("/api/v1/site-settings");
    expect(publicRead.body.data.settings.announcementEnabled).toBe(false);
  });
});
