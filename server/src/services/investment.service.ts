import { InvestmentModel } from "../models/Investment.model";
import { recordAuditLog } from "./auditLog.service";
import type { CreateInvestmentInput } from "../validators/investment.validator";
import type { Role } from "../constants/roles";

export async function createInvestment(input: CreateInvestmentInput, actor: { id: string; role: Role }) {
  const investment = await InvestmentModel.create({ ...input, recordedBy: actor.id });
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "investment.create",
    resource: "Investment",
    resourceId: investment._id.toString(),
    newValue: input,
  });
  return investment;
}

export async function listInvestments(filter: { page: number; limit: number }) {
  const skip = (filter.page - 1) * filter.limit;
  const [investments, total] = await Promise.all([
    InvestmentModel.find()
      .populate("recordedBy", "name email")
      .sort({ investedAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    InvestmentModel.countDocuments(),
  ]);
  return {
    investments,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

export async function getTotalInvestmentBDT(): Promise<number> {
  const [result] = await InvestmentModel.aggregate([{ $group: { _id: null, total: { $sum: "$amountBDT" } } }]);
  return result?.total ?? 0;
}
