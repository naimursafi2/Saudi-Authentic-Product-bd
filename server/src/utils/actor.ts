import type { Request } from "express";
import type { Role } from "../constants/roles";

export interface RequestActor {
  id: string;
  role: Role;
}

/**
 * The authenticated caller, in the `{id, role}` shape services take.
 *
 * Every service that accepts a file upload needs this so the internal-asset
 * registry can record who uploaded what — having one helper keeps that from
 * being spelled out again in a dozen controllers. Only ever called after
 * `authenticate`, which is what guarantees `req.user`.
 */
export function actorOf(req: Request): RequestActor {
  return { id: req.user!.id, role: req.user!.role };
}
