import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractProseBlocks,
  lintMarkdown,
  splitSentences,
} from "../src/index.mjs";

describe("diction-md", () => {
  it("keeps list items separate from surrounding paragraphs", () => {
    const source = `Introductory sentence:

- First item has no terminal punctuation
- Second item has no terminal punctuation

Closing sentence.`;

    const blocks = extractProseBlocks(source);

    assert.deepEqual(
      blocks.map(({ kind, analysis }) => ({ kind, analysis })),
      [
        { kind: "paragraph", analysis: "Introductory sentence:" },
        {
          kind: "list-item",
          analysis: "First item has no terminal punctuation",
        },
        {
          kind: "list-item",
          analysis: "Second item has no terminal punctuation",
        },
        { kind: "paragraph", analysis: "Closing sentence." },
      ],
    );
  });

  it("joins wrapped prose within the same Markdown block", () => {
    const source = `This sentence wraps across
two source lines.

- This list item also wraps
  across two source lines.`;

    assert.deepEqual(
      extractProseBlocks(source).map((block) => block.analysis),
      [
        "This sentence wraps across two source lines.",
        "This list item also wraps across two source lines.",
      ],
    );
  });

  it("excludes frontmatter, fenced code, tables, and container markers", () => {
    const source = `---
status: draft
---

# Heading

Visible prose.

\`\`\`javascript
const powerful = "not prose";
\`\`\`

::: warning
Important warning.
:::

| Name | Value |
| --- | --- |
`;

    assert.deepEqual(
      extractProseBlocks(source).map((block) => block.analysis),
      ["Heading", "Visible prose.", "Important warning."],
    );
  });

  it("does not merge sentences at Markdown block boundaries", () => {
    const source = `A paragraph without punctuation

A separate paragraph without punctuation`;

    const result = lintMarkdown(source);

    assert.equal(result.metrics.sentences, 2);
    assert.deepEqual(result.findings, []);
  });

  it("reports long sentences and passive-voice candidates", () => {
    const sentence =
      "The existing rows are replaced after the handler receives and validates all twenty contact records from the remote service for this particular account during synchronization.";
    const categories = lintMarkdown(sentence).findings.map(
      ({ category }) => category,
    );

    assert.ok(categories.includes("long-sentence"));
    assert.ok(categories.includes("passive-voice"));
  });

  it("shows only the applicable sentence in a sentence finding", () => {
    const source =
      "This first sentence is short. The second sentence contains enough deliberately repetitive words to cross the configured readability threshold and produce one focused diagnostic for the reader during each documentation review cycle.";
    const result = lintMarkdown(source);

    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].category, "long-sentence");
    assert.match(result.findings[0].text, /^The second sentence/);
    assert.doesNotMatch(result.findings[0].text, /first sentence/);
  });

  it("reports configured wording without inspecting inline code", () => {
    const source =
      "This powerful helper lets you `leveragePowerfully()` and leverage every available feature.";
    const findings = lintMarkdown(source).findings;

    assert.ok(findings.some(({ category }) => category === "marketing"));
    assert.equal(
      findings.filter(({ category }) => category === "inflated-wording").length,
      1,
    );
  });

  it("reports prohibited dash characters as errors", () => {
    const result = lintMarkdown(
      "Replace this clause—then describe the 1–10 range.",
    );

    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, "error");
    assert.equal(result.findings[0].category, "typography");
  });

  it("reports paragraphs with more than six sentences", () => {
    const result = lintMarkdown(
      "One thing. Two things. Three things. Four things. Five things. Six things. Seven things.",
    );

    assert.ok(
      result.findings.some(({ category }) => category === "long-paragraph"),
    );
  });

  it("keeps longer fences open across shorter fence lines", () => {
    const source = [
      "````markdown",
      "```js",
      'const hidden = "powerful";',
      "```",
      "````",
      "",
      "Visible prose.",
    ].join("\n");

    assert.deepEqual(
      extractProseBlocks(source).map((block) => block.analysis),
      ["Visible prose."],
    );
  });

  it("does not close a fence on a marker with an info string", () => {
    const source = "```\n```js\nstill code\n```\n\nAfter.";

    assert.deepEqual(
      extractProseBlocks(source).map((block) => block.analysis),
      ["After."],
    );
  });

  it("keeps intraword underscores while stripping emphasis", () => {
    assert.equal(
      extractProseBlocks("Rename foo_bar and baz_qux now.")[0].analysis,
      "Rename foo_bar and baz_qux now.",
    );
    assert.equal(
      extractProseBlocks("Use _emphasis_ and __strong__ markers.")[0].analysis,
      "Use emphasis and strong markers.",
    );
  });

  it("falls back to the whole block when display sentences do not align", () => {
    const source = `Call \`render(). Then\` again ${"and again ".repeat(20)}and again.`;
    const result = lintMarkdown(source);

    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].category, "very-long-sentence");
    assert.equal(result.findings[0].text, source);
  });

  it("treats setext headings as headings excluded from metrics", () => {
    const source = "Heading Text\n===\n\nSecond Heading\n---\n\nBody prose sentence.";
    const blocks = extractProseBlocks(source);

    assert.deepEqual(
      blocks.map(({ kind, analysis, includeInMetrics }) => ({
        kind,
        analysis,
        includeInMetrics,
      })),
      [
        { kind: "heading", analysis: "Heading Text", includeInMetrics: false },
        {
          kind: "heading",
          analysis: "Second Heading",
          includeInMetrics: false,
        },
        {
          kind: "paragraph",
          analysis: "Body prose sentence.",
          includeInMetrics: true,
        },
      ],
    );
    assert.equal(lintMarkdown(source).metrics.sentences, 1);
  });

  it("skips thematic breaks", () => {
    const source = "First paragraph.\n\n---\n\n* * *\n\n___\n\nSecond paragraph.";

    assert.deepEqual(
      extractProseBlocks(source).map((block) => block.analysis),
      ["First paragraph.", "Second paragraph."],
    );
  });

  it("skips indented code blocks after paragraphs", () => {
    const source = "Intro paragraph.\n\n    const powerful = 1;\n\nAfter paragraph.";

    assert.deepEqual(
      extractProseBlocks(source).map((block) => block.analysis),
      ["Intro paragraph.", "After paragraph."],
    );
  });

  it("keeps indented continuations after list items", () => {
    const source = "- List item text\n\n    Continuation prose for the item.";

    assert.deepEqual(
      extractProseBlocks(source).map(({ kind, analysis }) => ({
        kind,
        analysis,
      })),
      [
        { kind: "list-item", analysis: "List item text" },
        { kind: "paragraph", analysis: "Continuation prose for the item." },
      ],
    );
  });

  it("skips reference link definitions and collapses reference links", () => {
    const source =
      'Read the [guide][g] first.\n\n[g]: https://example.com/a—b "Title—here"';
    const result = lintMarkdown(source);

    assert.deepEqual(
      extractProseBlocks(source).map((block) => block.analysis),
      ["Read the guide first."],
    );
    assert.deepEqual(result.findings, []);
  });

  it("skips tables without leading pipes", () => {
    const source = "Intro.\n\nName | Powerful Value\n--- | ---\nfoo | 1\n\nAfter.";

    assert.deepEqual(
      extractProseBlocks(source).map((block) => block.analysis),
      ["Intro.", "After."],
    );
  });

  it("does not split sentences after common abbreviations", () => {
    assert.deepEqual(
      splitSentences(
        "Use a helper, e.g. React, when needed. Compare it vs. Vue next.",
      ),
      [
        "Use a helper, e.g. React, when needed.",
        "Compare it vs. Vue next.",
      ],
    );
  });

  it("counts words consistently between checks and metrics", () => {
    const result = lintMarkdown("A well-known helper ships 12 utilities.");

    assert.equal(result.metrics.words, 6);
    assert.equal(result.metrics.averageWordsPerSentence, 6);
  });

  it("attributes findings to the source line within a block", () => {
    const source =
      "First line stays fine here.\nThe cache was cleared by a powerful runtime.";
    const findings = lintMarkdown(source).findings;
    const passive = findings.find(({ category }) => category === "passive-voice");
    const marketing = findings.find(({ category }) => category === "marketing");

    assert.equal(passive.line, 2);
    assert.equal(marketing.line, 2);
  });

  it("does not expose internal accumulator state on blocks", () => {
    const blocks = extractProseBlocks("One paragraph.\n\n- One item.");

    assert.ok(blocks.every((block) => !("parts" in block)));
  });

  it("honors wording rule severity", () => {
    const result = lintMarkdown("Do not say foobar here.", {
      wordingRules: [
        {
          category: "banned",
          pattern: /\bfoobar\b/g,
          message: "Do not.",
          severity: "error",
        },
      ],
    });

    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, "error");
  });

  it("splits ordinary prose sentences", () => {
    assert.deepEqual(
      splitSentences("First sentence. Second sentence? Third sentence!"),
      ["First sentence.", "Second sentence?", "Third sentence!"],
    );
  });

  it("accepts threshold and rule overrides", () => {
    const result = lintMarkdown("This sentence has five simple words.", {
      hardSentenceWords: 5,
      veryHardSentenceWords: 6,
      wordingRules: [],
      prohibitDashes: false,
    });

    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].category, "very-long-sentence");
  });
});
