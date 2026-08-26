import { SalaryPaymentModel } from "../models/SalaryPayment.model";
import { UserModel } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { sendSalaryPaymentEmail } from "./email.service";
import type {
  CreateSalaryPaymentInput,
  ListSalaryPaymentsQuery,
  UpdateSalaryStatusInput,
} from "../validators/salary.validator";

export async function createSalaryPayment(createdById: string, input: CreateSalaryPaymentInput) {
  const employee = await UserModel.findById(input.employee);
  if (!employee || !employee.staffMeta) {
    throw ApiError.badRequest("employee must be an existing staff member");
  }

  const existing = await SalaryPaymentModel.findOne({
    employee: input.employee,
    month: input.month,
    year: input.year,
  });
  if (existing) {
    throw ApiError.conflict("A salary payment record already exists for this employee and month");
  }

  return SalaryPaymentModel.create({ ...input, createdBy: createdById });
}

export async function listMySalaryPayments(employeeId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const filter = { employee: employeeId };
  const [payments, total] = await Promise.all([
    SalaryPaymentModel.find(filter).sort({ year: -1, month: -1 }).skip(skip).limit(limit),
    SalaryPaymentModel.countDocuments(filter),
  ]);
  return {
    payments,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function listSalaryPayments(query: ListSalaryPaymentsQuery) {
  const filter: Record<string, unknown> = {};
  if (query.employee) filter.employee = query.employee;
  if (query.status) filter.status = query.status;
  if (query.year) filter.year = query.year;

  const skip = (query.page - 1) * query.limit;
  const [payments, total] = await Promise.all([
    SalaryPaymentModel.find(filter)
      .populate("employee", "name email staffMeta.employeeId")
      .sort({ year: -1, month: -1 })
      .skip(skip)
      .limit(query.limit),
    SalaryPaymentModel.countDocuments(filter),
  ]);
  return {
    payments,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function updateSalaryStatus(id: string, input: UpdateSalaryStatusInput) {
  const payment = await SalaryPaymentModel.findById(id);
  if (!payment) throw ApiError.notFound("Salary payment record not found");

  payment.status = input.status;
  payment.paidAt = input.status === "paid" ? new Date() : undefined;
  if (input.note) payment.note = input.note;
  await payment.save();

  const employee = await UserModel.findById(payment.employee);
  if (employee) {
    void sendSalaryPaymentEmail(employee.email, employee.name, {
      month: payment.month,
      year: payment.year,
      amountBDT: payment.amountBDT,
      dailyAllowanceBDT: payment.dailyAllowanceBDT,
      status: payment.status,
      note: payment.note,
    });
  }

  return payment;
}

/** Re-sends the payment notification without changing status — for reminders. */
export async function notifySalaryPayment(id: string) {
  const payment = await SalaryPaymentModel.findById(id);
  if (!payment) throw ApiError.notFound("Salary payment record not found");

  const employee = await UserModel.findById(payment.employee);
  if (!employee) throw ApiError.notFound("Employee not found");

  void sendSalaryPaymentEmail(employee.email, employee.name, {
    month: payment.month,
    year: payment.year,
    amountBDT: payment.amountBDT,
    dailyAllowanceBDT: payment.dailyAllowanceBDT,
    status: payment.status,
    note: payment.note,
  });

  return payment;
}
