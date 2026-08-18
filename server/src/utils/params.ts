/**
 * Express types `req.params[key]` as `string | string[]` (to account for
 * repeated-name wildcard route segments), even though none of our routes
 * ever produce an array param — every param here has already been
 * validated as a single string by the `validate()` zod middleware.
 * This narrows it back to `string` at the call site instead of sprinkling
 * `as string` casts everywhere.
 */
export function paramStr(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
