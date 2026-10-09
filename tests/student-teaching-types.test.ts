import { describe, expect, it } from "vitest";
import { studentIdentitySchema, studentSchema } from "@/lib/validations/student";

const student = { full_name: "Rombel Kelas 4A", school_level: "SD", grade_level: "4", learning_mode: "offline",
  billing_type: "package", package_sessions: "4", package_per_session_rate: "75000", package_price: "300000",
  subject_ids: ["math"], status: "active", schedule_start_date: "2026-11-01" };

describe("private and group learner forms", () => {
  it("keeps existing private inputs valid without a group size", () => {
    expect(studentSchema.parse(student).teaching_type).toBe("private");
  });
  it("accepts a group without individual gender, birth date or student phone", () => {
    expect(studentSchema.parse({ ...student, teaching_type: "group", group_size: "6" }))
      .toMatchObject({ teaching_type: "group", group_size: "6", package_price: "300000" });
  });
  it.each([undefined, "", "   "])("accepts an optional empty group size %s during create and edit", (group_size) => {
    const input = { ...student, teaching_type: "group", group_size };
    expect(studentSchema.safeParse(input).success).toBe(true);
    expect(studentIdentitySchema.safeParse(input).success).toBe(true);
  });
  it.each(["0", "1", "2.5", "1001", "abc"])("rejects invalid group size %s during create and edit", (group_size) => {
    const input = { ...student, teaching_type: "group", group_size };
    expect(studentSchema.safeParse(input).success).toBe(false);
    expect(studentIdentitySchema.safeParse(input).success).toBe(false);
  });
  it("keeps identity edits separate from package and billing inputs", () => {
    const identity = studentIdentitySchema.parse({ ...student, teaching_type: "group", group_size: "8" });
    expect(identity).toMatchObject({ teaching_type: "group", group_size: "8" });
    expect(identity).not.toHaveProperty("package_sessions");
    expect(identity).not.toHaveProperty("package_price");
  });
});
