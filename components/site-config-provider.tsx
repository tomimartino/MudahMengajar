"use client";
import { createContext,useContext } from "react";
import type { SiteConfig } from "@/types/admin.types";
const Context=createContext<SiteConfig>({site_name:"MudahMengajar",support_email:"",maintenance_mode:false});
export function SiteConfigProvider({config,children}:{config:SiteConfig;children:React.ReactNode}){return <Context.Provider value={config}>{children}</Context.Provider>;}
export function useSiteConfig(){return useContext(Context);}
