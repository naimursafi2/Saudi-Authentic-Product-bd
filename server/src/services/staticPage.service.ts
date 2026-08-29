import { StaticPageModel, STATIC_PAGE_DEFAULTS, type StaticPageType } from "../models/StaticPage.model";
import { ApiError } from "../utils/ApiError";
import { retireInternalAsset, uploadInternalFile, type AssetActor } from "./internalAsset.service";
import type { UpdateStaticPageInput } from "../validators/staticPage.validator";

const FOLDER = "saudi-authentic-product/pages";

/** Idempotent — safe to call on every read. Only inserts docs that don't exist yet. */
async function ensureDefaultPages() {
  await Promise.all(
    STATIC_PAGE_DEFAULTS.map((def) =>
      StaticPageModel.findOneAndUpdate({ type: def.type }, { $setOnInsert: def }, { upsert: true })
    )
  );
}

export async function listPages() {
  await ensureDefaultPages();
  return StaticPageModel.find().sort({ type: 1 });
}

export async function getPage(type: StaticPageType) {
  await ensureDefaultPages();
  const page = await StaticPageModel.findOne({ type });
  if (!page) throw ApiError.notFound("Page not found");
  return page;
}

/**
 * The page-level half of this resource's authorization, kept in the service
 * rather than the route because the route's `requirePermission(...)` can only
 * ask "does the caller hold either key", not "which page does that key reach".
 *
 * `content.pages.manage` (Admin/Super Admin) edits every page.
 * `content.refundPolicy.manage` (Co-Admin) edits the Return & Refund Policy
 * and nothing else — so a Co-Admin cannot use it as a way into About,
 * Contact or Shipping.
 */
function assertMayEditPage(type: StaticPageType, permissions: string[]) {
  if (permissions.includes("content.pages.manage")) return;
  if (type === "refundPolicy" && permissions.includes("content.refundPolicy.manage")) return;
  throw ApiError.forbidden("You do not have permission to edit this page");
}

export async function updatePage(
  type: StaticPageType,
  input: UpdateStaticPageInput,
  actor: AssetActor,
  imageFile?: Express.Multer.File,
  permissions: string[] = []
) {
  assertMayEditPage(type, permissions);

  const page = await getPage(type);
  Object.assign(page, input);

  if (imageFile) {
    await retireInternalAsset(page.heroImage?.publicId, actor, "Static page hero image replaced");
    const uploaded = await uploadInternalFile(imageFile, { folder: FOLDER, resource: "StaticPage", resourceId: type, fieldPath: "heroImage", module: "Pages", actor });
    page.heroImage = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await page.save();
  return page;
}
