import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(new URL("../bin/diction-md.mjs", import.meta.url));
const dashFixture = fileURLToPath(
  new URL("./fixtures/dash.md", import.meta.url),
);
const bannedWordConfig = fileURLToPath(
  new URL("./fixtures/banned-word-config.json", import.meta.url),
);

function run(...args) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });
}

describe("diction-md CLI", () => {
  it("prints usage and fails without file arguments", () => {
    const { status, stderr } = run();

    assert.equal(status, 1);
    assert.match(stderr, /Usage:/);
  });

  it("rejects unknown options", () => {
    const { status, stderr } = run("--nope", dashFixture);

    assert.equal(status, 1);
    assert.match(stderr, /Unknown option: --nope/);
  });

  it("rejects --config without a path", () => {
    const { status, stderr } = run(dashFixture, "--config");

    assert.equal(status, 1);
    assert.match(stderr, /--config requires a path/);
  });

  it("reports unreadable files without a stack trace", () => {
    const { status, stderr } = run("does-not-exist.md");

    assert.equal(status, 1);
    assert.match(stderr, /does-not-exist\.md/);
    assert.ok(!stderr.includes("node:internal"));
  });

  it("stays advisory by default", () => {
    const { status, stdout } = run(dashFixture);

    assert.equal(status, 0);
    assert.match(stdout, /typography/);
  });

  it("fails on error findings with --strict", () => {
    const { status } = run("--strict", dashFixture);

    assert.equal(status, 1);
  });

  it("produces machine-readable output with --json", () => {
    const { status, stdout } = run("--json", dashFixture);
    const results = JSON.parse(stdout);

    assert.equal(status, 0);
    assert.equal(results.length, 1);
    assert.ok(
      results[0].result.findings.some(
        ({ category }) => category === "typography",
      ),
    );
  });

  it("applies option overrides from --config", () => {
    const { status, stdout } = run(
      "--strict",
      "--config",
      bannedWordConfig,
      dashFixture,
    );

    assert.equal(status, 1);
    assert.match(stdout, /banned/);
    assert.doesNotMatch(stdout, /typography/);
  });
});
