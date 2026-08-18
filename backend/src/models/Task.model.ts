import { Schema, model, type Document, type Model, type Types } from "mongoose";

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";

/** Task-based access categories for the Employee Portal — see roadmap Phase 4. */
export const TASK_TYPES = [
  "packing",
  "product_counting",
  "stock_checking",
  "warehouse",
  "customer_support",
  "data_entry",
  "product_preparation",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export interface ITask extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  type: TaskType;
  assignedTo: Types.ObjectId;
  assignedBy: Types.ObjectId;
  dueDate?: Date;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    type: { type: String, enum: TASK_TYPES, required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueDate: { type: Date },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo", index: true },
  },
  { timestamps: true }
);

export const TaskModel: Model<ITask> = model<ITask>("Task", taskSchema);
