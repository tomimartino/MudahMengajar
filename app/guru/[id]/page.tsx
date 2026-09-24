import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Briefcase,
  MapPin,
  MessageCircle,
  Award,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/shared/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/utils/currency";
import { buildWaLink } from "@/lib/utils/whatsapp";
import { LEARNING_MODES } from "@/lib/constants";

interface PublicProfile {
  full_name: string;
  headline: string | null;
  bio: string | null;
  rate: string | null;
  career_start_year: number | null;
  address: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
  learning_mode: string | null;
  subjects: string[];
  experiences: {
    institution: string;
    role: string | null;
    start_year: number;
    end_year: number | null;
    description: string | null;
  }[];
  achievements: {
    title: string;
    year: number | null;
    description: string | null;
  }[];
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Profil Guru" };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let profile: PublicProfile | null = null;
  try {
    const { data } = await supabase.rpc("get_public_profile", { p_profile_id: id });
    profile = data as unknown as PublicProfile;
  } catch {
    profile = null;
  }

  if (!profile || !profile.full_name) notFound();

  const initials = profile.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const years = profile.career_start_year
    ? new Date().getFullYear() - profile.career_start_year
    : null;

  const waLink = profile.whatsapp
    ? buildWaLink(
        profile.whatsapp,
        `Halo ${profile.full_name}, saya melihat profil Anda di MudahMengajar dan ingin bertanya tentang les.`
      )
    : null;

  return (
    <div className="min-h-svh bg-muted/40 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start gap-5">
              <Avatar className="size-20">
                {profile.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
                <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                  {initials || "G"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold tracking-tight">{profile.full_name}</h1>
                <p className="text-muted-foreground">
                  {profile.headline || "Guru les privat & bimbel"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(profile.subjects ?? []).map((s) => (
                    <Badge key={s} variant="secondary" className="font-normal">
                      {s}
                    </Badge>
                  ))}
                  {profile.learning_mode && (
                    <Badge variant="outline" className="font-normal">
                      {LEARNING_MODES[profile.learning_mode as keyof typeof LEARNING_MODES] ??
                        profile.learning_mode}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {profile.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-4" /> {profile.address}
                    </span>
                  )}
                  {years !== null && years >= 0 && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="size-4" /> {years} tahun pengalaman
                    </span>
                  )}
                </div>
              </div>
              {waLink && (
                <Button asChild>
                  <a href={waLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" /> Hubungi via WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {profile.rate && (
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <Wallet className="size-5 text-primary" />
              <p className="text-lg font-bold">
                {formatRupiah(profile.rate)}
                <span className="text-sm font-normal text-muted-foreground"> / pertemuan</span>
              </p>
            </CardContent>
          </Card>
        )}

        {profile.bio && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tentang</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{profile.bio}</p>
            </CardContent>
          </Card>
        )}

        {(profile.experiences ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="size-4 text-primary" /> Pengalaman Mengajar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.experiences.map((e, i) => (
                <div key={i} className="border-l-2 border-primary/30 pl-4">
                  <p className="font-semibold">{e.institution}</p>
                  <p className="text-sm text-muted-foreground">
                    {e.role ?? "Guru"} ·{" "}
                    {e.end_year ? `${e.start_year} – ${e.end_year}` : `${e.start_year} – Sekarang`}
                  </p>
                  {e.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {(profile.achievements ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="size-4 text-primary" /> Sertifikat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.achievements.map((a, i) => (
                <div key={i}>
                  <p className="font-semibold">
                    <Award className="mr-1 inline size-4 text-amber-500" />
                    {a.title}
                  </p>
                  {a.year && <p className="text-sm text-muted-foreground">{a.year}</p>}
                  {a.description && (
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <p className="flex items-center justify-center gap-1.5 pb-6 text-center text-xs text-muted-foreground">
          <BadgeCheck className="size-3.5" /> Dibuat dengan MudahMengajar
        </p>
      </div>
    </div>
  );
}
