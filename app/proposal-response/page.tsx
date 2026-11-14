import { Suspense } from 'react';
import GrowthProposalResponse from '@/components/growth-proposal-response';
export const metadata = { title: 'Review Proposal | Anaira' };
export default function ProposalResponsePage() {
  return <Suspense fallback={<main style={{ padding: 32 }}>Loading proposal…</main>}><GrowthProposalResponse /></Suspense>;
}
