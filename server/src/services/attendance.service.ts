import { AttendanceModel } from "../models/Attendance.model";
import { ApiError } from "../utils/ApiError";
import type { ListAttendanceQuery, UpdateAttendanceInput } from "../validators/attendance.validator";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const LATE_AFTER_HOUR = 10; // check-ins after 10:00 are marked "late"

export async function checkIn(employeeId: string) {
  const today = startOfDay(new Date());
  const existing = await AttendanceModel.findOne({ employee: employeeId, date: today });
  if (existing?.checkIn) {
    throw ApiError.conflict("You have already checked in today");
  }

  const now = new Date();
  const status = now.getHours() >= LATE_AFTER_HOUR ? "late" : "present";

  if (existing) {
    existing.checkIn = now;
    existing.status = status;
    await existing.save();
    return existing;
  }

  return AttendanceModel.create({ employee: employeeId, date: today, checkIn: now, status });
}

export async function checkOut(employeeId: string, note?: string) {
  const today = startOfDay(new Date());
  const record = await AttendanceModel.findOne({ employee: employeeId, date: today });
  if (!record || !record.checkIn) {
    throw ApiError.badRequest("You must check in before checking out");
  }
  if (record.checkOut) {
    throw ApiError.conflict("You have already checked out today");
  }

  record.checkOut = new Date();
  if (note) record.note = note;
  await record.save();
  return record;
}

export async function listMyAttendance(employeeId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const filter = { employee: employeeId };
  const [records, total] = await Promise.all([
    AttendanceModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    AttendanceModel.countDocuments(filter),
  ]);
  return {
    records,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function listAttendance(query: ListAttendanceQuery) {
  const filter: Record<string, unknown> = {};
  if (query.employee) filter.employee = query.employee;
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = startOfDay(query.from);
    if (query.to) range.$lte = startOfDay(query.to);
    filter.date = range;
  }

  const skip = (query.page - 1) * query.limit;
  const [records, total] = await Promise.all([
    AttendanceModel.find(filter)
      .populate("employee", "name email staffMeta.employeeId")
      .sort({ date: -1 })
      .skip(skip)
      .limit(query.limit),
    AttendanceModel.countDocuments(filter),
  ]);
  return {
    records,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function updateAttendance(id: string, input: UpdateAttendanceInput) {
  const record = await AttendanceModel.findById(id);
  if (!record) throw ApiError.notFound("Attendance record not found");
  Object.assign(record, input);
  await record.save();
  return record;
}

/** Today's org-wide attendance summary, used by admin/co-admin dashboards. */
export async function getTodaySummary() {
  const today = startOfDay(new Date());
  const records = await AttendanceModel.find({ date: today });
  const summary = { present: 0, late: 0, half_day: 0, absent: 0, leave: 0 };
  for (const r of records) summary[r.status] += 1;
  return { date: today, totalCheckedIn: records.length, ...summary };
}
