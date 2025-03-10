import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Apply settings to JavaScript files
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Disable 'prefer-class' rule for JavaScript files
      "prefer-class": "off",  // Add the rule you want to disable here
      // Optionally, disable 'class-methods-use-this' rule
      "class-methods-use-this": "off",
    },
  },
  
  // Include recommended settings
  pluginJs.configs.recommended,
];

