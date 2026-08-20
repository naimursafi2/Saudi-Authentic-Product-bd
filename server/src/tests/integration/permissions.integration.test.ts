import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { RoleModel } from "../../models/Role.model";
import { UserModel } from "../../models/User.model";
import { ensureSystemRoles, invalidateRoleCache } from "../../services/role.service";
import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from "../../constants/permissions";

const app = createApp();

/** Creates a custom role directly, for tests about *using* one rather than
 * about the create endpoint itself. */
async function makeRole(key: string, permissions: string[]) {
  const role = await RoleModel.create({
    key,
    name: key,
    permissions,
    isSystem: false,
    isActive: true,
  });
  invalidateRoleCache();
  return role;
}

describe("Role & permission system", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  beforeEach(async () => {
    await ensureSystemRoles();
  });

  afterEach(async () => {
    await clearTestDb();
    // The role cache is process-level and deliberately survives requests, so
    // wiping collections between tests must wipe it too or the next test
    // authorizes against roles that no longer exist.
    invalidateRoleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ---------------------------------------------------------------- baseline

  it("reports a Super Admin as holding every permission", async () => {
    const { token } = await createAuthedUser({ role: "super_admin" });
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set(...authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.permissions.sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it("gives each built-in role exactly the permissions its old role matrix implied", async () => {
    for (const role of ["admin", "co_admin", "order_manager", "employee"] as const) {
      const { token } = await createAuthedUser({ role });
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set(...authHeader(token));
      expect(res.body.data.permissions.sort()).toEqual([...ROLE_DEFAULT_PERMISSIONS[role]].sort());
    }
  });

  it("keeps the legacy boundaries working — an employee still cannot touch the catalog", async () => {
    const { token } = await createAuthedUser({ role: "employee" });
    const res = await request(app)
      .post("/api/v1/products")
      .set(...authHeader(token))
      .field("name", "Nope");
    expect(res.status).toBe(403);
  });

  // ------------------------------------------------------------ custom roles

  it("lets a Super Admin create a custom role and assign it to an employee", async () => {
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const { user: employee } = await createAuthedUser({ role: "employee", email: "vid@example.com" });

    const created = await request(app)
      .post("/api/v1/roles")
      .set(...authHeader(superToken))
      .send({
        key: "DIGITAL_MARKETER",
        name: "Digital Marketer",
        description: "Runs campaigns and coupons",
        permissions: ["marketing.view", "marketing.manage", "reports.view"],
      });

    expect(created.status).toBe(201);
    expect(created.body.data.role.key).toBe("DIGITAL_MARKETER");

    const assigned = await request(app)
      .patch(`/api/v1/roles/users/${employee._id}`)
      .set(...authHeader(superToken))
      .send({ roleId: created.body.data.role._id });
    expect(assigned.status).toBe(200);

    const view = await request(app)
      .get(`/api/v1/roles/users/${employee._id}`)
      .set(...authHeader(superToken));
    expect(view.body.data.customRole.key).toBe("DIGITAL_MARKETER");
    // The base role's permissions are kept and the custom role's added on top.
    expect(view.body.data.permissions).toEqual(
      expect.arrayContaining(["orders.view", "marketing.view", "marketing.manage"])
    );
  });

  it("grants real API access through a custom role, not just a label", async () => {
    const { token } = await createAuthedUser({ role: "employee" });

    // An employee has no marketing permission, so coupons are closed to them.
    const before = await request(app)
      .get("/api/v1/coupons")
      .set(...authHeader(token));
    expect(before.status).toBe(403);

    const role = await makeRole("MARKETER", ["marketing.view"]);
    await UserModel.updateOne({ _id: (await UserModel.findOne({ role: "employee" }))!._id }, {
      customRole: role._id,
    });

    const after = await request(app)
      .get("/api/v1/coupons")
      .set(...authHeader(token));
    expect(after.status).toBe(200);
  });

  it("stops granting access as soon as the custom role is deactivated", async () => {
    const { user, token } = await createAuthedUser({ role: "employee" });
    const role = await makeRole("MARKETER", ["marketing.view"]);
    await UserModel.updateOne({ _id: user._id }, { customRole: role._id });

    expect(
      (await request(app).get("/api/v1/coupons").set(...authHeader(token))).status
    ).toBe(200);

    role.isActive = false;
    await role.save();
    invalidateRoleCache();

    expect(
      (await request(app).get("/api/v1/coupons").set(...authHeader(token))).status
    ).toBe(403);
  });

  // ------------------------------------------------------- escalation guards

  it("refuses to let an Admin grant a permission they do not hold themselves", async () => {
    const { token } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .post("/api/v1/roles")
      .set(...authHeader(token))
      .send({
        key: "BACKDOOR",
        name: "Backdoor",
        // approvals.manage belongs to Super Admin alone.
        permissions: ["marketing.view", "approvals.manage"],
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/approvals\.manage/);
    expect(await RoleModel.exists({ key: "BACKDOOR" })).toBeNull();
  });

  it("refuses to let an Admin re-permission a built-in role", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    const coAdminRole = await RoleModel.findOne({ key: "CO_ADMIN" });

    const res = await request(app)
      .patch(`/api/v1/roles/${coAdminRole!._id}`)
      .set(...authHeader(token))
      .send({ permissions: ["marketing.view"] });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Super Admin/i);
  });

  it("never lets the Super Admin role be edited, even by a Super Admin", async () => {
    const { token } = await createAuthedUser({ role: "super_admin" });
    const superRole = await RoleModel.findOne({ key: "SUPER_ADMIN" });

    const res = await request(app)
      .patch(`/api/v1/roles/${superRole!._id}`)
      .set(...authHeader(token))
      .send({ permissions: ["marketing.view"] });

    expect(res.status).toBe(403);
  });

  it("refuses to let a custom role reuse a built-in role's name", async () => {
    const { token } = await createAuthedUser({ role: "super_admin" });
    const res = await request(app)
      .post("/api/v1/roles")
      .set(...authHeader(token))
      .send({ key: "ADMIN", name: "Fake Admin", permissions: [] });

    expect(res.status).toBe(409);
  });

  it("blocks role management entirely for roles without roles.manage", async () => {
    for (const role of ["co_admin", "employee", "order_manager"] as const) {
      const { token } = await createAuthedUser({ role, email: `${role}-rm@example.com` });
      const res = await request(app)
        .post("/api/v1/roles")
        .set(...authHeader(token))
        .send({ key: "X_ROLE", name: "X", permissions: [] });
      expect(res.status).toBe(403);
    }
    // Co-Admin can still *see* the roles list — it holds roles.view.
    const { token: coAdmin } = await createAuthedUser({ role: "co_admin", email: "co-view@example.com" });
    expect((await request(app).get("/api/v1/roles").set(...authHeader(coAdmin))).status).toBe(200);
  });

  // ------------------------------------------------------------- role edits

  it("applies a Super Admin's edit to a built-in role on the very next request", async () => {
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const { token: coAdminToken } = await createAuthedUser({
      role: "co_admin",
      email: "co@example.com",
    });

    expect(
      (await request(app).get("/api/v1/coupons").set(...authHeader(coAdminToken))).status
    ).toBe(200);

    const coAdminRole = await RoleModel.findOne({ key: "CO_ADMIN" });
    const stripped = coAdminRole!.permissions.filter((p) => p !== "marketing.view");
    const res = await request(app)
      .patch(`/api/v1/roles/${coAdminRole!._id}`)
      .set(...authHeader(superToken))
      .send({ permissions: stripped });
    expect(res.status).toBe(200);

    // No re-login: the next request already sees the narrowed permission set.
    expect(
      (await request(app).get("/api/v1/coupons").set(...authHeader(coAdminToken))).status
    ).toBe(403);
  });

  it("refuses to delete a built-in role or one that is still assigned", async () => {
    const { token } = await createAuthedUser({ role: "super_admin" });

    const systemRole = await RoleModel.findOne({ key: "EMPLOYEE" });
    const systemRes = await request(app)
      .delete(`/api/v1/roles/${systemRole!._id}`)
      .set(...authHeader(token));
    expect(systemRes.status).toBe(403);

    const custom = await makeRole("CONTENT_MANAGER", ["content.homepage.manage"]);
    const { user } = await createAuthedUser({ role: "employee", email: "cm@example.com" });
    await UserModel.updateOne({ _id: user._id }, { customRole: custom._id });

    const inUse = await request(app)
      .delete(`/api/v1/roles/${custom._id}`)
      .set(...authHeader(token));
    expect(inUse.status).toBe(400);
    expect(inUse.body.message).toMatch(/still have this role/i);

    // Clearing the assignment first makes the delete succeed.
    await request(app)
      .patch(`/api/v1/roles/users/${user._id}`)
      .set(...authHeader(token))
      .send({ roleId: null });
    const freed = await request(app)
      .delete(`/api/v1/roles/${custom._id}`)
      .set(...authHeader(token));
    expect(freed.status).toBe(200);
    expect(await RoleModel.exists({ key: "CONTENT_MANAGER" })).toBeNull();
  });

  it("exposes the permission catalogue to anyone who can view roles", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    const res = await request(app)
      .get("/api/v1/roles/permissions")
      .set(...authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual(expect.arrayContaining(["products.view", "orders.manage"]));
    // Every catalogued permission appears in exactly one display group, so the
    // admin panel can never render a permission with no home.
    const grouped = res.body.data.groups.flatMap((g: { permissions: { key: string }[] }) =>
      g.permissions.map((p) => p.key)
    );
    expect(grouped.sort()).toEqual([...ALL_PERMISSIONS].sort());
  });
});
