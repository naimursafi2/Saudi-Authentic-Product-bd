import { LeaveRequestModel } from "../models/LeaveRequest.model";
import { UserModel } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { sendLeaveStatusEmail } from "./email.service";
import type { CreateLeaveInput, ListLeavesQuery, ReviewLeaveInput } from "../validators/leave.validator";

export async function createLeaveRequest(employeeId: string, input: CreateLeaveInput) {
  return LeaveRequestModel.create({ employee: employeeId, ...input });
}

export async function listMyLeaves(employeeId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const filter = { employee: employeeId };
  const [leaves, total] = await Promise.all([
    LeaveRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    LeaveRequestModel.countDocuments(filter),
  ]);
  return {
    leaves,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function listLeaves(query: ListLeavesQuery) {
  const filter: Record<string, unknown> = {};
  if (query.employee) filter.employee = query.employee;
  if (query.status) filter.status = query.status;

  const skip = (query.page - 1) * query.limit;
  const [leaves, total] = await Promise.all([
    LeaveRequestModel.find(filter)
      .populate("employee", "name email staffMeta.employeeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    LeaveRequestModel.countDocuments(filter),
  ]);
  return {
    leaves,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function cancelLeaveRequest(id: string, employeeId: string) {
  const leave = await LeaveRequestModel.findById(id);
  if (!leave) throw ApiError.notFound("Leave request not found");
  if (leave.employee.toString() !== employeeId) {
    throw ApiError.forbidden("You can only cancel your own leave requests");
  }
  if (leave.status !== "pending") {
    throw ApiError.badRequest("Only pending leave requests can be cancelled");
  }
  leave.status = "cancelled";
  await leave.save();
  return leave;
}

export async function reviewLeaveRequest(id: string, reviewerId: string, input: ReviewLeaveInput) {
  const leave = await LeaveRequestModel.findById(id);
  if (!leave) throw ApiError.notFound("Leave request not found");
  if (leave.status !== "pending") {
    throw ApiError.badRequest(`This leave request has already been ${leave.status}`);
  }

  leave.status = input.status;
  leave.reviewedBy = reviewerId as unknown as typeof leave.reviewedBy;
  leave.reviewNote = input.reviewNote;
  leave.reviewedAt = new Date();
  await leave.save();

  const employee = await UserModel.findById(leave.employee);
  if (employee) {
    void sendLeaveStatusEmail(employee.email, employee.name, {
      status: input.status,
      startDate: leave.startDate.toISOString().slice(0, 10),
      endDate: leave.endDate.toISOString().slice(0, 10),
      reviewNote: input.reviewNote,
    });
  }

  return leave;
}

/** Count of leave requests awaiting review, used by admin/co-admin dashboards. */
export async function countPendingLeaves() {
  return LeaveRequestModel.countDocuments({ status: "pending" });
}
