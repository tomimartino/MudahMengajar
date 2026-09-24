import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MudahMengajar",
    short_name: "MudahMengajar",
    description: "Kelola bimbel: siswa, jadwal, tagihan, dan pendapatan.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
  };
}
