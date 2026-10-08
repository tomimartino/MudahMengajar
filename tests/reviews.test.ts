import { beforeEach, describe, expect, it, vi } from "vitest";
import { reviewSchema } from "@/lib/validations/review";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), getUser: vi.fn(), from: vi.fn(), upsert: vi.fn(),
  select: vi.fn(), single: vi.fn(), remove: vi.fn(), eq: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveReviewAction, deleteReviewAction } from "@/lib/actions/reviews";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: mocks.from });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "current-user" } } });
  mocks.from.mockReturnValue({ upsert: mocks.upsert, delete: mocks.remove });
  mocks.upsert.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ single: mocks.single });
  mocks.single.mockResolvedValue({ data: { user_id: "current-user", rating: 4, comment: "Website membantu mengajar." }, error: null });
  mocks.remove.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
});

describe("review pribadi", () => {
  it.each([0, 6, 1.5, "5"])("menolak rating tidak valid %s", (rating) => {
    expect(reviewSchema.safeParse({ rating, comment: "Website membantu mengajar." }).success).toBe(false);
  });
  it("menolak komentar kosong dan terlalu panjang", () => {
    for (const comment of ["           ", "singkat", "a".repeat(2001)]) {
      expect(reviewSchema.safeParse({ rating: 5, comment }).success).toBe(false);
    }
  });
  it("mengambil kepemilikan dari sesi, memangkas komentar, dan memperbarui review yang sama", async () => {
    const result = await saveReviewAction({ rating: 4, comment: "  Website membantu mengajar.  ", user_id: "other-user" });
    expect(result.ok).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "current-user", rating: 4, comment: "Website membantu mengajar." }, { onConflict: "user_id" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/settings");
  });
  it("menolak pengiriman tanpa autentikasi", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await saveReviewAction({ rating: 5, comment: "Website membantu mengajar." })).ok).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("tidak menampilkan sukses jika penyimpanan gagal", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    expect((await saveReviewAction({ rating: 5, comment: "Website membantu mengajar." })).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("hanya menghapus review milik akun yang sedang masuk", async () => {
    expect((await deleteReviewAction()).ok).toBe(true);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "current-user");
  });
  it("tidak menghapus review tanpa autentikasi", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await deleteReviewAction()).ok).toBe(false);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
