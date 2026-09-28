"use client";

import { useEffect } from "react";

export function PrintOnLoad({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, [active]);

  return null;
}
