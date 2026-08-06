const PASSIVE =
    /\b(?:am|is|are|was|were|be|been|being)\s+(?:\w+ed|shown|given|done|known|made|run|set|kept|left|built|written|read|passed|found|taken)\b/gi;

const WORD_PATTERN = /[A-Za-z0-9][A-Za-z0-9'’/-]*/g;

// A sentence can open with an inline code span, which reads as a lowercase
// start: the token "code" in analysis text, a backtick in display text. Both
// join the sentence-case starts the boundary already accepts.
const SENTENCE_START = String.raw`["'(]?(?:[A-Z0-9]|\x60|code\b)`;

const SENTENCE_BOUNDARY = new RegExp(
    String.raw`(?<=[.!?])(?<!\b(?:[eE]\.g|[iI]\.e|[vV]s|[cC]f)\.)\s+(?=${SENTENCE_START})`,
    "g",
);

const TABLE_DELIMITER = /^\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/;

export const DEFAULT_WORDING_RULES = [
    {
        category: "marketing",
        pattern:
            /\b(?:seamless(?:ly)?|robust|powerful|cutting-edge|effortless(?:ly)?|world-class|next-generation|revolutionary|blazing|lightning-fast|elegant|delightful|turnkey|best-in-class|state-of-the-art|game-changing|first-class|battle-tested|enterprise-grade|supercharge|unlock|unleash|empower(?:s)?)\b/gi,
        message: "Check that this claim is specific and supported.",
    },
    {
        category: "inflated-wording",
        pattern: /\butiliz(?:e|es|ed|ing)\b/gi,
        message: 'Prefer a form of "use" when it has the same meaning.',
    },
    {
        category: "inflated-wording",
        pattern: /\bleverag(?:e|es|ed|ing)\b/gi,
        message: 'Prefer "use" or name the concrete action.',
    },
    {
        category: "inflated-wording",
        pattern: /\bfacilitat(?:e|es|ed|ing)\b/gi,
        message: 'Consider "help", "let", or the concrete action.',
    },
    {
        category: "inflated-wording",
        pattern: /\bprior to\b/gi,
        message: 'Prefer "before".',
    },
    {
        category: "inflated-wording",
        pattern: /\bsubsequent to\b/gi,
        message: 'Prefer "after".',
    },
    {
        category: "inflated-wording",
        pattern: /\bin order to\b/gi,
        message: 'Prefer "to".',
    },
    {
        category: "inflated-wording",
        pattern: /\bdue to the fact that\b/gi,
        message: 'Prefer "because".',
    },
    {
        category: "empty-framing",
        pattern:
            /\b(?:it is important to note|it should be noted|it is worth noting|please note that|as mentioned|as noted above)\b/gi,
        message: "State the information directly.",
    },
    {
        category: "idiom",
        pattern: /\b(?:reach for|dive into|kick off|circle back|drill down|by a beat)\b/gi,
        message: "Consider literal wording for readers who use English as an additional language.",
    },
];

export const DEFAULT_OPTIONS = {
    hardSentenceWords: 25,
    veryHardSentenceWords: 35,
    gradeTarget: 10,
    longParagraphSentences: 6,
    wordingRules: DEFAULT_WORDING_RULES,
    prohibitDashes: true,
};

function normalizeInlineMarkdown(text, renderCode) {
    const codeSpans = [];
    // Code spans hold out of every pass below. Their content is literal, so a
    // `<tag>` or a trailing `*` inside one must not read as HTML or emphasis.
    // NUL cannot appear in Markdown source, so it delimits the placeholders.
    const guarded = text
        .replace(/\0/g, "")
        .replace(/`([^`\n]*)`/g, (match, content) => `\0${codeSpans.push(content) - 1}\0`);

    return guarded
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/!\[[^\]]*\]\[[^\]]*\]/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
        .replace(/<[^>\n]+>/g, "")
        .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, "$1")
        .replace(/(?<![A-Za-z0-9])_{1,2}([^_\n]+)_{1,2}(?![A-Za-z0-9])/g, "$1")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\0(\d+)\0/g, (match, index) => renderCode(codeSpans[index]));
}

function analysisInlineMarkdown(text) {
    return normalizeInlineMarkdown(text, () => "code");
}

function displayInlineMarkdown(text) {
    return normalizeInlineMarkdown(text, (content) => `\`${content}\``);
}

function buildLineOffsets(parts, analysis) {
    const offsets = [];
    let joined = "";
    for (const part of parts) {
        const normalized = analysisInlineMarkdown(part.text);
        if (!normalized) {
            continue;
        }
        if (joined) {
            joined += " ";
        }
        offsets.push({ offset: joined.length, line: part.line });
        joined += normalized;
    }
    // Inline spans that cross source lines normalize differently per line;
    // attribute the whole block to its first contributing line in that case.
    if (joined !== analysis) {
        return [{ offset: 0, line: offsets[0]?.line ?? parts[0].line }];
    }
    return offsets;
}

function lineAt(block, offset) {
    let line = block.line;
    for (const entry of block.lineOffsets) {
        if (entry.offset > offset) {
            break;
        }
        line = entry.line;
    }
    return line;
}

export function extractProseBlocks(source) {
    const lines = source.split(/\r?\n/);
    const blocks = [];
    let block;
    let fence;
    let inTable = false;
    let previousKind;
    let inFrontmatter = lines[0]?.trim() === "---";

    function flush() {
        if (!block) {
            return;
        }
        previousKind = block.kind;
        const raw = block.parts.map((part) => part.text).join("\n");
        const analysis = analysisInlineMarkdown(raw);
        if (analysis) {
            const lineOffsets = buildLineOffsets(block.parts, analysis);
            blocks.push({
                kind: block.kind,
                // A block can open with lines that normalize to nothing (an HTML
                // comment, an image); findings belong to the first prose line.
                line: lineOffsets[0].line,
                includeInMetrics: block.includeInMetrics,
                raw,
                analysis,
                display: displayInlineMarkdown(raw),
                lineOffsets,
            });
        }
        block = undefined;
    }

    function start(kind, text, line, includeInMetrics = true) {
        flush();
        block = { kind, line, includeInMetrics, parts: [{ text, line }] };
    }

    for (const [index, originalLine] of lines.entries()) {
        const lineNumber = index + 1;
        const trimmed = originalLine.trim();

        if (inFrontmatter) {
            if (index > 0 && trimmed === "---") {
                inFrontmatter = false;
            }
            continue;
        }

        const fenceMatch = originalLine.match(/^\s*(`{3,}|~{3,})(.*)$/);
        if (fence) {
            // A closing fence uses the same character, is at least as long as the
            // opening fence, and carries no info string.
            if (
                fenceMatch &&
                fenceMatch[1][0] === fence[0] &&
                fenceMatch[1].length >= fence.length &&
                !fenceMatch[2].trim()
            ) {
                fence = undefined;
            }
            continue;
        }
        if (fenceMatch) {
            flush();
            fence = fenceMatch[1];
            continue;
        }

        if (!trimmed) {
            inTable = false;
            flush();
            continue;
        }
        if (inTable) {
            continue;
        }
        if (/^:{3,}/.test(trimmed)) {
            flush();
            continue;
        }
        if (
            trimmed.startsWith("|") ||
            (trimmed.includes("|") && TABLE_DELIMITER.test((lines[index + 1] ?? "").trim()))
        ) {
            flush();
            inTable = true;
            continue;
        }

        if (/^\s{0,3}(=+|-+)\s*$/.test(originalLine)) {
            if (block?.kind === "paragraph") {
                block.kind = "heading";
                block.includeInMetrics = false;
            }
            flush();
            continue;
        }
        if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(originalLine)) {
            flush();
            continue;
        }

        const heading = originalLine.match(/^\s*#{1,6}\s+(.*)$/);
        if (heading) {
            start("heading", heading[1], lineNumber, false);
            flush();
            continue;
        }

        const listItem = originalLine.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
        if (listItem) {
            start("list-item", listItem[1], lineNumber);
            continue;
        }

        if (!block) {
            // Indented code blocks, except that indentation directly after a list
            // item is a continuation paragraph, not code.
            if (/^(?: {4}|\t)/.test(originalLine) && previousKind !== "list-item") {
                continue;
            }
            if (/^\s{0,3}\[(?!\^)[^\]]+\]:\s*\S/.test(originalLine)) {
                continue;
            }
        }

        const text = originalLine.replace(/^\s*>\s?/, "");
        if (block?.kind === "list-item" && !/^\s+/.test(originalLine)) {
            start("paragraph", text, lineNumber);
        } else if (block) {
            block.parts.push({ text, line: lineNumber });
        } else {
            start("paragraph", text, lineNumber);
        }
    }
    flush();

    return blocks;
}

function splitSentencesWithOffsets(text) {
    const spans = [];
    let start = 0;
    for (const boundary of text.matchAll(SENTENCE_BOUNDARY)) {
        spans.push({ start, end: boundary.index });
        start = boundary.index + boundary[0].length;
    }
    spans.push({ start, end: text.length });

    const sentences = [];
    for (const span of spans) {
        const raw = text.slice(span.start, span.end);
        const sentence = raw.trim();
        if (wordCount(sentence)) {
            sentences.push({
                text: sentence,
                offset: span.start + (raw.length - raw.trimStart().length),
            });
        }
    }
    return sentences;
}

export function splitSentences(text) {
    return splitSentencesWithOffsets(text).map((sentence) => sentence.text);
}

export function wordCount(text) {
    return (text.match(WORD_PATTERN) || []).length;
}

function syllables(word) {
    const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!normalized) {
        // Tokens without letters (numbers) still read as at least one syllable.
        return 1;
    }
    const groups = normalized.match(/[aeiouy]+/g) || [];
    let count = groups.length;
    if (normalized.endsWith("e") && !normalized.endsWith("le") && count > 1) {
        count -= 1;
    }
    return Math.max(1, count);
}

function allMatches(text, pattern) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    return [...text.matchAll(new RegExp(pattern.source, flags))];
}

export function lintMarkdown(source, optionOverrides = {}) {
    const options = { ...DEFAULT_OPTIONS, ...optionOverrides };
    const blocks = extractProseBlocks(source);
    const findings = [];
    const sentences = [];

    for (const block of blocks) {
        const blockSentences = splitSentencesWithOffsets(block.analysis);
        const displaySentences = splitSentences(block.display);
        // Inline code can contain sentence punctuation, so the display text may
        // split differently than the analysis text.
        const aligned = displaySentences.length === blockSentences.length;

        if (block.includeInMetrics) {
            for (const [index, sentence] of blockSentences.entries()) {
                const words = wordCount(sentence.text);
                const displaySentence = aligned ? displaySentences[index] : block.display;
                const line = lineAt(block, sentence.offset);
                sentences.push(sentence.text);
                if (words >= options.hardSentenceWords) {
                    findings.push({
                        severity: "warning",
                        category: words >= options.veryHardSentenceWords ? "very-long-sentence" : "long-sentence",
                        line,
                        message: `${words} words. Target fewer than ${options.hardSentenceWords}.`,
                        text: displaySentence,
                    });
                }

                const passiveMatches = allMatches(sentence.text, PASSIVE);
                if (passiveMatches.length) {
                    findings.push({
                        severity: "warning",
                        category: "passive-voice",
                        line,
                        message: `Check passive-voice candidate: ${[
                            ...new Set(passiveMatches.map((match) => `"${match[0]}"`)),
                        ].join(", ")}.`,
                        text: displaySentence,
                    });
                }
            }

            if (block.kind === "paragraph" && blockSentences.length > options.longParagraphSentences) {
                findings.push({
                    severity: "warning",
                    category: "long-paragraph",
                    line: block.line,
                    message: `${blockSentences.length} sentences. Target ${options.longParagraphSentences} or fewer.`,
                    text: block.display,
                });
            }
        }

        if (options.prohibitDashes) {
            const dashes = allMatches(block.analysis, /[—–]/g);
            if (dashes.length) {
                findings.push({
                    severity: "error",
                    category: "typography",
                    line: lineAt(block, dashes[0].index),
                    message: "Replace em dashes and en dashes with other punctuation or wording.",
                    text: block.display,
                });
            }
        }

        for (const rule of options.wordingRules) {
            for (const match of allMatches(block.analysis, rule.pattern)) {
                findings.push({
                    severity: rule.severity || "warning",
                    category: rule.category,
                    line: lineAt(block, match.index),
                    message: `"${match[0]}": ${rule.message}`,
                    text: block.display,
                });
            }
        }
    }

    const words = sentences.flatMap((sentence) => sentence.match(WORD_PATTERN) || []);
    const syllableCount = words.reduce((total, word) => total + syllables(word), 0);
    const grade =
        sentences.length && words.length
            ? 0.39 * (words.length / sentences.length) + 11.8 * (syllableCount / words.length) - 15.59
            : 0;

    return {
        metrics: {
            sentences: sentences.length,
            words: words.length,
            averageWordsPerSentence: words.length / (sentences.length || 1),
            fleschKincaidGrade: grade,
            gradeTarget: options.gradeTarget,
        },
        findings,
    };
}
