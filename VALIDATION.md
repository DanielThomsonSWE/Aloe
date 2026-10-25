# Validation — 2026-10-25

## Passed

- TypeScript strict type check (`npm run typecheck`).
- Expo production bundle exports for web, iOS, and Android. This verifies bundling, not native installation or runtime rendering.
- 13 FastAPI tests: missing/invalid authentication, forwarding caller credentials, user-scoped reads/writes, input validation, owner-injection rejection, pin updates, missing records, deletion, upstream failures, and suppression of internal error details.
- All 11 original Figma SVG assets downloaded successfully; non-empty files and root dimensions checked. The icon component uses those original dimensions and local sources.
- Font imports narrowed to the four used faces.

## Not completed

- Visual comparison and interactive browser/device testing: the sandbox denied binding a local preview server, and the active approval policy disallowed escalation.
- Live Supabase auth/database verification and applying setup SQL: external network access was denied. Connection configuration is stored locally, but no live database readiness claim is made.
- ESLint: installation of the required Expo ESLint dependencies failed due to blocked registry access. The failed dependency additions were removed to keep package.json consistent with the lockfile. `npm run lint` will install/configure them when network access is available.
- Live database RLS validation: API tests use a mocked Supabase upstream. Run real tests with two authenticated users after applying the schema; confirm each can only read, pin, and delete their own records.
- Dependency security review: the initial online npm install reported 5 high-severity findings. A later offline audit returned zero findings, which does not establish current security status. Re-run an online `npm audit` and review/fix the findings before release.

## Manual acceptance checks

1. In demo mode, initial Home shows Metformin, Synthroid, and Lisinopril, without Atorvastatin.
2. Search by name or schedule, try an unmatched query, then clear it.
3. Pin Lisinopril: it moves first; reload and confirm the pin persists. Unpin it to restore chronological order.
4. Open Add medication; submit an empty form and confirm validation. Add a labeled test record, reload, and inspect its details.
5. Remove that test record through the explicit confirmation; cancellation must keep it.
6. Food interactions and Calendar show coming-soon dialogs; Home remains the only page.
7. Check a narrow phone, increased text size, keyboard avoidance, native safe areas, and all original icons.
8. In connected mode, verify empty initial state, persistence, errors/retry, and two-user isolation against the real project.
