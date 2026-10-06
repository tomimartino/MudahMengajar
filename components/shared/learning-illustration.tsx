import { cn } from "@/lib/utils";

/** Decorative artwork: books, a pencil, and a growing plant. */
export function LearningIllustration({ className }: { className?: string }) {
  return (
    <svg data-ui="learning-art" viewBox="0 0 280 190" fill="none" aria-hidden="true" className={cn("text-primary", className)}>
      <g data-learning-art="standard">
      <circle cx="144" cy="96" r="75" fill="var(--card)" opacity=".45" />
      <circle cx="241" cy="43" r="9" fill="var(--sunshine)" />
      <circle cx="35" cy="94" r="5" fill="var(--sky-foreground)" opacity=".4" />
      <path d="m51 41 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fill="var(--sunshine)" />
      <path d="M231 117v-39" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M231 93c-20 0-29-10-28-25 18-1 28 8 28 25Z" fill="var(--mint-foreground)" opacity=".7" />
      <path d="M232 83c0-18 10-28 26-28 1 17-9 28-26 28Z" fill="currentColor" />
      <path d="m212 115 5 33h29l5-33h-39Z" fill="var(--peach-foreground)" opacity=".5" />
      <rect x="57" y="138" width="142" height="23" rx="7" fill="var(--sky-foreground)" />
      <path d="M71 144h119v11H71a5.5 5.5 0 0 1 0-11Z" fill="var(--card)" />
      <rect x="65" y="114" width="130" height="24" rx="6" fill="var(--sunshine)" />
      <path d="M78 120h108v12H78a6 6 0 0 1 0-12Z" fill="var(--card)" />
      <path d="m129 108-16-25-33-1-14 17 63 9Z" fill="var(--card)" />
      <path d="m129 108 17-25 33-1 14 17-64 9Z" fill="var(--card)" />
      <path d="M129 110V68c-16-15-40-20-63-17v48c23-3 47 1 63 11Z" fill="var(--mint-foreground)" />
      <path d="M129 110V68c17-15 41-20 64-17v48c-23-3-47 1-64 11Z" fill="currentColor" />
      <path d="m77 65 35 10M77 76l35 10m34-11 35-10m-35 21 35-10" stroke="var(--card)" strokeWidth="3" strokeLinecap="round" opacity=".65" />
      <g transform="rotate(24 208 95)">
        <rect x="201" y="45" width="13" height="89" rx="3" fill="var(--sunshine)" />
        <path d="m201 134 6.5 14 6.5-14" fill="var(--peach-foreground)" />
        <path d="m205 143 2.5 5 2.5-5" fill="var(--foreground)" />
        <path d="M201 59h13" stroke="var(--card)" strokeWidth="4" />
      </g>
      <path d="M47 167h206" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".2" />
      </g>
      <g data-learning-art="pixel" shapeRendering="crispEdges">
        <path d="M68 28h120v8h8v72h-8v8H68v-8h-8V36h8z" fill="var(--foreground)" />
        <path d="M76 36h104v64H76z" fill="var(--card)" />
        <path d="M84 44h88v48H84z" fill="var(--mint)" />
        <path d="M116 52h12v8h12v8h-12v8h-12v-8h-12v-8h12z" fill="currentColor" />
        <path d="M116 116h24v16h-24zM96 132h64v8H96z" fill="var(--foreground)" />
        <path d="M52 150h152v8h8v16H44v-16h8z" fill="var(--sky-foreground)" />
        <path d="M60 156h136v10H60z" fill="var(--card)" />
        <path d="M68 160h8m8 0h8m8 0h8m8 0h8m8 0h8m8 0h8m8 0h8m8 0h8" stroke="currentColor" strokeWidth="4" />
        <path d="M24 84h24v8h8v48H16V92h8z" fill="var(--sunshine)" />
        <path d="M24 96h24v6H24zm0 12h16v6H24zm0 12h24v6H24z" fill="var(--foreground)" opacity=".5" />
        <path d="M222 108h24v8h8v24h-8v8h-24v-8h-8v-24h8z" fill="var(--peach-foreground)" />
        <path d="M222 116h24v20h-24z" fill="var(--sunshine)" />
        <path d="M228 120h4v4h-4zm10 0h4v4h-4z" fill="var(--foreground)" />
        <path d="M224 148h20v8h8v16h-36v-16h8z" fill="currentColor" />
        <path d="M226 46h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill="var(--sunshine)" />
        <path d="M36 32h8v8h-8zm172 132h8v8h-8z" fill="currentColor" />
      </g>
      <g data-learning-art="hacker">
        <rect x="24" y="26" width="232" height="138" fill="var(--card)" stroke="currentColor" strokeWidth="2" />
        <path d="M24 48h232" stroke="currentColor" opacity=".6" />
        <path d="M36 37h6m8 0h6m8 0h6" stroke="currentColor" strokeWidth="6" />
        <path d="m43 70 15 11-15 11" stroke="currentColor" strokeWidth="5" />
        <path d="M74 81h110" stroke="currentColor" strokeWidth="5" />
        <path d="M196 73h8v17h-8z" fill="currentColor" />
        <path d="M43 111h166m-166 12h124m-124 12h145" stroke="var(--muted-foreground)" strokeWidth="3" opacity=".7" />
        <rect x="218" y="128" width="22" height="22" stroke="currentColor" />
        <path d="m224 137 4 4 7-8" stroke="currentColor" strokeWidth="2" />
        <path d="M64 174h152" stroke="currentColor" opacity=".4" />
      </g>
    </svg>
  );
}
