import { Suspense } from 'react';
import GrowthLoginClient from './GrowthLoginClient';

export default function GrowthLoginPage() {
  return (
    <Suspense fallback={<main className="growth-login-page"><div className="growth-login-card">Loading login...</div></main>}>
      <GrowthLoginClient />
    </Suspense>
  );
}
