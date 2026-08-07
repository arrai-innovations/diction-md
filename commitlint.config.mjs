// This project uses its own commitlint rules. A consumer imports them from
// "@arrai-innovations/diction-md/commitlint" instead of by relative path.
import dictionMd, { ruleConfig } from "./src/commitlint.mjs";

export default {
    extends: ["@arrai-innovations/commitlint-config"],
    plugins: [dictionMd],
    rules: { ...ruleConfig },
};
