# diction-md

[![npm](https://img.shields.io/npm/v/%40arrai-innovations%2Fdiction-md.svg?style=for-the-badge)](https://www.npmjs.com/package/@arrai-innovations/diction-md)
![Tests](https://docs.arrai.dev/diction-md/artifacts/main/tests.svg)
[![Coverage](https://docs.arrai.dev/diction-md/artifacts/main/tests.coverage.svg)](https://docs.arrai.dev/diction-md/artifacts/main/coverage_tests/)
![ESLint](https://docs.arrai.dev/diction-md/artifacts/main/eslint.svg)
![Prettier](https://docs.arrai.dev/diction-md/artifacts/main/prettier.svg)
![Audit](https://docs.arrai.dev/diction-md/artifacts/main/pnpm-audit.svg)
[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg?style=for-the-badge)](./LICENSE)

`diction-md` performs deterministic readability and house-style checks on
Markdown prose. It reports mechanical signals for human review. It does not
rewrite text or judge technical accuracy.

<!-- prettier-ignore-start -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Run the CLI](#run-the-cli)
- [Suppress findings](#suppress-findings)
- [Use the library](#use-the-library)
  - [`lintMarkdown(source, options)`](#lintmarkdownsource-options)
  - [`extractProseBlocks(source)`](#extractproseblockssource)
  - [`splitSentences(text)`](#splitsentencestext)
  - [`wordCount(text)`](#wordcounttext)
  - [Defaults](#defaults)
- [Check commit messages](#check-commit-messages)
- [Development](#development)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
<!-- prettier-ignore-end -->

The default rules check:

- sentence length
- Flesch-Kincaid grade
- passive-voice candidates
- long paragraphs
- marketing language
- inflated wording
- empty framing
- selected idioms
- em dashes and en dashes

The Markdown parser analyzes prose only. It excludes frontmatter, fenced and
indented code blocks, inline code, tables, thematic breaks, and reference
link definitions. It also skips `:::` container markers (a VitePress and
Docusaurus extension). It keeps paragraphs, headings (ATX and setext), and list items as
separate blocks. Headings receive wording checks but stay out of the
readability metrics.

## Run the CLI

Run it without installing it:

```console
pnpm dlx @arrai-innovations/diction-md docs/index.md
```

Or install it as a development dependency:

```console
pnpm add --save-dev @arrai-innovations/diction-md
pnpm exec diction-md docs/index.md
```

Pass multiple files or shell-expanded globs:

```console
pnpm exec diction-md docs/guide/*.md
```

The default output is advisory and exits successfully. `--strict` exits with
status 1 when the results contain an error-level finding. Among the default
rules only the dash check reports errors; wording rules opt in through
`severity`. `--json` produces machine-readable output. Unknown options and
unreadable files stop the run with status 1.

```console
pnpm exec diction-md --json docs/*.md
pnpm exec diction-md --strict docs/*.md
```

`--no-directives` ignores the inline suppression comments described below and
reports every finding in the file. Use it to audit what the directives in a
tree are hiding, or to check text where the comment syntax does not belong.

`--config <file.json>` loads option overrides from a JSON file. Patterns in
`wordingRules` are strings compiled as regular expressions with flags `gi`
unless the rule sets `flags`:

```json
{
    "hardSentenceWords": 22,
    "wordingRules": [
        {
            "category": "banned",
            "pattern": "\\bsynergy\\b",
            "message": "Name the concrete benefit.",
            "severity": "error"
        }
    ]
}
```

## Suppress findings

Directive comments suppress findings for prose you have reviewed and decided
to keep. A directive is an HTML comment on its own line. It optionally names
the finding categories it covers; a directive without categories covers every
category.

```markdown
<!-- diction-md-disable-next-line passive-voice -->

The passive sentence below the comment stays as written.

<!-- diction-md-disable marketing -->

This section quotes promotional copy verbatim.

<!-- diction-md-enable marketing -->
```

`disable-next-line` covers findings reported on the following source line.
Sentence findings report the line where the sentence starts, so place the
directive directly above that line, even inside a paragraph. `disable` covers
findings until a matching `enable`, or the end of the file when unmatched.

Category names match the `category` field of findings; unknown names have no
effect. The scanner skips directives inside code fences. Suppressed prose
still counts toward the readability metrics: suppression silences findings
without changing the document's score.

## Use the library

Install it as a dependency:

```console
pnpm add @arrai-innovations/diction-md
```

```javascript
import { lintMarkdown } from "@arrai-innovations/diction-md";

const result = lintMarkdown(markdown);
```

### `lintMarkdown(source, options)`

`lintMarkdown` accepts optional threshold and rule overrides:

```javascript
const result = lintMarkdown(markdown, {
    hardSentenceWords: 22,
    veryHardSentenceWords: 32,
    gradeTarget: 9,
    longParagraphSentences: 5,
    wordingRules: [
        {
            category: "banned",
            pattern: /\bsynergy\b/gi,
            message: "Name the concrete benefit.",
            severity: "error",
        },
    ],
});
```

`wordingRules` replaces the default rule set (exported as
`DEFAULT_WORDING_RULES`). Findings default to `warning` severity; a rule with
`severity: "error"` fails `--strict` runs.

The result contains aggregate readability metrics and a list of findings:

```javascript
{
    metrics: {
        sentences: 4,
        words: 58,
        averageWordsPerSentence: 14.5,
        fleschKincaidGrade: 8.2,
        gradeTarget: 10,
    },
    findings: [
        {
            severity: "warning",
            category: "marketing",
            line: 3,
            message: '"robust": Check that this claim is specific and supported.',
            text: "This robust helper handles the request.",
        },
    ],
}
```

### `extractProseBlocks(source)`

`extractProseBlocks` returns the Markdown prose blocks that the linter analyzes.
Each block contains:

- `kind`: `heading`, `paragraph`, or `list-item`
- `line`: the one-based source line where the block starts
- `includeInMetrics`: whether the block contributes to readability metrics
- `raw`: the source text without its Markdown block marker
- `analysis`: normalized text used by the checks
- `display`: normalized text retained for findings
- `lineOffsets`: normalized-text offsets mapped to source lines

```javascript
import { extractProseBlocks } from "@arrai-innovations/diction-md";

const blocks = extractProseBlocks(markdown);
```

### `splitSentences(text)`

`splitSentences` divides plain or normalized prose into sentence strings. It
accounts for the abbreviations recognized by the linter.

```javascript
import { splitSentences } from "@arrai-innovations/diction-md";

const sentences = splitSentences("First sentence. Second sentence?");
```

### `wordCount(text)`

`wordCount` returns the number of word tokens recognized by the readability
checks.

```javascript
import { wordCount } from "@arrai-innovations/diction-md";

const words = wordCount("A well-known helper ships 12 utilities.");
```

### Defaults

`DEFAULT_OPTIONS` contains every default threshold and setting.
`DEFAULT_WORDING_RULES` contains the default marketing, inflated-wording,
empty-framing, and idiom rules.

```javascript
import { DEFAULT_OPTIONS, DEFAULT_WORDING_RULES } from "@arrai-innovations/diction-md";
```

## Check commit messages

The `@arrai-innovations/diction-md/commitlint` entry point exports
[commitlint](https://commitlint.js.org) rules that apply the prose checks to a
commit subject and body. A project opts in; installing the package changes no
existing commitlint setup on its own.

```console
pnpm add --save-dev @arrai-innovations/diction-md
```

Add the plugin and its rule severities to `commitlint.config.mjs`:

```javascript
import dictionMd, { ruleConfig } from "@arrai-innovations/diction-md/commitlint";

export default {
    extends: ["@arrai-innovations/commitlint-config"],
    plugins: [dictionMd],
    rules: { ...ruleConfig },
};
```

A CommonJS config reaches the same rules through a dynamic import:

```javascript
module.exports = (async () => {
    const { default: dictionMd, ruleConfig } = await import("@arrai-innovations/diction-md/commitlint");
    return {
        extends: ["@arrai-innovations/commitlint-config"],
        plugins: [dictionMd],
        rules: { ...ruleConfig },
    };
})();
```

Four rules report separately, so severity matches intent:

| Rule                      | Default level | Effect            |
| ------------------------- | ------------- | ----------------- |
| `diction-subject-error`   | 2             | Fails the commit  |
| `diction-body-error`      | 2             | Fails the commit  |
| `diction-subject-warning` | 1             | Prints and passes |
| `diction-body-warning`    | 1             | Prints and passes |

Among the default checks only the dash check reports errors. A commit fails on
an em dash or en dash, and passes with advice on everything else. Act on the
advice with `git commit --amend`.

Override a level to change that. Setting `diction-body-warning` to `2` blocks
on wording; setting it to `0` silences it.

```javascript
rules: { ...ruleConfig, "diction-body-warning": [0, "always"] },
```

Pass linter options as the rule value to tune thresholds per project:

```javascript
rules: { ...ruleConfig, "diction-body-warning": [1, "always", { hardSentenceWords: 30 }] },
```

Two behaviors differ from linting a file. Git strips comment lines before
commitlint parses the message, and trailers such as `Refs:` parse as the
footer, so neither reaches these rules. Inline directives stay off, so the
`<!-- diction-md-disable -->` syntax has no meaning in a commit message.

## Development

```console
pnpm install
pnpm test
```

The runtime and test suite have no third-party dependencies. Development
tooling (ESLint, Prettier, commitlint, doctoc, and lefthook) installs through
pnpm; `pnpm install` also installs the git hooks. Commit messages follow the
Conventional Commits format enforced by commitlint.

Notable changes per release are recorded in [CHANGELOG.md](./CHANGELOG.md).

## License

Released under the [BSD 3-Clause License](./LICENSE).
