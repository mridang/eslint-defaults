eslint-plugin-no-unsanitized: These rules disallow unsafe coding practices that may result into security vulnerabilities. We will disallow assignments (e.g., to innerHTML) as well as calls (e.g., to insertAdjacentHTML) without the use of a pre-defined escaping function. The escaping functions must be called with a template string. The function names are hardcoded as Sanitizer.escapeHTML and escapeHTML. The plugin also supports the Sanitizer API and calls to .setHTML() are also allowed by default.

