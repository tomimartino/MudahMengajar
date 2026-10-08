import type { Json } from "@/types/database.types";
export interface LearningFile { name:string; path:string; size:number }
export interface LearningMaterial { id:string;user_id:string;title:string;content:string;source_session_id:string|null;files:Json;created_at:string;updated_at:string }
export interface HomeworkTask { id:string;user_id:string;student_id:string;session_id:string|null;title:string;description:string;due_date:string|null;status:"assigned"|"completed";completed_at:string|null;files:Json;created_at:string;updated_at:string }
type Table<Row,Required extends keyof Row>={Row:{[K in keyof Row]:Row[K]};Insert:Partial<Row>&Pick<Row,Required>;Update:Partial<Row>;Relationships:[]};
export type LearningTables={learning_materials:Table<LearningMaterial,"user_id"|"title">;homework_tasks:Table<HomeworkTask,"user_id"|"student_id"|"title">};
