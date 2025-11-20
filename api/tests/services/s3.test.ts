import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3Service } from '../../src/services/s3.js';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/s3-request-presigner');

describe('S3Service', () => {
    let s3Service: S3Service;

    beforeEach(() => {
        vi.clearAllMocks();
        s3Service = new S3Service();
    });

    describe('getPresignedUploadUrl', () => {
        it('generates a presigned PUT URL', async () => {
            const mockUrl = 'https://s3.amazonaws.com/test-bucket/test-key?signature=abc';
            vi.mocked(getSignedUrl).mockResolvedValue(mockUrl);

            const result = await s3Service.getPresignedUploadUrl('test-key', 'image/jpeg');

            expect(result).toBe(mockUrl);
            expect(getSignedUrl).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(PutObjectCommand),
                expect.objectContaining({ expiresIn: 900 })
            );
        });
    });

    describe('getPresignedDownloadUrl', () => {
        it('generates a presigned GET URL', async () => {
            const mockUrl = 'https://s3.amazonaws.com/test-bucket/test-key?signature=xyz';
            vi.mocked(getSignedUrl).mockResolvedValue(mockUrl);

            const result = await s3Service.getPresignedDownloadUrl('test-key');

            expect(result).toBe(mockUrl);
            expect(getSignedUrl).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(GetObjectCommand),
                expect.objectContaining({ expiresIn: 3600 })
            );
        });
    });

    describe('deleteObject', () => {
        it('sends a delete command to S3', async () => {
            const mockSend = vi.fn().mockResolvedValue({});
            vi.spyOn(s3Service['client'], 'send').mockImplementation(mockSend);

            await s3Service.deleteObject('test-key');

            expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
        });
    });
});
