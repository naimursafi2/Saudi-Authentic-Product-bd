import { NavLinkModel, NAV_LINK_DEFAULTS } from "../models/NavLink.model";
import { ApiError } from "../utils/ApiError";
import { revalidateFrontendTag } from "../utils/revalidateFrontend";
import type { CreateNavLinkInput, UpdateNavLinkInput } from "../validators/navLink.validator";

/** Idempotent — only seeds the default links the very first time the collection is empty. */
async function ensureDefaultLinks() {
  const count = await NavLinkModel.estimatedDocumentCount();
  if (count === 0) await NavLinkModel.insertMany(NAV_LINK_DEFAULTS);
}

export async function listNavLinks(includeHidden: boolean) {
  await ensureDefaultLinks();
  const query = includeHidden ? {} : { isVisible: true };
  return NavLinkModel.find(query).sort({ sortOrder: 1 });
}

export async function createNavLink(input: CreateNavLinkInput) {
  const link = new NavLinkModel(input);
  await link.save();
  revalidateFrontendTag("nav-links");
  return link;
}

export async function updateNavLink(id: string, input: UpdateNavLinkInput) {
  const link = await NavLinkModel.findById(id);
  if (!link) throw ApiError.notFound("Nav link not found");
  Object.assign(link, input);
  await link.save();
  revalidateFrontendTag("nav-links");
  return link;
}

export async function deleteNavLink(id: string) {
  const link = await NavLinkModel.findById(id);
  if (!link) throw ApiError.notFound("Nav link not found");
  await link.deleteOne();
  revalidateFrontendTag("nav-links");
}
