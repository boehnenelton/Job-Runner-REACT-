# AGENTS.md: Project Purpose & Core Operating Objectives

## Core Project Purpose
Rebuild JobMaker & Job Runner from the ground up 100% in TypeScript, converting the entire system from its legacy Flask/Python architecture (`Joob_Runner.py`) while maintaining complete backward compatibility with the BEJSON 104a Job Schema, Job Registry, and Chunked-104a formats. In addition, introduce a comprehensive suite of new job templates, direct BEJSON library operations, robust self-evolving task execution gates, diff review, key management with round-robin rotation, and a full vanilla JavaScript mirror in `/js`.

## Primary Objectives & Mandates
1. **Core TypeScript Library Integration**:
   - Integrate Elton Boehnen's BEJSON Core TypeScript Family Libraries immutably in `src/lib/`.
   - Adhere strictly to the Field Map Cache mandate (`bejson_core_get_field_map`) with zero index-based positional hardcoding.
2. **Flask to Full-Stack TypeScript Architecture Conversion**:
   - Implement the complete server-side API in `server.ts` with Express and `@google/genai` SDK support.
   - Maintain 100% schema backward compatibility with legacy `JobSchema` and `JobRegistry` formats.
   - Support stage evolution, AST validation, execution gates, diff generation, atomic commit, and rollback.
3. **Rich Template Ecosystem**:
   - Provide original and new production-grade templates:
     - Python Script Refactoring & Test Gate
     - TypeScript Library Parity & Mirroring
     - React Component Architecture & Specification
     - Full-Stack Express API Endpoint & Schema
     - Unit Test Suite Generation & Assertion Matrix
     - BEJSON 104a Data Migration & Validation
     - Documentation & Audit Ledger Generator
4. **Mandatory Meta-UI (Three-Tab Architecture)**:
   - Tab 1: About (Account) - crediting Elton Boehnen, active version, metadata.
   - Tab 2: Change Log - live parsed from `bejson_project.json`.
   - Tab 3: Assets - combo box, raw payload viewer, Copy, Save, and Save ZIP (via JSZip).
5. **UI & Styling Policy**:
   - Strict Tri-Color Palette (#FFFFFF, #000000, #DE2626).
   - Zero visual fluff, zero forbidden color pairs.
   - Non-monolithic, horizontally partitioned layout with top-level tool header and sub-navigation.
6. **Vanilla JavaScript Mirror in `/js`**:
   - Provide a 100% standalone, browser-executable vanilla JavaScript mirror in `/js/index.html` referencing `src/lib/lib_js/`.

## Continuous Execution Reminder
Work incrementally toward this objective while rigorously maintaining all architectural, coding, versioning, and documentation standards at every checkpoint.
