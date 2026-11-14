import type {ReactNode} from 'react';
import GrowthPrimaryNav from '@/components/growth-primary-nav';

export default function AIGrowthLayout({children}:{children:ReactNode}){
  return <><GrowthPrimaryNav/>{children}</>;
}
