import { Schema, model, type Document, type Model, type Types } from "mongoose";

export type AttendanceStatus = "present" | "late" | "half_day" | "absent" | "leave";

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  status: AttendanceStatus;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true, index: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: {
      type: String,
      enum: ["present", "late", "half_day", "absent", "leave"],
      default: "present",
      index: true,
    },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

// One attendance record per employee per day.
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

export const AttendanceModel: Model<IAttendance> = model<IAttendance>("Attendance", attendanceSchema);
