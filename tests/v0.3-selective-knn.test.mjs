import test from "node:test";
import assert from "node:assert/strict";
import { SelectiveKnn, tokenJaccard, pointAtOrAboveCoverage } from "../dist/index.js";

test("token Jaccard is deterministic and bounded", () => {
  assert.equal(tokenJaccard("find longest file", "find longest file"), 1);
  assert.equal(tokenJaccard("find longest file", "unrelated words"), 0);
  assert.ok(tokenJaccard("find longest file", "find shortest file") > 0);
});

test("selective kNN abstains below threshold instead of forced guessing", () => {
  const knn = new SelectiveKnn([
    { surface: "find the longest filename", value: "LONGEST" },
    { surface: "add two", value: "ADD2" },
  ]);
  assert.equal(knn.predict("completely unrelated request", 0.5), undefined);
  assert.equal(knn.predict("find the longest file name", 0.5)?.value, "LONGEST");
});

test("selective kNN rejects invalid thresholds", () => {
  const knn = new SelectiveKnn([]);
  assert.throws(() => knn.predict("x", -0.01), /\[0,1\]/);
  assert.throws(() => knn.predict("x", 1.01), /\[0,1\]/);
});

test("risk/coverage curve includes a fair abstention operating point", () => {
  const knn = new SelectiveKnn([
    { surface: "alpha beta", value: "A" },
    { surface: "gamma delta", value: "B" },
  ]);
  const curve = knn.curve([
    { surface: "alpha beta", correct: value => value === "A" },
    { surface: "alpha", correct: value => value === "A" },
    { surface: "alpha gamma", correct: value => value === "B" },
  ]);
  assert.equal(curve[0].coverage, 0);
  const partial = pointAtOrAboveCoverage(curve, 1 / 3);
  assert.equal(partial.coverage, 1 / 3);
  assert.equal(partial.risk, 0);
  const full = pointAtOrAboveCoverage(curve, 1);
  assert.equal(full.coverage, 1);
  assert.ok(full.risk > 0);
});
