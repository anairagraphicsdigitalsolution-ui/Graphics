import type {ReactNode} from 'react';
import GrowthPrimaryNav from '@/components/growth-primary-nav';

export default function AIGrowthLayout({children}:{children:ReactNode}){
  return <div className="growth-app-shell"><GrowthPrimaryNav/><div className="growth-app-content">{children}</div></div>;
}
