import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "@/lib/utils/push";

describe("urlBase64ToUint8Array", () => {
  it("mengonversi string base64url menjadi Uint8Array", () => {
    expect(urlBase64ToUint8Array("AQID")).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("menangani padding yang hilang", () => {
    expect(urlBase64ToUint8Array("AQIDBA")).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("mendukung karakter base64url - dan _", () => {
    expect(urlBase64ToUint8Array("-_8=")).toEqual(new Uint8Array([251, 255]));
  });

  it("mengonversi kunci VAPID publik 65 byte tanpa error", () => {
    const key =
      "BNWYBVKIbOTOvSZ-Sk5WYjAtEmPyhyq6axC4aMKg0IFHiPwWSrqDlx7j1sLnOkvdRmVGXiETpbePq_f2b6nDIDw";
    expect(urlBase64ToUint8Array(key).length).toBe(65);
  });
});
