import { v2 as cloudinary } from 'cloudinary';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
};

function isConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function ensureConfigured() {
  if (!isConfigured()) {
    throw new Error(
      'Cloudinary no está configurado. Agregá CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en .env.',
    );
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function assertValidImageFile(file: File) {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Formato no permitido. Usá JPG, PNG, WebP o GIF.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen no puede superar 5 MB.');
  }
}

/** Sube una imagen al folder `lc/publicaciones`. */
export async function uploadPublicacionImage(file: File): Promise<CloudinaryUploadResult> {
  ensureConfigured();
  assertValidImageFile(file);

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'lc/publicaciones',
        resource_type: 'image',
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
      },
      (error, uploaded) => {
        if (error || !uploaded?.secure_url || !uploaded.public_id) {
          reject(error ?? new Error('No se pudo subir la imagen a Cloudinary.'));
          return;
        }
        resolve({ secure_url: uploaded.secure_url, public_id: uploaded.public_id });
      },
    );
    stream.end(buffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

/** Borra un asset de Cloudinary. Ignora si no hay publicId o no está configurado. */
export async function destroyCloudinaryImage(publicId: string | null | undefined): Promise<void> {
  if (!publicId || !isConfigured()) return;
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    console.error('[cloudinary] destroy failed', publicId, error);
  }
}
