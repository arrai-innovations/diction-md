import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
    { ignores: ["node_modules", "coverage"] },
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2023,
            },
        },
    },
    {
        rules: {
            ...js.configs.recommended.rules,
            ...eslintConfigPrettier.rules,
            "no-console": "off",
            "space-before-function-paren": [
                "error",
                {
                    anonymous: "always",
                    named: "never",
                    asyncArrow: "always",
                },
            ],
        },
    },
];
