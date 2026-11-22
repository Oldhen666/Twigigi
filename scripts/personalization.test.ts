import assert from "node:assert/strict";
import test from "node:test";
import {
  addProof,
  answerFromBuyer,
  decideProof,
  emptySnapshot,
  legacyUploadPersonalization,
  personalizationFromSeller,
  personalizationSummary,
  readPersonalization,
  type PersonalizationConfig,
} from "../lib/personalization.ts";

const shirt: PersonalizationConfig = {
  enabled: true,
  proof: false,
  fields: [
    { id: "name", kind: "text", label: "Name to embroider", help: "", required: true, maxLength: 16 },
    { id: "logo", kind: "file", label: "Logo", help: "", required: true, maxFiles: 1 },
    { id: "place", kind: "choice", label: "Logo placement", help: "", required: true, options: ["Left chest", "Center chest"] },
    { id: "note", kind: "note", label: "Anything else we should know?", help: "", required: false },
  ],
};

test("an existing image upload stays required before the seller saves the new editor", () => {
  const config = readPersonalization("", true);
  assert.deepEqual(config, legacyUploadPersonalization());
  assert.equal(config.fields[0]?.kind, "file");
  assert.equal(config.fields[0]?.required, true);
});

test("a plain product collects nothing", () => {
  const config = readPersonalization("", false);
  assert.equal(config.enabled, false);
  assert.equal(config.fields.length, 0);
});

test("buyer answers keep the labels from the moment of the order", () => {
  const saved = answerFromBuyer(shirt, { name: "Emma", place: "Left chest", note: "" }, { logo: [{ path: "/uploads/logo.png", name: "logo.png" }] });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const summary = personalizationSummary("Black · Size M", saved.answers);
  assert.equal(summary.line, "Black · Size M · Emma · Left chest");
  assert.deepEqual(summary.files, [{ label: "Logo", name: "logo.png" }]);
});

test("missing text, a choice outside the list, and a missing file are rejected", () => {
  const missing = answerFromBuyer(shirt, { name: "", place: "Sleeve", note: "Keep the collar plain" }, { logo: [] });
  assert.equal(missing.ok, false);
  if (missing.ok) return;
  assert.match(missing.errors.name, /Name to embroider/);
  assert.match(missing.errors.place, /Logo placement/);
  assert.match(missing.errors.logo, /Logo/);
});

test("a later product edit does not change the stored answer labels", () => {
  const first = answerFromBuyer(shirt, { name: "Emma", place: "Left chest", note: "" }, { logo: [{ path: "/uploads/logo.png", name: "logo.png" }] });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const snapshot = emptySnapshot(shirt, first.answers);
  const edited = personalizationFromSeller(JSON.stringify({ ...shirt, fields: shirt.fields.map((field) => field.kind === "text" ? { ...field, label: "Player number" } : field) }));
  assert.equal(edited.ok, true);
  assert.equal(snapshot.answers[0]?.label, "Name to embroider");
});

test("the buyer can decide only the current proof", () => {
  const start = emptySnapshot({ ...shirt, proof: true }, []);
  const first = addProof(start, { id: "one", note: "First", files: [], createdAt: "", current: true });
  const second = addProof(first, { id: "two", note: "Second", files: [], createdAt: "", current: true });
  assert.equal(second.proofs.filter((proof) => proof.current).length, 1);
  const decision = decideProof(second, "changes", "Move the logo");
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.equal(decision.snapshot.decisionProofId, "two");
  assert.equal(decision.snapshot.proofs[0]?.current, false);
});
