import type { SupabaseClient } from '@supabase/supabase-js';

type StorageErrorLike = {
    message?: string;
    status?: number;
    statusCode?: string;
} | null | undefined;

interface EnsureBucketOptions {
    public: boolean;
    fileSizeLimit?: number;
    allowedMimeTypes?: string[];
}

function isBucketMissingError(error: StorageErrorLike): boolean {
    const message = error?.message?.toLowerCase() || '';
    return error?.status === 404
        || error?.statusCode === '404'
        || message.includes('not found')
        || message.includes('does not exist');
}

function isBucketAlreadyExistsError(error: StorageErrorLike): boolean {
    const message = error?.message?.toLowerCase() || '';
    return error?.status === 409
        || error?.statusCode === '409'
        || message.includes('already exists')
        || message.includes('duplicate');
}

function needsBucketUpdate(
    bucket: {
        public: boolean;
        file_size_limit?: number;
        allowed_mime_types?: string[];
    },
    options: EnsureBucketOptions,
): boolean {
    if (bucket.public !== options.public) {
        return true;
    }

    if (options.fileSizeLimit != null && bucket.file_size_limit !== options.fileSizeLimit) {
        return true;
    }

    if (!options.allowedMimeTypes?.length) {
        return false;
    }

    const current = new Set((bucket.allowed_mime_types || []).map((value) => value.toLowerCase()));
    const expected = new Set(options.allowedMimeTypes.map((value) => value.toLowerCase()));

    if (current.size !== expected.size) {
        return true;
    }

    for (const value of expected) {
        if (!current.has(value)) {
            return true;
        }
    }

    return false;
}

export async function ensureStorageBucket(
    admin: SupabaseClient,
    bucketName: string,
    options: EnsureBucketOptions,
): Promise<string | null> {
    const { data: bucket, error: getBucketError } = await admin.storage.getBucket(bucketName);

    if (getBucketError && !isBucketMissingError(getBucketError as StorageErrorLike)) {
        return getBucketError.message || `Failed to inspect storage bucket "${bucketName}"`;
    }

    if (!bucket) {
        const { error: createBucketError } = await admin.storage.createBucket(bucketName, options);

        if (createBucketError && !isBucketAlreadyExistsError(createBucketError as StorageErrorLike)) {
            return createBucketError.message || `Failed to create storage bucket "${bucketName}"`;
        }

        return null;
    }

    if (!needsBucketUpdate(bucket, options)) {
        return null;
    }

    const { error: updateBucketError } = await admin.storage.updateBucket(bucketName, options);

    if (updateBucketError) {
        return updateBucketError.message || `Failed to update storage bucket "${bucketName}"`;
    }

    return null;
}
