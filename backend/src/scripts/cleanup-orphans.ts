import "dotenv/config";
import mongoose from "mongoose";
import {
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { connectDB } from "@/config/db";
import { r2Client } from "@/config/r2";
import Project from "@/models/Project.model";

const PRIVATE_BUCKET = process.env.R2_PRIVATE_BUCKET_NAME as string;
const PUBLIC_BUCKET = process.env.R2_PUBLIC_BUCKET_NAME as string;

/**
 * Lists all objects in a bucket and returns their keys.
 */
const listAllObjects = async (
  bucket: string
): Promise<string[]> => {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of result.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }

    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
};

/**
 * Deletes objects in batches of 1000 (S3 API limit).
 */
const batchDelete = async (
  bucket: string,
  keys: string[]
): Promise<void> => {
  const batchSize = 1000;

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);

    await r2Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((k) => ({ Key: k })),
          Quiet: true,
        },
      })
    );

    console.log(
      `🗑️  Deleted batch of ${batch.length} objects from ${bucket}`
    );
  }
};

const cleanup = async () => {
  console.log("🧹 Starting orphan cleanup...\n");

  await connectDB();

  // Get all valid project IDs from MongoDB
  const projects = await Project.find({}).select("_id").lean();
  const validProjectIds = new Set(
    projects.map((p) => p._id.toString())
  );

  console.log(
    `✅ Found ${validProjectIds.size} valid projects in MongoDB\n`
  );

  // ── Clean Private Bucket ──────────────────────────────────────

  console.log(
    `📦 Scanning private bucket: ${PRIVATE_BUCKET}...`
  );
  const privateKeys = await listAllObjects(PRIVATE_BUCKET);
  console.log(
    `   Found ${privateKeys.length} total objects\n`
  );

  const orphanPrivateKeys = privateKeys.filter((key) => {
    // Key format: projects/:projectId/masters/file.zip
    const projectId = key.split("/")[1];
    return !validProjectIds.has(projectId);
  });

  console.log(
    `   🔍 Orphan objects: ${orphanPrivateKeys.length}`
  );

  if (orphanPrivateKeys.length > 0) {
    console.log("   Deleting orphans...");
    await batchDelete(PRIVATE_BUCKET, orphanPrivateKeys);
    console.log(
      `   ✅ Deleted ${orphanPrivateKeys.length} orphan objects from private bucket\n`
    );
  } else {
    console.log("   ✅ No orphans found in private bucket\n");
  }

  // ── Clean Public Bucket ───────────────────────────────────────

  console.log(
    `📦 Scanning public bucket: ${PUBLIC_BUCKET}...`
  );
  const publicKeys = await listAllObjects(PUBLIC_BUCKET);
  console.log(
    `   Found ${publicKeys.length} total objects\n`
  );

  const orphanPublicKeys = publicKeys.filter((key) => {
    const projectId = key.split("/")[1];
    return !validProjectIds.has(projectId);
  });

  console.log(
    `   🔍 Orphan objects: ${orphanPublicKeys.length}`
  );

  if (orphanPublicKeys.length > 0) {
    console.log("   Deleting orphans...");
    await batchDelete(PUBLIC_BUCKET, orphanPublicKeys);
    console.log(
      `   ✅ Deleted ${orphanPublicKeys.length} orphan objects from public bucket\n`
    );
  } else {
    console.log("   ✅ No orphans found in public bucket\n");
  }

  // ── Also clean MongoDB orphan projects ───────────────────────

  console.log("🗄️  Cleaning MongoDB orphan projects...");

  const deletedProjects = await Project.deleteMany({
    status: { $in: ["processing", "error"] },
    // Created more than 2 hours ago and still processing = abandoned
    createdAt: {
      $lt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  });

  console.log(
    `   ✅ Removed ${deletedProjects.deletedCount} abandoned project records\n`
  );

  console.log("🎉 Cleanup complete!");
  await mongoose.connection.close();
};

cleanup().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});