import type { SupabaseClient } from '@supabase/supabase-js';

export type GrowthQuotaResult = {
  allowed: boolean;
  reason?: string;
  metric?: string;
  used?: number;
  limit?: number;
  duplicate?: boolean;
};

/** Atomic server-side metering. Existing workspaces without an assigned plan remain unmetered until a plan is configured. */
export async function consumeGrowthQuota(
  db: SupabaseClient,
  organizationId: string,
  metric: 'leads' | 'ai_messages' | 'whatsapp_messages' | 'email_messages' | 'social_posts' | 'media_bytes' | 'workflow_runs',
  quantity = 1,
  idempotencyKey?: string,
  metadata: Record<string, unknown> = {},
): Promise<GrowthQuotaResult> {
  const { data, error } = await db.rpc('consume_growth_quota', {
    p_organization_id: organizationId,
    p_metric: metric,
    p_quantity: quantity,
    p_idempotency_key: idempotencyKey || null,
    p_metadata: metadata,
  });
  if (error || !data || typeof data.allowed !== 'boolean') {
    return { allowed: false, reason: 'quota_service_unavailable', metric };
  }
  return data as GrowthQuotaResult;
}

export function quotaErrorMessage(result: GrowthQuotaResult) {
  if (result.reason === 'quota_exceeded') {
    return `Your ${result.metric} plan limit has been reached (${result.used}/${result.limit}). Upgrade your plan or contact the workspace administrator.`;
  }
  if (result.reason === 'workspace_inactive') return 'This workspace is inactive. Contact the platform administrator.';
  if (result.reason === 'subscription_inactive') return 'This workspace subscription is not active. Contact the platform administrator to restore access.';
  return 'Usage metering is temporarily unavailable. Please try again later.';
}
