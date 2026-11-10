import { decryptSecret } from '@/lib/growth-crypto';

export type WhatsAppCredentials = { access_token: string; phone_number_id: string; graph_api_version: string; waba_id?: string | null };

export async function getWhatsAppCredentials(db: any, organizationId: string, phoneNumberId?: string | null): Promise<WhatsAppCredentials | null> {
  let query = db.from('growth_whatsapp_connections')
    .select('encrypted_credentials,phone_number_id,waba_id,graph_api_version,connection_status')
    .eq('organization_id', organizationId)
    .eq('connection_status', 'connected');
  if (phoneNumberId) query = query.eq('phone_number_id', phoneNumberId);
  const { data: rows } = await query.order('created_at', { ascending: true }).limit(2);
  // Never guess a sender when a tenant has multiple connected numbers.
  if (!phoneNumberId && (rows?.length || 0) > 1) return null;
  const data = rows?.[0] || null;
  if (data?.encrypted_credentials && data.phone_number_id) {
    const secret = decryptSecret(data.encrypted_credentials) as any;
    if (secret?.access_token) return {
      access_token: secret.access_token,
      phone_number_id: data.phone_number_id,
      waba_id: data.waba_id,
      graph_api_version: data.graph_api_version || process.env.META_GRAPH_API_VERSION || 'v22.0',
    };
  }
  // Backward-compatible legacy connection is restricted to its explicitly configured organization.
  if ((!phoneNumberId || phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID) &&
      process.env.WHATSAPP_ORGANIZATION_ID === organizationId &&
      process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return {
      access_token: process.env.WHATSAPP_ACCESS_TOKEN,
      phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
      graph_api_version: process.env.META_GRAPH_API_VERSION || 'v22.0',
    };
  }
  return null;
}
