#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { lintMarkdown } from "../src/index.mjs";

const USAGE = [
    "Usage: diction-md [--json] [--strict] [--no-directives] [--config <file.json>] [<file.md> ...]",
    "       Reads standard input when given no file arguments.",
].join("\n");

// Findings need a name for the source. Angle brackets keep it from colliding
// with a path a reader might try to open.
const STDIN = "<stdin>";

function fail(message) {
    console.error(message);
    process.exit(1);
}

function formatFinding(path, finding) {
    return [
        `   ${path}:${finding.line} ${finding.severity} ${finding.category}: ${finding.message}`,
        `      ${finding.text}`,
    ].join("\n");
}

function formatReport(path, result) {
    const { metrics, findings } = result;
    const lines = [
        `\n== ${path}`,
        `   sentences: ${metrics.sentences}  words: ${metrics.words}  ` +
            `avg words/sentence: ${metrics.averageWordsPerSentence.toFixed(1)}  ` +
            `FK grade: ${metrics.fleschKincaidGrade.toFixed(1)} (target <= ${metrics.gradeTarget})`,
    ];
    lines.push(...findings.map((finding) => formatFinding(path, finding)));
    return lines.join("\n");
}

function loadConfig(path) {
    let config;
    try {
        config = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        fail(`${path}: ${error.message}`);
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        fail(`${path}: expected a JSON object of lintMarkdown options.`);
    }
    if (Array.isArray(config.wordingRules)) {
        try {
            config.wordingRules = config.wordingRules.map((rule) => ({
                ...rule,
                pattern: new RegExp(rule.pattern, rule.flags ?? "gi"),
            }));
        } catch (error) {
            fail(`${path}: ${error.message}`);
        }
    }
    return config;
}

const args = process.argv.slice(2);
const paths = [];
let strict = false;
let json = false;
let honorDirectives = true;
let options;

for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--strict") {
        strict = true;
    } else if (arg === "--json") {
        json = true;
    } else if (arg === "--no-directives") {
        honorDirectives = false;
    } else if (arg === "--config") {
        index += 1;
        if (index === args.length) {
            fail(`--config requires a path.\n${USAGE}`);
        }
        options = loadConfig(args[index]);
    } else if (arg.startsWith("-")) {
        fail(`Unknown option: ${arg}\n${USAGE}`);
    } else {
        paths.push(arg);
    }
}

// Reading a terminal would hang waiting for input that is not coming.
if (!paths.length && process.stdin.isTTY) {
    fail(USAGE);
}

function read(path) {
    try {
        return readFileSync(path === STDIN ? 0 : path, "utf8");
    } catch (error) {
        fail(`${path}: ${error.message}`);
    }
}

const sources = paths.length
    ? paths.map((path) => ({ path, source: read(path) }))
    : [{ path: STDIN, source: read(STDIN) }];

// Nothing on standard input and no files named is the same mistake as running
// the command bare, so it earns the same usage message.
if (!paths.length && !sources[0].source.trim()) {
    fail(USAGE);
}

// The flag wins over a config file that leaves directives on.
const lintOptions = { ...options, ...(honorDirectives ? {} : { honorDirectives }) };

const results = sources.map(({ path, source }) => ({ path, result: lintMarkdown(source, lintOptions) }));

if (json) {
    console.log(JSON.stringify(results, undefined, 2));
} else {
    console.log(results.map(({ path, result }) => formatReport(path, result)).join("\n"));
}

const hasErrors = results.some(({ result }) => result.findings.some((finding) => finding.severity === "error"));
if (strict && hasErrors) {
    process.exitCode = 1;
}
