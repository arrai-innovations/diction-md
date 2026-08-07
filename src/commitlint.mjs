import { lintMarkdown } from "./index.mjs";

// Commit messages get the same prose checks as Markdown files, with two
// differences. Inline directives stay off, so the HTML comment syntax carries
// no meaning in a commit message and nobody has a reason to write one. And
// findings split by severity across two rules, so a project can block on
// errors while warnings stay advisory. An advisory finding needs no suppression
// mechanism: the commit lands, and `git commit --amend` acts on it.
const LINT_OPTIONS = { honorDirectives: false };

function findingsFor(text, keep, options) {
    if (!text || !text.trim()) {
        return [];
    }
    return lintMarkdown(text, { ...options, ...LINT_OPTIONS }).findings.filter(keep);
}

function report(field, findings) {
    const lines = findings.map((finding) => `${finding.category}: ${finding.message}`);
    return [findings.length === 0, `commit ${field}:\n${lines.join("\n")}`];
}

const isError = (finding) => finding.severity === "error";
const isWarning = (finding) => finding.severity !== "error";

function rule(field, keep) {
    return (parsed, when, value) => report(field, findingsFor(parsed[field], keep, value));
}

export const rules = {
    "diction-subject-error": rule("subject", isError),
    "diction-subject-warning": rule("subject", isWarning),
    "diction-body-error": rule("body", isError),
    "diction-body-warning": rule("body", isWarning),
};

// Spread into a commitlint config's own `rules` to get the intended severities:
// errors fail the commit, warnings print and pass.
export const ruleConfig = {
    "diction-subject-error": [2, "always"],
    "diction-subject-warning": [1, "always"],
    "diction-body-error": [2, "always"],
    "diction-body-warning": [1, "always"],
};

export default { rules };
