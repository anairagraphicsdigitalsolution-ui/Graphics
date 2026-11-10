import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';
import { consumeGrowthQuota, quotaErrorMessage } from '@/lib/growth-quota';

export const runtime = 'nodejs';
export const maxDuration = 30;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov'
};

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const form = await req.formData();
    const orgId = String(form.get('organizationId') || '');
    const file = form.get('file');
    if (!(file instanceof File) || !orgId) return apiJson({ error: 'Workspace and media file are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, orgId, ['owner', 'manager', 'editor'])) return apiJson({ error: 'Media upload permission denied.' }, 403);
    const ext = MIME_EXT[file.type];
    if (!ext) return apiJson({ error: 'Unsupported media type. Use JPG, PNG, WEBP, GIF, MP4 or MOV.' }, 415);
    const isVideo = file.type.startsWith('video/');
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size <= 0 || file.size > maxBytes) return apiJson({ error: `File size must be between 1 byte and ${Math.round(maxBytes / 1024 / 1024)} MB for this media type.` }, 413);
    const quota=await consumeGrowthQuota(ctx.db,orgId,'media_bytes',file.size,undefined,{mime_type:file.type});if(!quota.allowed)return apiJson({error:quotaErrorMessage(quota),quota},quota.reason==='quota_exceeded'?402:503);
    const bucket = process.env.GROWTH_MEDIA_BUCKET || 'growth-media';
    const { data: existing } = await ctx.db.storage.getBucket(bucket);
    if (!existing) {
      const { error: createError } = await ctx.db.storage.createBucket(bucket, { public: true, fileSizeLimit: MAX_VIDEO_BYTES, allowedMimeTypes: Object.keys(MIME_EXT) });
      if (createError && !/already exists/i.test(createError.message)) return apiJson({ error: `Storage bucket setup failed: ${createError.message}` }, 503);
    }
    const safeName = `${randomUUID()}.${ext}`;
    const path = `${orgId}/${new Date().getUTCFullYear()}/${String(new Date().getUTCMonth()+1).padStart(2,'0')}/${safeName}`;
    const { error: uploadError } = await ctx.db.storage.from(bucket).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false, cacheControl: '31536000' });
    if (uploadError) return apiJson({ error: `Media upload failed: ${uploadError.message}` }, 502);
    const { data } = ctx.db.storage.from(bucket).getPublicUrl(path);
    return apiJson({ media: { path, url: data.publicUrl, name: file.name, mimeType: file.type, size: file.size, kind: isVideo ? 'video' : 'image' } }, 201);
  } catch {
    return apiJson({ error: 'Unable to process media upload.' }, 400);
  }
}
