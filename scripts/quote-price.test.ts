import assert from "node:assert/strict";
import test from "node:test";
import { listingPrice, quotePriceFromForm, quotePriceFromProduct, quotePriceLabel } from "../lib/quote-price.ts";

const base = { amountCents: null, maxCents: null, unit: "project" as const, unitName: "", currency: "CAD" };

test("buyer-facing quote prices use one formatter", () => {
  assert.equal(quotePriceLabel({ ...base, mode: "custom" }), "Pricing varies by project");
  assert.equal(
    quotePriceLabel({ ...base, mode: "starting", amountCents: 800, unit: "sqft" }),
    "Starting at $8 CAD per sq ft",
  );
  assert.equal(
    quotePriceLabel({ ...base, mode: "range", amountCents: 800, maxCents: 1200, unit: "sqft" }),
    "$8–$12 CAD per sq ft",
  );
  assert.equal(
    quotePriceLabel({ ...base, mode: "set", amountCents: 9500, unit: "hour" }),
    "$95 CAD per hour",
  );
  assert.equal(
    quotePriceLabel({ ...base, mode: "set", amountCents: 150000, unit: "project" }),
    "$1,500 CAD per project",
  );
  assert.equal(
    quotePriceLabel({ ...base, mode: "starting", amountCents: 800, unit: "custom", unitName: "linear ft" }),
    "Starting at $8 CAD per linear ft",
  );
  assert.equal(
    quotePriceLabel({ ...base, mode: "set", amountCents: 850, unit: "hour", currency: "USD" }),
    "$8.50 USD per hour",
  );
});

test("an existing starting price stays per project and a blank price becomes a custom quote", () => {
  const priced = quotePriceFromProduct({ priceCents: 123400, currency: "CAD", quotePriceMode: "" });
  assert.equal(priced.mode, "starting");
  assert.equal(priced.unit, "project");
  assert.equal(priced.amountCents, 123400);
  assert.equal(quotePriceLabel(priced), "Starting at $1,234 CAD per project");
  const blank = quotePriceFromProduct({ priceCents: null, currency: "USD" });
  assert.equal(blank.mode, "custom");
  assert.equal(blank.currency, "USD");
  assert.equal(listingPrice({ cta: "buy", priceCents: 500, currency: "CAD" }), "$5.00 CAD");
});

test("only the selected price option is saved, and a range must increase", () => {
  const custom = new FormData();
  custom.set("quotePriceMode", "custom");
  custom.set("quotePriceAmount", "95");
  custom.set("quotePriceUnit", "hour");
  const hidden = quotePriceFromForm(custom, "CAD", true);
  assert.equal(hidden.price.mode, "custom");
  assert.equal(hidden.price.amountCents, null);
  assert.equal(hidden.price.unit, "project");
  assert.deepEqual(hidden.errors, {});

  const range = new FormData();
  range.set("quotePriceMode", "range");
  range.set("quotePriceMin", "12");
  range.set("quotePriceMax", "8");
  range.set("quotePriceUnit", "sqft");
  const backwards = quotePriceFromForm(range, "CAD", true);
  assert.equal(backwards.errors.quotePriceMax, "Enter a maximum greater than the minimum.");

  const named = new FormData();
  named.set("quotePriceMode", "set");
  named.set("quotePriceAmount", "95");
  named.set("quotePriceUnit", "custom");
  const missing = quotePriceFromForm(named, "CAD", true);
  assert.equal(missing.errors.quotePriceUnitName, "Enter a unit name.");

  const draft = new FormData();
  draft.set("quotePriceMode", "starting");
  draft.set("quotePriceUnit", "visit");
  const empty = quotePriceFromForm(draft, "CAD", false);
  assert.equal(empty.price.mode, "starting");
  assert.equal(empty.price.amountCents, null);
  assert.deepEqual(empty.errors, {});
  assert.equal(quotePriceLabel(empty.price), "Pricing varies by project");
});
