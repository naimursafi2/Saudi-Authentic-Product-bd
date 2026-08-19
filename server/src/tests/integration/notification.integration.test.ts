import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser } from "./helpers";

const sendNewOrderStaffAlertEmail = jest.fn().mockResolvedValue(undefined);
const sendLowStockAlertEmail = jest.fn().mockResolvedValue(undefined);
const sendDeliveryFailedAlertEmail = jest.fn().mockResolvedValue(undefined);

jest.mock("../../services/email.service", () => ({
  sendNewOrderStaffAlertEmail: (...args: unknown[]) => sendNewOrderStaffAlertEmail(...args),
  sendLowStockAlertEmail: (...args: unknown[]) => sendLowStockAlertEmail(...args),
  sendDeliveryFailedAlertEmail: (...args: unknown[]) => sendDeliveryFailedAlertEmail(...args),
}));

// Imported after the mock so the service picks up the stubbed senders.
import { notifyNewOrder, notifyLowStock, notifyDeliveryFailed } from "../../services/notification.service";

/** The email addresses a fan-out actually targeted, order-independent. */
function targetedEmails(mock: jest.Mock): string[] {
  return mock.mock.calls.map((call) => call[0] as string).sort();
}

describe("Operational notifications", () => {
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

  it("emails order-owning staff about a new order, and nobody else", async () => {
    await createAuthedUser({ role: "order_manager", email: "manager@example.com" });
    await createAuthedUser({ role: "admin", email: "admin@example.com" });
    await createAuthedUser({ role: "customer", email: "shopper@example.com" });
    await createAuthedUser({ role: "employee", email: "packer@example.com" });

    await notifyNewOrder({
      orderNumber: "SAP-20260819-0001",
      totalBDT: 2500,
      customerName: "Jane Doe",
      itemCount: 2,
    });

    expect(targetedEmails(sendNewOrderStaffAlertEmail)).toEqual(["admin@example.com", "manager@example.com"]);
  });

  it("skips deactivated staff when fanning out an alert", async () => {
    const { user } = await createAuthedUser({ role: "admin", email: "inactive-admin@example.com" });
    await user.updateOne({ isActive: false });
    await createAuthedUser({ role: "super_admin", email: "boss@example.com" });

    await notifyLowStock({ productName: "Ajwa Dates", variantLabel: "500g", stock: 2, threshold: 5 });

    expect(targetedEmails(sendLowStockAlertEmail)).toEqual(["boss@example.com"]);
  });

  it("emails order-owning staff, not the delivery agent, when a delivery fails", async () => {
    await createAuthedUser({ role: "co_admin", email: "coadmin@example.com" });
    await createAuthedUser({ role: "delivery_agent", email: "agent@example.com" });

    await notifyDeliveryFailed({
      orderNumber: "SAP-20260819-0002",
      agentName: "Rider One",
      failureReason: "Customer unreachable",
    });

    expect(targetedEmails(sendDeliveryFailedAlertEmail)).toEqual(["coadmin@example.com"]);
  });

  it("never throws when the mail layer fails, so the operation it describes still succeeds", async () => {
    await createAuthedUser({ role: "admin", email: "admin2@example.com" });
    sendNewOrderStaffAlertEmail.mockRejectedValueOnce(new Error("SMTP down"));

    await expect(
      notifyNewOrder({ orderNumber: "SAP-20260819-0003", totalBDT: 100, customerName: "X", itemCount: 1 })
    ).resolves.toBeUndefined();
  });
});
