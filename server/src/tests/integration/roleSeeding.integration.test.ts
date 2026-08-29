import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { RoleModel } from "../../models/Role.model";
import { ensureSystemRoles, invalidateRoleCache, resolvePermissions } from "../../services/role.service";
import { ROLE_DEFAULT_PERMISSIONS } from "../../constants/permissions";
import { ROLES } from "../../constants/roles";

describe("System role seeding and permission reconciliation", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
    invalidateRoleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("seeds every built-in role with its defaults on a fresh database", async () => {
    await ensureSystemRoles();

    const roles = await RoleModel.find({ isSystem: true });
    expect(roles).toHaveLength(ROLES.length);

    const admin = roles.find((r) => r.key === "ADMIN");
    expect(admin?.permissions).toEqual(expect.arrayContaining(ROLE_DEFAULT_PERMISSIONS.admin));
    // A freshly seeded role has its whole default set recorded as seeded, so
    // nothing is re-granted on the next restart.
    expect(admin?.seededPermissions).toEqual(expect.arrayContaining(ROLE_DEFAULT_PERMISSIONS.admin));
  });

  it("grants a permission added to the code after the role was already seeded", async () => {
    // A role document from before `payments.view` existed — exactly the state
    // that left Admin unable to open the Payments page.
    const stale = ROLE_DEFAULT_PERMISSIONS.admin.filter((p) => !p.startsWith("payments."));
    await RoleModel.create({
      key: "ADMIN",
      name: "Admin",
      permissions: stale,
      seededPermissions: stale,
      isSystem: true,
      isActive: true,
    });

    await ensureSystemRoles();

    const admin = await RoleModel.findOne({ key: "ADMIN" });
    expect(admin?.permissions).toContain("payments.view");
    expect(await resolvePermissions("admin")).toContain("payments.view");
  });

  it("never re-grants a permission an administrator deliberately removed", async () => {
    await ensureSystemRoles();
    const admin = await RoleModel.findOne({ key: "ADMIN" });

    // Super Admin removes it by hand; `seededPermissions` still records that it
    // was offered once.
    admin!.permissions = admin!.permissions.filter((p) => p !== "payments.view");
    await admin!.save();
    invalidateRoleCache();

    await ensureSystemRoles();

    const after = await RoleModel.findOne({ key: "ADMIN" });
    expect(after?.permissions).not.toContain("payments.view");
    expect(await resolvePermissions("admin")).not.toContain("payments.view");
  });

  it("leaves extra permissions an administrator added in place", async () => {
    await ensureSystemRoles();
    const manager = await RoleModel.findOne({ key: "ORDER_MANAGER" });

    manager!.permissions = [...manager!.permissions, "products.view"];
    await manager!.save();
    invalidateRoleCache();

    await ensureSystemRoles();

    const after = await RoleModel.findOne({ key: "ORDER_MANAGER" });
    expect(after?.permissions).toContain("products.view");
  });

  it("is idempotent — a second run changes nothing", async () => {
    await ensureSystemRoles();
    const before = await RoleModel.find({ isSystem: true }).sort({ key: 1 }).lean();

    await ensureSystemRoles();
    const after = await RoleModel.find({ isSystem: true }).sort({ key: 1 }).lean();

    expect(after.map((r) => r.permissions)).toEqual(before.map((r) => r.permissions));
    expect(after).toHaveLength(ROLES.length);
  });

  it("keeps super_admin holding every permission", async () => {
    await ensureSystemRoles();
    const permissions = await resolvePermissions("super_admin");
    expect(permissions).toContain("payments.view");
    expect(permissions).toContain("settings.manage");
  });
});
