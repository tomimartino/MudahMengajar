"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { saveReviewAction, deleteReviewAction } from "@/lib/actions/reviews";
import { reviewSchema } from "@/lib/validations/review";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import type { AppReview } from "@/types/database.types";

const RATINGS = ["Sangat kurang", "Kurang", "Cukup", "Baik", "Sangat baik"];

export function ReviewForm({ initial, loadError = false }: { initial: AppReview | null; loadError?: boolean }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saved, setSaved] = useState(initial !== null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = reviewSchema.safeParse({ rating, comment });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review tidak valid.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await saveReviewAction(parsed.data);
      if (!result.ok) { setError(result.error ?? "Review gagal disimpan."); return; }
      setSaved(true);
      setComment(parsed.data.comment);
      toast.success("Review pribadi Anda disimpan.");
    });
  }

  async function remove() {
    const result = await deleteReviewAction();
    if (result.ok) {
      setSaved(false); setRating(0); setComment(""); setError("");
      toast.success("Review dihapus.");
    }
    return result;
  }

  if (loadError) return <p role="alert" className="text-sm text-destructive">Review belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={pending} className="space-y-2">
        <legend className="text-sm font-medium">Rating website</legend>
        <div className="flex flex-wrap gap-2">
          {RATINGS.map((label, index) => (
            <label key={label} className="relative cursor-pointer">
              <input type="radio" name="review-rating" value={index + 1} checked={rating === index + 1}
                onChange={() => setRating(index + 1)} aria-label={`${index + 1} bintang — ${label}`}
                className="peer sr-only" />
              <span className={cn("flex size-11 items-center justify-center rounded-xl border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring", rating === index + 1 && "border-primary bg-primary/10")}>
                <Star aria-hidden="true" className={cn("size-6", index < rating ? "fill-primary text-primary" : "text-muted-foreground")} />
              </span>
            </label>
          ))}
        </div>
        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{rating > 0 ? `${rating}/5 · ${RATINGS[rating - 1]}` : "Belum diberi rating"}</p>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="review-comment">Komentar & saran</Label>
        <Textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
          minLength={10} maxLength={2000} required disabled={pending} aria-describedby="review-error" />
        <div className="flex justify-end text-xs text-muted-foreground">
          <span className="shrink-0">{comment.length}/2.000</span>
        </div>
      </div>
      <p id="review-error" role="alert" className="text-sm text-destructive">{error}</p>
      <div className="flex flex-wrap justify-end gap-2">
        {saved && <ConfirmDialog trigger={<Button type="button" variant="outline" disabled={pending}>Hapus Review</Button>}
          title="Hapus review?" description="Rating dan komentar Anda akan dihapus."
          confirmLabel="Hapus Review" onConfirm={remove} />}
        <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : saved ? "Perbarui Review" : "Kirim Review"}</Button>
      </div>
    </form>
  );
}
