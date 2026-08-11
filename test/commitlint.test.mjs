import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ruleConfig, rules } from "../src/commitlint.mjs";

function parsed(overrides) {
    return { subject: undefined, body: undefined, footer: undefined, ...overrides };
}

describe("diction-md commitlint rules", () => {
    it("passes a commit with clean prose", () => {
        const [ok] = rules["diction-body-error"](
            parsed({ body: "Directives are HTML comments on their own line." }),
            "always",
        );

        assert.equal(ok, true);
    });

    it("reports a dash in the body as an error", () => {
        const [ok, message] = rules["diction-body-error"](
            parsed({ body: "The parser mis-split sentences — abbreviations broke it." }),
            "always",
        );

        assert.equal(ok, false);
        assert.match(message, /typography/);
    });

    it("keeps wording findings out of the error rule", () => {
        const message = parsed({ body: "This utilizes the new API." });

        assert.equal(rules["diction-body-error"](message, "always")[0], true);
        assert.equal(rules["diction-body-warning"](message, "always")[0], false);
    });

    it("checks the subject independently of the body", () => {
        const [ok, message] = rules["diction-subject-warning"](
            parsed({ subject: "leverage the new parser", body: "Clean body prose." }),
            "always",
        );

        assert.equal(ok, false);
        assert.match(message, /commit subject/);
        assert.match(message, /leverage/);
    });

    it("passes when a field is absent or blank", () => {
        assert.equal(rules["diction-body-error"](parsed({}), "always")[0], true);
        assert.equal(rules["diction-body-warning"](parsed({ body: "   " }), "always")[0], true);
    });

    it("does not honor inline directives in a commit message", () => {
        const body = `<!-- diction-md-disable typography -->
This clause—wait for it—uses em dashes.`;

        assert.equal(rules["diction-body-error"](parsed({ body }), "always")[0], false);
    });

    it("accepts linter option overrides as the rule value", () => {
        const body = parsed({ body: "This clause—here." });

        assert.equal(rules["diction-body-error"](body, "always", { prohibitDashes: false })[0], true);
    });

    it("exports a severity for every rule", () => {
        assert.deepEqual(Object.keys(ruleConfig).sort(), Object.keys(rules).sort());
        assert.deepEqual(
            Object.entries(ruleConfig)
                .filter(([name]) => name.endsWith("-error"))
                .map(([, [level]]) => level),
            [2, 2],
        );
    });
});
