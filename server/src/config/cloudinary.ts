import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { env, isCloudinaryConfigured } from "./env";
import { ApiError } from "../utils/ApiError";

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export interface UploadedImage {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
}

/**
 * Upload a single in-memory file buffer (from multer's memoryStorage) to
 * Cloudinary. Throws a clear 503 ApiError if Cloudinary credentials have not
 * been configured yet, rather than failing with a confusing SDK error.
 */
export function uploadBufferToCloudinary(
  buffer: Buffer,
  options: { folder: string; publicId?: string }
): Promise<UploadedImage> {
  if (!isCloudinaryConfigured) {
    return Promise.reject(
      new ApiError(
        503,
        "Image uploads are not available yet — Cloudinary credentials have not been configured on the server. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the backend .env file."
      )
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: "image",
        overwrite: true,
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error || !result) {
          reject(new ApiError(502, `Image upload failed: ${error?.message ?? "unknown error"}`));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

export async function deleteCloudinaryImage(publicId: string): Promise<void> {
  if (!isCloudinaryConfigured) {
    throw new ApiError(503, "Cloudinary deletion is unavailable because storage is not configured");
  }
  const result = await cloudinary.uploader.destroy(publicId);
  // "not found" is already the desired end state. Any other result means we
  // cannot truthfully claim the object was deleted, so let the asset service
  // retain the recycled row for retry instead of deleting its database record.
  if (result.result !== "ok" && result.result !== "not found") {
    throw new ApiError(502, `Cloudinary deletion failed: ${result.result}`);
  }
}

export { cloudinary };
