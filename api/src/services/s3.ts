import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Lazy-load env to avoid import-time validation failures in tests
let envModule: typeof import('../env.js') | null = null;
try {
    envModule = await import('../env.js');
} catch {
    // Env not available in test environment
}

export class S3Service {
    private client: S3Client;
    private bucketName: string;

    constructor() {
        const region = envModule?.env.AWS_REGION || 'us-east-1';
        const bucketName = envModule?.env.S3_BUCKET_NAME || 'test-bucket';

        this.client = new S3Client({ region });
        this.bucketName = bucketName;
    }

    async getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType,
        });

        return getSignedUrl(this.client, command, { expiresIn: 900 }); // 15 minutes
    }

    async getPresignedDownloadUrl(key: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        return getSignedUrl(this.client, command, { expiresIn: 3600 }); // 1 hour
    }

    async deleteObject(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        await this.client.send(command);
    }
}

export const s3Service = new S3Service();
