"use client";
import { Button } from "@/components/ui/button";
export default function AdminError({reset}:{reset:()=>void}){
  return <div className="mx-auto max-w-md space-y-4 p-8"><h1 className="text-xl font-semibold">Portal admin belum dapat dimuat</h1><Button onClick={reset}>Coba Lagi</Button></div>;
}
