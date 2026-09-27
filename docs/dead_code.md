<!--
Name: dead_code.md
Description: Audit ledger of retired or purged legacy code elements
Version: 3.1.6
Date Created: 2026-09-27
Author: Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
RELATIONAL_ID: e53f2819-21a4-4df8-86d7-ea81907cb582
-->

# Dead Code & Migration Ledger

- Legacy Flask `app.run` and Python AST inspection routines converted to TypeScript AST (`typescript` compiler API / syntax validation) and Express routing.
- Python `difflib.unified_diff` replaced with pure TypeScript diff computation.
- Python subprocess calls migrated to Node.js `child_process`.
- Legacy single-file HTML template inside Python string replaced with modern React UI and `/js` vanilla mirror.
