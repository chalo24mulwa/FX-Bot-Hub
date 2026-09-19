import { describe, expect, it } from "vitest";
import { isProductKey, productKeyPrefix } from "./product-keys";

describe("productKeyPrefix", () => {
  it("scopes a key to the product and upload kind", () => {
    expect(productKeyPrefix("p1", "image")).toBe("products/p1/image/");
  });
});

describe("isProductKey", () => {
  it("accepts a key under the product's own folder for that kind", () => {
    expect(isProductKey("p1", "image", "products/p1/image/abc-cover.png")).toBe(true);
  });

  it("rejects another product's key", () => {
    expect(isProductKey("p1", "image", "products/p2/image/abc-cover.png")).toBe(false);
  });

  it("rejects the right product but the wrong upload kind", () => {
    expect(isProductKey("p1", "image", "products/p1/productFile/abc.zip")).toBe(false);
  });

  it("rejects a prefix-only key with no file name", () => {
    expect(isProductKey("p1", "image", "products/p1/image/")).toBe(false);
  });

  it("rejects a product id that merely starts with the same characters", () => {
    expect(isProductKey("p1", "image", "products/p10/image/abc.png")).toBe(false);
  });

  it("rejects path-traversal segments", () => {
    expect(isProductKey("p1", "image", "products/p1/image/../../p2/image/abc.png")).toBe(false);
  });
});
