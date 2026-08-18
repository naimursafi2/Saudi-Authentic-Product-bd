import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { UserModel } from "../../models/User.model";

const app = createApp();

async function seedEmployee() {
  return UserModel.create({
    name: "Warehouse Employee",
    email: "warehouse-employee@example.com",
    password: "Password123",
    role: "employee",
    isEmailVerified: true,
    staffMeta: { employeeId: "EMP-001" },
  });
}

describe("Task integration (type categorization)", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("rejects task creation without a type", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    const employee = await seedEmployee();

    const res = await request(app)
      .post("/api/v1/tasks")
      .set(...authHeader(token))
      .send({ title: "Count incoming stock", assignedTo: employee._id.toString() });

    expect(res.status).toBe(400);
  });

  it("creates a typed task and filters the list by type", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    const employee = await seedEmployee();

    const createRes = await request(app)
      .post("/api/v1/tasks")
      .set(...authHeader(token))
      .send({
        title: "Count incoming stock",
        type: "stock_checking",
        assignedTo: employee._id.toString(),
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.task.type).toBe("stock_checking");

    await request(app)
      .post("/api/v1/tasks")
      .set(...authHeader(token))
      .send({
        title: "Pack gift boxes",
        type: "packing",
        assignedTo: employee._id.toString(),
      });

    const filtered = await request(app)
      .get("/api/v1/tasks")
      .query({ type: "packing" })
      .set(...authHeader(token));
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.tasks).toHaveLength(1);
    expect(filtered.body.data.tasks[0].type).toBe("packing");
  });
});
