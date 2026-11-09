import {getPortfolioContent} from '@/lib/content';
import GalleryClient from '@/components/gallery-client';
export const revalidate=0;
export const metadata={title:'Gallery | Anaira Graphics & Digital Solution',description:'Explore selected creative design, branding, digital campaigns, websites and technology work by Anaira Graphics & Digital Solution.'};
export default async function GalleryPage(){const {settings}=await getPortfolioContent();return <GalleryClient settings={settings}/>;}
