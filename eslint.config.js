import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                console: "readonly",
                document: "readonly",
                window: "readonly",
                globalThis: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                fetch: "readonly",
                alert: "readonly",
                prompt: "readonly",
                confirm: "readonly",
                io: "readonly",
                IDBKeyRange: "readonly",
                indexedDB: "readonly",
                Blob: "readonly",
                URL: "readonly",
                AbortController: "readonly",
                QRCode: "readonly"
            }
        },
        rules: {
            "complexity": ["warn", { max: 15 }],
            "no-unused-vars": "warn",
            "no-undef": "error"
        }
    }
];
