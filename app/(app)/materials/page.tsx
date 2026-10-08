import { LearningPage } from "@/components/learning/learning-page";
export default async function MaterialsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {return <LearningPage kind="material" query={await searchParams}/>;}
