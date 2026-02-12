import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";

const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
    },
    forcePathStyle: true, // Required for MinIO
});

const BUCKET = process.env.S3_BUCKET_NAME || "kaizen-uploads";

export async function ensureBucket() {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    } catch {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    }
}

export async function uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder: string = "uploads"
): Promise<{ storagePath: string; fileSize: number }> {
    const ext = originalName.split(".").pop() || "bin";
    const key = `${folder}/${uuid()}.${ext}`;

    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
        })
    );

    return { storagePath: key, fileSize: buffer.length };
}

export async function getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
): Promise<string> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteFile(key: string): Promise<void> {
    await s3Client.send(
        new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
    );
}

export { s3Client, BUCKET };
