import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
export default function MaintenancePage(){return <main className="mx-auto my-auto max-w-md space-y-6 p-8"><Logo/><h1 className="text-2xl font-bold">Dalam Pemeliharaan</h1><Button asChild variant="outline"><Link href="/dashboard">Coba Lagi</Link></Button></main>;}
