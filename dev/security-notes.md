<!--
Name: security-notes.md
Description: Security findings, runtime anomalies, and mitigations for TypeScript JobMaker & Job Runner
Version: 3.1.6
Date Created: 2026-09-27
Author: Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
RELATIONAL_ID: a7b1893c-6231-419a-9e1b-419b4890a884
-->

# Security Notes & Edge-Case Findings

## 1. Localhost Isolation & Host Binding
- Server binds to `127.0.0.1` by default or internal loopback.
- Path traversal mitigation: `resolveContainedPath()` strictly checks containment against allowed roots to prevent directory traversal.

## 2. API Key Life Cycle & Zero-Leak Browser Policy
- API keys managed in browser session via BEJSON 104a schema with round-robin rotation.
- When server-side proxy route is called, keys can be forwarded securely or read from environment variable `GEMINI_API_KEY`.
- No sensitive keys leaked into error responses or public telemetry.

## 3. Subprocess Test Commands
- Test commands (`test_cmd`) executed via `child_process.execFile` or parameterized execution with timeout (30 seconds) to avoid hanging processes or terminal lockup.
- Only run jobs and test commands from trusted project sources.

## 4. Atomic File Swapping & Staged Clone Isolation
- Script mutations occur on temporary clones (`.tmp.<timestamp>`).
- Validation gates (AST syntax checking + subprocess test command) must succeed before atomic rename/commit is permitted.
- Expired stage mutations automatically cleaned up after stage TTL (600s).
