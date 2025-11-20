import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env.js';

function slugifyLabel(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase()
    .slice(0, 60);
}

export function formatS3Segment(label: string | null | undefined, id: string) {
  const slug = typeof label === 'string' ? slugifyLabel(label) : '';
  return slug ? `${slug}-${id}` : id;
}

export function buildPetScopePrefix(args: {
  userLabel: string | null | undefined;
  userId: string;
  customerName: string | null | undefined;
  customerId: string;
  petName: string | null | undefined;
  petId: string;
}) {
  const userSegment = formatS3Segment(args.userLabel, args.userId);
  const customerSegment = formatS3Segment(args.customerName, args.customerId);
  const petSegment = formatS3Segment(args.petName, args.petId);
  return `${userSegment}/${customerSegment}/${petSegment}`;
}

export class S3Service {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    const region = env.AWS_REGION;
    const bucketName = env.S3_BUCKET_NAME;

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
