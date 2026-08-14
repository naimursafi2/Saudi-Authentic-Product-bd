import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as attendanceService from "../services/attendance.service";
import type { ListAttendanceQuery } from "../validators/attendance.validator";

export const checkIn = catchAsync(async (req: Request, res: Response) => {
  const record = await attendanceService.checkIn(req.user!.id);
  sendSuccess(res, 201, "Checked in", { record });
});

export const checkOut = catchAsync(async (req: Request, res: Response) => {
  const record = await attendanceService.checkOut(req.user!.id, req.body.note);
  sendSuccess(res, 200, "Checked out", { record });
});

export const listMine = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { records, pagination } = await attendanceService.listMyAttendance(req.user!.id, page, limit);
  sendSuccess(res, 200, "Attendance fetched", { records }, { pagination });
});

export const list = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListAttendanceQuery;
  const { records, pagination } = await attendanceService.listAttendance(query);
  sendSuccess(res, 200, "Attendance fetched", { records }, { pagination });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const record = await attendanceService.updateAttendance(paramStr(req.params.id), req.body);
  sendSuccess(res, 200, "Attendance updated", { record });
});

export const todaySummary = catchAsync(async (_req: Request, res: Response) => {
  const summary = await attendanceService.getTodaySummary();
  sendSuccess(res, 200, "Today's attendance summary", { summary });
});
