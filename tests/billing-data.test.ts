import { describe, expect, it, vi } from "vitest";
import { loadBillingLedger } from "@/lib/finance/data";

function fixtureClient(failTable?: string) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const from = vi.fn((table: string) => {
    let offset = 0;
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "range"]) {
      query[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        if (method === "range") offset = args[0] as number;
        return query;
      };
    }
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(
      failTable === table ? { data: null, error: { message: "unavailable" } }
        : { data: Array.from({ length: offset === 0 ? 500 : 1 }, (_, i) => ({ id: `${table}-${offset + i}` })), error: null }
    ).then(resolve);
    return query;
  });
  return { client: { from } as unknown as Parameters<typeof loadBillingLedger>[0], calls };
}

describe("complete teacher billing ledger", () => {
  it("reads beyond the API row limit and scopes every request to its teacher", async () => {
    const { client, calls } = fixtureClient();
    const ledger = await loadBillingLedger(client, "teacher-qa");
    expect(ledger.invoices).toHaveLength(501);
    expect(ledger.payments).toHaveLength(501);
    for (const table of ["invoices", "payments"]) {
      expect(calls.filter((c) => c.table === table && c.method === "eq")).toEqual([
        { table, method: "eq", args: ["user_id", "teacher-qa"] },
        { table, method: "eq", args: ["user_id", "teacher-qa"] },
      ]);
      expect(calls).toContainEqual({ table, method: "range", args: [500, 999] });
    }
  });

  it.each(["invoices", "payments"])("rejects %s query failure instead of showing misleading zero totals", async (table) => {
    const { client } = fixtureClient(table);
    await expect(loadBillingLedger(client, "teacher-qa")).rejects.toThrow("Silakan coba lagi.");
  });
});
