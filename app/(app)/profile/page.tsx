import type { Metadata } from "next";
import { MapPin, MessageCircle, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AmountText } from "@/components/shared/amount-text";
import { PortfolioEditButton } from "@/components/profile/portfolio-edit-form";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { ShareProfileButton } from "@/components/profile/share-profile-button";
import { ExperienceSection } from "@/components/profile/experience-section";
import { AchievementSection } from "@/components/profile/achievement-section";
import { buildWaLink } from "@/lib/utils/whatsapp";
import { LEARNING_MODES } from "@/lib/constants";
import { getOrigin } from "@/lib/utils/origin";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: subjects }, { data: experiences }, { data: achievements }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single(),
      supabase.from("subjects").select("id, name").eq("user_id", user!.id).order("name"),
      supabase
        .from("teaching_experiences")
        .select("*")
        .eq("user_id", user!.id)
        .order("start_year", { ascending: false }),
      supabase
        .from("achievements")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false }),
    ]);

  if (!profile) return null;

  const origin = await getOrigin();
  const profileUrl = `${origin}/guru/${profile.slug ?? user!.id}`;

  const initials = (profile.full_name || "G")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const yearsExperience = profile.career_start_year
    ? new Date().getFullYear() - profile.career_start_year
    : null;

  return (
    <div>
      <PageHeader
        title="Profil"
        description="Portofolio kamu sebagai guru — terlihat seperti profil profesional."
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start gap-5">
            <AvatarUpload avatarUrl={profile.avatar_url} initials={initials} />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold tracking-tight">{profile.full_name || "Guru"}</h2>
              <p className="text-muted-foreground">
                {profile.headline || "Belum ada headline — tambahkan di Edit Profil."}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(profile.teaching_levels ?? []).map((l) => (
                  <Badge key={l} variant="secondary" className="font-normal">
                    {l}
                  </Badge>
                ))}
                {(subjects ?? []).map((s) => (
                  <Badge key={s.id} variant="secondary" className="font-normal">
                    {s.name}
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
                {profile.whatsapp && (
                  <a
                    href={buildWaLink(profile.whatsapp, `Halo ${profile.full_name},`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <MessageCircle className="size-4" /> {profile.whatsapp}
                  </a>
                )}
                {yearsExperience !== null && yearsExperience >= 0 && (
                  <span className="flex items-center gap-1">
                    <Wallet className="size-4" /> {yearsExperience} tahun pengalaman
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ShareProfileButton url={profileUrl} />
              <PortfolioEditButton
                initial={{
                  full_name: profile.full_name,
                  whatsapp: profile.whatsapp,
                  timezone: profile.timezone,
                  headline: profile.headline,
                  bio: profile.bio,
                  rate: profile.rate,
                  career_start_year: profile.career_start_year,
                  address: profile.address,
                  teaching_levels: profile.teaching_levels ?? [],
                  learning_mode: profile.learning_mode ?? "offline",
                  slug: profile.slug ?? "",
                }}
                subjects={subjects ?? []}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tentang</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {profile.bio || "Belum ada deskripsi. Ceritakan pendekatan mengajarmu di Edit Profil."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <ExperienceSection experiences={experiences ?? []} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tarif</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.rate ? (
                <p className="text-lg font-bold">
                  <AmountText value={profile.rate} /> <span className="text-sm font-normal text-muted-foreground">/ pertemuan</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Belum ada tarif — tambahkan di Edit Profil.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <AchievementSection achievements={achievements ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
