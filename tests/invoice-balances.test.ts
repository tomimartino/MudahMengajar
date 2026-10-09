import { expect, it } from "vitest";
import { invoiceBalances } from "@/lib/finance/data";

it("subtracts all invoice payments while keeping unrelated payments separate", () => {
  const result = invoiceBalances([{ id: "a", amount: "200000" }, { id: "b", amount: "100000" }], [
    { invoice_id: "a", amount: "50000" }, { invoice_id: "a", amount: "25000" },
    { invoice_id: null, amount: "900000" }, { invoice_id: "b", amount: "120000" },
  ]);
  expect([...result]).toEqual([["a", 125000], ["b", 0]]);
});
