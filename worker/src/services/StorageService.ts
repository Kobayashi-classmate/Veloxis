import { S3Client, GetObjectCommand, PutObjectCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { config } from '../config';
import { Readable } from 'stream';

export class StorageService {
    private client: S3Client;
    private bucket: string;

    constructor() {
        this.client = new S3Client({
            region: config.s3.region,
            endpoint: config.s3.endpoint,
            forcePathStyle: config.s3.forcePathStyle, // Required for SeaweedFS
            credentials: {
                accessKeyId: config.s3.accessKey,
                secretAccessKey: config.s3.secretKey,
            }
        });
        this.bucket = config.s3.bucket;
    }

    async initBucket() {
        try {
            await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
            console.log(`[Storage] Ensured bucket '${this.bucket}' exists.`);
        } catch (error: any) {
            // Error code for bucket already exists may vary, usually it's BucketAlreadyExists or BucketAlreadyOwnedByYou
            if (error.name !== 'BucketAlreadyExists' && error.name !== 'BucketAlreadyOwnedByYou') {
                console.error(`[Storage] Failed to init bucket:`, error);
            }
        }
    }

    async downloadFileStream(fileId: string): Promise<Readable> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: fileId
        });
        
        const response = await this.client.send(command);
        
        if (!response.Body) {
            throw new Error(`File ${fileId} not found or empty`);
        }
        
        return response.Body as Readable;
    }
}
