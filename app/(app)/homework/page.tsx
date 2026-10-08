import { LearningPage } from "@/components/learning/learning-page";
export default async function HomeworkPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {return <LearningPage kind="homework" query={await searchParams}/>;}
