import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { r2Client } from "@/config/r2";

const PUBLIC_BUCKET = process.env.R2_PUBLIC_BUCKET_NAME as string;
const PRIVATE_BUCKET = process.env.R2_PRIVATE_BUCKET_NAME as string;
const PUBLIC_CDN_URL = process.env.R2_PUBLIC_CDN_URL as string;

// ─── Upload ────────────────────────────────────────────────────────────────────

/**
 * Uploads a buffer or stream to R2 public bucket (optimized previews).
 * Returns the full CDN URL for the uploaded file.
 */
export const uploadPreviewToR2 = async (
  key: string,
  body: Buffer | Readable,
  contentType: string = "image/jpeg"
): Promise<string> => {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: PUBLIC_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  });

  await upload.done();

  return `${PUBLIC_CDN_URL}/${key}`;
};

/**
 * Uploads the original master ZIP to R2 private bucket.
 * Uses multipart upload with progress tracking.
 * Falls back to simple upload for smaller files.
 */
export const uploadMasterZipToR2 = async (
  key: string,
  body: Buffer | Readable,
  contentType: string = "application/zip",
  onProgress?: (percent: number) => void
): Promise<void> => {
  console.log(`[R2] Starting upload: key=${key}, contentType=${contentType}`);
  console.log(`[R2] Body type: ${Buffer.isBuffer(body) ? "Buffer" : "Readable"}`);
  
  if (Buffer.isBuffer(body)) {
    console.log(`[R2] Buffer size: ${(body.length / 1024 / 1024).toFixed(2)}MB`);
    
    // For buffers > 100MB, use multipart upload for progress tracking
    if (body.length > 100 * 1024 * 1024) {
      console.log(`[R2] Using multipart upload (buffer > 100MB)...`);
      return uploadViaMultipart(key, body, contentType, onProgress);
    }
  }

  // For small files or streams, use simple upload
  console.log(`[R2] Using simple upload...`);
  return uploadViaSimple(key, body, contentType, onProgress);
};

/**
 * Upload via multipart with progress tracking
 */
const uploadViaMultipart = async (
  key: string,
  buffer: Buffer,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<void> => {
  console.log(`[R2] Multipart upload starting for ${(buffer.length / 1024 / 1024).toFixed(2)}MB...`);

  // Create a readable stream that yields chunks
  const stream = Readable.from(
    (async function* () {
      const partSize = 10 * 1024 * 1024; // 10MB chunks
      let offset = 0;
      
      while (offset < buffer.length) {
        const chunk = buffer.slice(offset, offset + partSize);
        console.log(`[R2] Yielding chunk: ${(offset / 1024 / 1024).toFixed(2)}MB - ${((offset + chunk.length) / 1024 / 1024).toFixed(2)}MB`);
        yield chunk;
        offset += chunk.length;
      }
    })()
  );

  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: process.env.R2_PRIVATE_BUCKET_NAME as string,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ContentLength: buffer.length,
    },
    leavePartsOnError: false,
    partSize: 10 * 1024 * 1024, // 10MB
  });

  let eventCount = 0;
  let lastPercent = 0;

  if (onProgress) {
    upload.on("httpUploadProgress", (progress) => {
      try {
        eventCount++;
        if (progress.total && progress.loaded) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          if (percent !== lastPercent) {
            console.log(`[R2] Progress: ${percent}% (${(progress.loaded / 1024 / 1024).toFixed(2)}MB / ${(progress.total / 1024 / 1024).toFixed(2)}MB) [event #${eventCount}]`);
            lastPercent = percent;
          }
          onProgress(percent);
        }
      } catch (err) {
        console.error(`[R2] Progress callback error:`, err);
      }
    });
  }

  try {
    console.log(`[R2] Awaiting multipart upload...`);
    await Promise.race([
      upload.done(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`[R2] Multipart upload timeout after 4 hours (${eventCount} events)`)),
          4 * 60 * 60 * 1000
        )
      ),
    ]);
    console.log(`[R2] Multipart upload completed! (${eventCount} progress events)`);
  } catch (err) {
    console.error(`[R2] Multipart upload failed:`, err instanceof Error ? err.message : err);
    throw err;
  }
};

/**
 * Upload via simple PUT (for small files)
 */
const uploadViaSimple = async (
  key: string,
  body: Buffer | Readable,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<void> => {
  try {
    console.log(`[R2] Simple PUT upload starting...`);

    // For buffers, we can track progress by uploading and calling onProgress
    if (Buffer.isBuffer(body)) {
      console.log(`[R2] Buffer upload (${(body.length / 1024 / 1024).toFixed(2)}MB)`);
      onProgress?.(0); // Start at 0%
      
      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_PRIVATE_BUCKET_NAME as string,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.length,
        })
      );
      
      onProgress?.(100); // Complete
    } else {
      // Stream upload
      console.log(`[R2] Stream upload`);
      onProgress?.(0);
      
      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_PRIVATE_BUCKET_NAME as string,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );
      
      onProgress?.(100);
    }

    console.log(`[R2] Simple upload completed!`);
  } catch (err) {
    console.error(`[R2] Simple upload failed:`, err instanceof Error ? err.message : err);
    throw err;
  }
};

/**
 * Uploads an original photo file to the private bucket.
 * Used for full-quality downloads.
 */
export const uploadOriginalToR2 = async (
  key: string,
  body: Buffer | Readable,
  contentType: string = "application/octet-stream"
): Promise<void> => {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: PRIVATE_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  });

  await upload.done();
};

// ─── Delete ────────────────────────────────────────────────────────────────────

/**
 * Deletes ALL objects under a given prefix from BOTH buckets.
 * Used for cascade project deletion.
 *
 * R2/S3 has no "delete folder" API — we must:
 *   1. List all objects with the prefix
 *   2. Delete them in batches of 1000 (S3 API limit)
 */
export const deleteR2Folder = async (prefix: string): Promise<void> => {
  await deleteFolderFromBucket(PUBLIC_BUCKET, prefix);
  await deleteFolderFromBucket(PRIVATE_BUCKET, prefix);
};

const deleteFolderFromBucket = async (
  bucket: string,
  prefix: string
): Promise<void> => {
  let continuationToken: string | undefined;

  do {
    // List up to 1000 objects at a time
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const listResult = await r2Client.send(listCommand);

    const objects = listResult.Contents ?? [];

    if (objects.length === 0) break;

    // Batch delete — S3 DeleteObjects accepts up to 1000 keys at once
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: objects.map((obj) => ({ Key: obj.Key as string })),
        Quiet: true, // Don't return success info — only errors
      },
    });

    await r2Client.send(deleteCommand);

    continuationToken = listResult.IsTruncated
      ? listResult.NextContinuationToken
      : undefined;
  } while (continuationToken);
};

/**
 * Deletes a single object from the public bucket.
 * Used when replacing a cover image, etc.
 */
export const deletePreviewFromR2 = async (key: string): Promise<void> => {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: PUBLIC_BUCKET,
      Key: key,
    })
  );
};

// ─── Signed URL ────────────────────────────────────────────────────────────────

/**
 * Generates a time-limited signed URL for a private bucket object.
 * Used when photographer downloads original master files.
 * Default expiry: 1 hour.
 */
export const getPrivateSignedUrl = async (
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const getPrivateObjectBuffer = async (key: string): Promise<Buffer> => {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: PRIVATE_BUCKET,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error("R2 returned empty body for object.");
  }

  return streamToBuffer(response.Body as Readable);
};

export const createMultipartUpload = async (
  key: string,
  contentType: string
): Promise<string> => {
  const response = await r2Client.send(
    new CreateMultipartUploadCommand({
      Bucket: PRIVATE_BUCKET,
      Key: key,
      ContentType: contentType,
    })
  );

  if (!response.UploadId) {
    throw new Error("Failed to create multipart upload.");
  }

  return response.UploadId;
};

export const getMultipartUploadPartUrl = async (
  key: string,
  uploadId: string,
  partNumber: number,
  expiresInSeconds: number = 60 * 60
): Promise<string> => {
  const command = new UploadPartCommand({
    Bucket: PRIVATE_BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
};

export const listMultipartUploadParts = async (
  key: string,
  uploadId: string
): Promise<Array<{ partNumber: number; etag: string; size?: number }>> => {
  const response = await r2Client.send(
    new ListPartsCommand({
      Bucket: PRIVATE_BUCKET,
      Key: key,
      UploadId: uploadId,
    })
  );

  return (response.Parts ?? [])
    .filter((part) => part.PartNumber && part.ETag)
    .map((part) => ({
      partNumber: part.PartNumber as number,
      etag: String(part.ETag),
      size: part.Size,
    }));
};

export const completeMultipartUpload = async (
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<void> => {
  await r2Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: PRIVATE_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    })
  );
};

export const abortMultipartUpload = async (
  key: string,
  uploadId: string
): Promise<void> => {
  await r2Client.send(
    new AbortMultipartUploadCommand({
      Bucket: PRIVATE_BUCKET,
      Key: key,
      UploadId: uploadId,
    })
  );
};