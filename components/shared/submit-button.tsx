"use client";

import { Button } from "@/components/ui/button";

export function SubmitButton({
  pending,
  children,
  className,
  variant,
  loadingText = "Menyimpan...",
}: {
  pending: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
  loadingText?: string;
}) {
  return (
    <Button type="submit" disabled={pending} className={className} variant={variant}>
      {pending ? loadingText : children}
    </Button>
  );
}
