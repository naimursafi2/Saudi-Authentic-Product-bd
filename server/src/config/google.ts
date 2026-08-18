import { OAuth2Client } from "google-auth-library";
import { env, isGoogleConfigured } from "./env";
import { ApiError } from "../utils/ApiError";

const client = isGoogleConfigured ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

export interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
}

/**
 * Verifies a Google Identity Services credential (ID token) sent from the
 * frontend "Continue with Google" button. Throws a clear 503 if
 * GOOGLE_CLIENT_ID hasn't been configured on the server, matching the
 * Cloudinary/SMTP graceful-degradation pattern.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  if (!client) {
    throw new ApiError(
      503,
      "Google sign-in is not available yet — GOOGLE_CLIENT_ID has not been configured on the server."
    );
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized("Invalid Google sign-in token");
  }

  if (!payload?.email) {
    throw ApiError.unauthorized("Invalid Google sign-in token");
  }
  if (!payload.email_verified) {
    throw ApiError.unauthorized("Your Google email address is not verified");
  }

  return { email: payload.email.toLowerCase(), name: payload.name ?? payload.email, picture: payload.picture };
}
