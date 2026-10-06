import type { ThemeStyle } from "@/lib/theme-styles";

const STYLE_PREVIEWS = {
    standard: (
      <>
        <rect width="220" height="128" fill="#f3f8f6" />
        <rect width="40" height="128" fill="#fff" />
        <circle cx="19" cy="18" r="8" fill="#237f67" />
        <path d="M12 40h16M12 54h16M12 68h16M12 82h16" stroke="#b6c8bf" strokeWidth="4" strokeLinecap="round" />
        <rect x="50" y="12" width="158" height="40" rx="10" fill="#ddf3e7" />
        <path d="M62 25h62M62 36h40" stroke="#237f67" strokeWidth="4" strokeLinecap="round" />
        <rect x="50" y="62" width="46" height="26" rx="7" fill="#fff" />
        <rect x="106" y="62" width="46" height="26" rx="7" fill="#e1f0fa" />
        <rect x="162" y="62" width="46" height="26" rx="7" fill="#fff0df" />
        <rect x="50" y="98" width="158" height="20" rx="7" fill="#fff" />
      </>
    ),
    pixel: (
      <g shapeRendering="crispEdges">
        <rect width="220" height="128" fill="#171326" />
        <path d="M0 32h220M0 64h220M0 96h220M32 0v128M64 0v128M96 0v128M128 0v128M160 0v128M192 0v128" stroke="#302440" />
        <rect x="14" y="18" width="192" height="96" fill="#090b15" />
        <rect x="10" y="14" width="192" height="96" fill="#aca0d4" stroke="#e0daf9" strokeWidth="3" />
        <rect x="10" y="14" width="192" height="14" fill="#78639c" />
        <path d="M18 21h6m4 0h6m4 0h6" stroke="#b8e8f0" strokeWidth="5" />
        <rect x="24" y="40" width="42" height="54" fill="#77659b" />
        <path d="M34 52h22M34 66h22M34 80h16" stroke="#dfd7f2" strokeWidth="4" />
        <rect x="83" y="40" width="72" height="46" fill="#25203d" stroke="#ecf4cf" strokeWidth="4" />
        <path d="M96 56h12v8h12v8h12M114 88v8M98 98h40" stroke="#8cd4ee" strokeWidth="6" />
        <path d="M180 43v18m-9-9h18M174 46h12v12h-12" stroke="#f0e9ad" strokeWidth="3" />
        <path d="M170 82h20v16h-20z" fill="#e7a6c0" />
      </g>
    ),
    playful: (
      <>
        <rect width="220" height="128" fill="#c5a4f6" />
        <path d="M0 24h220M0 48h220M0 72h220M0 96h220M24 0v128M48 0v128M72 0v128M96 0v128M120 0v128M144 0v128M168 0v128M192 0v128" stroke="#e1ccff" />
        <rect x="16" y="18" width="194" height="100" rx="11" fill="#38234d" />
        <rect x="11" y="12" width="194" height="100" rx="11" fill="#fffdf8" stroke="#38234d" strokeWidth="2" />
        <path d="M13 29h190" stroke="#38234d" strokeWidth="2" />
        <circle cx="22" cy="21" r="3" fill="#fd8cae" /><circle cx="32" cy="21" r="3" fill="#ffd84e" /><circle cx="42" cy="21" r="3" fill="#65d4b7" />
        <rect x="24" y="40" width="111" height="58" rx="16" fill="#ffdf57" stroke="#38234d" strokeWidth="2" />
        <path d="M39 55h52M39 66h38" stroke="#38234d" strokeWidth="5" strokeLinecap="round" />
        <rect x="101" y="63" width="21" height="24" rx="4" transform="rotate(14 101 63)" fill="#fff" stroke="#38234d" strokeWidth="2" />
        <rect x="146" y="40" width="46" height="25" rx="9" fill="#72d9d0" stroke="#38234d" strokeWidth="2" />
        <rect x="146" y="73" width="46" height="25" rx="9" fill="#f5a7cb" stroke="#38234d" strokeWidth="2" />
        <path d="m173 44 3-9 3 9 9 3-9 3-3 9-3-9-9-3z" fill="#ed6a9f" stroke="#38234d" strokeWidth="1.5" />
      </>
    ),
    "bento-grid": (
      <>
        <rect width="220" height="128" fill="#f5efd9" />
        <path d="M14 16h36M169 16h37" stroke="#252a21" strokeWidth="4" />
        <rect x="14" y="29" width="94" height="59" fill="#baca9f" stroke="#252a21" strokeWidth="2" />
        <path d="M24 45h60M24 56h46M24 67h54" stroke="#252a21" strokeWidth="5" />
        <rect x="108" y="29" width="44" height="59" fill="#f5df88" stroke="#252a21" strokeWidth="2" />
        <circle cx="130" cy="49" r="10" fill="none" stroke="#252a21" strokeWidth="2" />
        <path d="M125 49h1m7 0h1M126 53q4 4 8 0" stroke="#252a21" strokeWidth="1.5" />
        <rect x="152" y="29" width="54" height="59" fill="#edb7a4" stroke="#252a21" strokeWidth="2" />
        <path d="M162 45h34M162 54h26M162 63h30" stroke="#252a21" strokeWidth="3" />
        <rect x="14" y="88" width="66" height="26" fill="#f5df88" stroke="#252a21" strokeWidth="2" />
        <rect x="80" y="88" width="126" height="26" fill="#baca9f" stroke="#252a21" strokeWidth="2" />
        <path d="M24 100h32M94 100h80" stroke="#252a21" strokeWidth="3" />
      </>
    ),
    hacker: (
      <>
        <rect width="220" height="128" fill="#070c08" />
        <path d="M0 24h220" stroke="#305126" />
        <path d="M13 12h5m8 0h30M150 12h18m10 0h28" stroke="#99ed57" strokeWidth="3" />
        <rect x="14" y="38" width="192" height="55" fill="#0a140a" stroke="#3b6029" />
        <path d="M14 49h192" stroke="#3b6029" />
        <path d="M21 44h4m4 0h4m4 0h4" stroke="#99ed57" strokeWidth="3" />
        <path d="m25 61 5 4-5 4M38 65h84" stroke="#a8f16d" strokeWidth="3" />
        <path d="M25 79h119" stroke="#6a8660" strokeWidth="2" /><path d="M153 62h5v8h-5z" fill="#99ed57" />
        <rect x="14" y="103" width="58" height="13" stroke="#3b6029" /><rect x="81" y="103" width="58" height="13" stroke="#3b6029" /><rect x="148" y="103" width="58" height="13" stroke="#3b6029" />
        <path d="M24 109h22M91 109h22M158 109h22" stroke="#99ed57" strokeWidth="2" />
      </>
    ),
};

export function StylePreview({ style }: { style: ThemeStyle }) {
  return (
    <svg viewBox="0 0 220 128" className="w-full rounded-lg" aria-hidden="true" focusable="false">
      {STYLE_PREVIEWS[style]}
    </svg>
  );
}
