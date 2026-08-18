import { FooterColumnModel, FOOTER_COLUMN_DEFAULTS } from "../models/FooterColumn.model";
import { ApiError } from "../utils/ApiError";
import type {
  CreateFooterColumnInput,
  UpdateFooterColumnInput,
} from "../validators/footerColumn.validator";

/** Idempotent — only seeds the default columns the very first time the collection is empty. */
async function ensureDefaultColumns() {
  const count = await FooterColumnModel.estimatedDocumentCount();
  if (count === 0) await FooterColumnModel.insertMany(FOOTER_COLUMN_DEFAULTS);
}

export async function listFooterColumns(includeHidden: boolean) {
  await ensureDefaultColumns();
  const query = includeHidden ? {} : { isVisible: true };
  return FooterColumnModel.find(query).sort({ sortOrder: 1 });
}

export async function createFooterColumn(input: CreateFooterColumnInput) {
  const column = new FooterColumnModel(input);
  await column.save();
  return column;
}

export async function updateFooterColumn(id: string, input: UpdateFooterColumnInput) {
  const column = await FooterColumnModel.findById(id);
  if (!column) throw ApiError.notFound("Footer column not found");
  Object.assign(column, input);
  await column.save();
  return column;
}

export async function deleteFooterColumn(id: string) {
  const column = await FooterColumnModel.findById(id);
  if (!column) throw ApiError.notFound("Footer column not found");
  await column.deleteOne();
}
