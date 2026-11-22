import assert from "node:assert/strict";
import test from "node:test";
import { stripeConnectUrls } from "../lib/payments.ts";

const origin = "http://localhost:3000";

test("a digital file return stays on that product editor", () => {
  const urls = stripeConnectUrls("/dashboard/products/prd_file123", origin);
  assert.equal(urls.refresh_url, `${origin}/dashboard/products/prd_file123?stripe=refresh&step=2`);
  assert.equal(urls.return_url, `${origin}/dashboard/products/prd_file123?stripe=return&step=2`);
});

test("a payment settings return stays on payment settings", () => {
  const urls = stripeConnectUrls("", origin);
  assert.equal(urls.refresh_url, `${origin}/dashboard/payments?stripe=refresh`);
  assert.equal(urls.return_url, `${origin}/dashboard/payments?stripe=return`);
});

test("an outside return path cannot leave the product editor", () => {
  for (const path of ["https://evil.test", "//evil.test", "/dashboard/payments", "/dashboard/products/../payments", "/dashboard/products/prd?stripe=return"]) {
    const urls = stripeConnectUrls(path, origin);
    assert.equal(urls.return_url, `${origin}/dashboard/payments?stripe=return`);
  }
});
