import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import { logger } from './logger';

interface StorageConfig {
  type: 'local' | 's3' | 'r2';
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  cdnUrl?: string;
}

const config: StorageConfig = {
  type: (process.env.STORAGE_TYPE as 'local' | 's3' | 'r2') || 'local',
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.AWS_BUCKET || process.env.R2_BUCKET || 'ordendirecta-assets',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY,
  endpoint: process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined,
  cdnUrl: process.env.CDN_URL
};

// Initialize S3/R2 client
const s3Client = config.type !== 'local' ? new S3Client({
  region: config.region,
  endpoint: config.endpoint,
  credentials: config.accessKeyId && config.secretAccessKey ? {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  } : undefined
}) : null;

// Local storage base path
const LOCAL_STORAGE_PATH = path.join(process.cwd(), 'uploads');

// Image variants configuration
export const IMAGE_VARIANTS = {
  thumbnail: { width: 150, height: 150, fit: 'cover' as const },
  small: { width: 300, height: 300, fit: 'inside' as const },
  medium: { width: 600, height: 600, fit: 'inside' as const },
  large: { width: 1200, height: 1200, fit: 'inside' as const }
};

/**
 * Upload file to storage
 */
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType?: string,
  metadata?: Record<string, string>
): Promise<string> {
  try {
    if (config.type === 'local') {
      // Local file storage
      const filePath = path.join(LOCAL_STORAGE_PATH, key);
      const dir = path.dirname(filePath);
      
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, buffer);
      
      return `/uploads/${key}`;
    }

    // S3/R2 storage
    if (!s3Client) {
      throw new Error('S3 client not configured');
    }

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata
    });

    await s3Client.send(command);

    // Return CDN URL if configured, otherwise construct S3 URL
    if (config.cdnUrl) {
      return `${config.cdnUrl}/${key}`;
    }

    return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
  } catch (error) {
    logger.error({ error, key }, 'Failed to upload file');
    throw error;
  }
}

/**
 * Delete file from storage
 */
export async function deleteFromS3(key: string): Promise<void> {
  try {
    if (config.type === 'local') {
      // Local file deletion
      const filePath = path.join(LOCAL_STORAGE_PATH, key);
      await fs.unlink(filePath);
      return;
    }

    // S3/R2 deletion
    if (!s3Client) {
      throw new Error('S3 client not configured');
    }

    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key
    });

    await s3Client.send(command);
  } catch (error) {
    logger.error({ error, key }, 'Failed to delete file');
    throw error;
  }
}

/**
 * Get signed URL for private file access
 */
export async function getSignedFileUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    if (config.type === 'local') {
      // For local storage, return direct URL
      return `/uploads/${key}`;
    }

    // S3/R2 signed URL
    if (!s3Client) {
      throw new Error('S3 client not configured');
    }

    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    logger.error({ error, key }, 'Failed to generate signed URL');
    throw error;
  }
}

/**
 * Generate image variants
 */
export async function generateImageVariants(
  buffer: Buffer,
  basePath: string,
  variants: string[] = ['thumbnail', 'small', 'medium', 'large']
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  try {
    // Upload original image
    const originalKey = `${basePath}/original-${nanoid()}.jpg`;
    const originalUrl = await uploadToS3(buffer, originalKey, 'image/jpeg');
    results.original = originalUrl;

    // Generate and upload variants
    for (const variant of variants) {
      const config = IMAGE_VARIANTS[variant as keyof typeof IMAGE_VARIANTS];
      if (!config) continue;

      const processedBuffer = await sharp(buffer)
        .resize(config.width, config.height, { fit: config.fit })
        .jpeg({ quality: 85 })
        .toBuffer();

      const variantKey = `${basePath}/${variant}-${nanoid()}.jpg`;
      const variantUrl = await uploadToS3(processedBuffer, variantKey, 'image/jpeg');
      results[variant] = variantUrl;
    }

    return results;
  } catch (error) {
    logger.error({ error, basePath }, 'Failed to generate image variants');
    
    // Clean up any uploaded images on error
    for (const url of Object.values(results)) {
      try {
        const key = url.split('/').slice(-2).join('/');
        await deleteFromS3(key);
      } catch (cleanupError) {
        logger.error({ error: cleanupError }, 'Failed to cleanup image');
      }
    }

    throw error;
  }
}

/**
 * Process and upload product images
 */
export async function processProductImages(
  images: Array<{ buffer: Buffer; filename: string }>,
  productId: string
): Promise<string[]> {
  const uploadedImages: string[] = [];

  try {
    for (const image of images) {
      const basePath = `products/${productId}`;
      const variants = await generateImageVariants(image.buffer, basePath);
      uploadedImages.push(JSON.stringify(variants));
    }

    return uploadedImages;
  } catch (error) { logger.error({ error, productId }, 'Failed to process product images');
    throw error;
  }
}

/**
 * Upload CSV or other file
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  directory: string,
  contentType?: string
): Promise<string> {
  const key = `${directory}/${Date.now()}-${filename}`;
  return uploadToS3(buffer, key, contentType);
}

/**
 * Initialize local storage directory
 */
export async function initializeLocalStorage(): Promise<void> {
  if (config.type === 'local') {
    await fs.mkdir(LOCAL_STORAGE_PATH, { recursive: true });
    logger.info({ path: LOCAL_STORAGE_PATH }, 'Local storage initialized');
  }
}