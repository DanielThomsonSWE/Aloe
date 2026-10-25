# Aloe — Home MVP

React Native (Expo + TypeScript), Python (FastAPI), and Supabase. Implements the selected **Home - Without Atorvastatin** frame from [Drug-Food Interaction App](https://www.figma.com/design/fQneBOuwRQneJ4OIFDcrGm/Drug-Food-Interaction-App?node-id=418-5060).

## Included

- The original home layout, Inter/Outfit fonts, and 11 original local Figma SVG assets.
- Search by medication name, dosage, or schedule; pin/unpin with pinned items first.
- Medication details, validated add/edit flows, exact scheduled times with repeat days, a separate optional description, and removal with confirmation.
- Loading, empty, no-results, error/retry, and pull-to-refresh states.
- Home, Calendar, and Food interactions navigation; the Calendar shows saved exact-time schedules.
- A persistent local demo containing the three Figma examples, without Atorvastatin.
- A Python API and owner-scoped Supabase SQL for connected use.

This is a saved-medication list, not an interaction checker. Doses and schedules are user-entered text, not generated advice. The Figma example disclaimer is preserved.

## Location

- `mobile/`: React Native source and Expo project.
- `backend/`: Python API, tests, and locked dependencies.
- `supabase/setup.sql`: initial database setup, not yet applied.
- `VALIDATION.md`: checks completed and outstanding limitations.

## Run the working local demo

Dependencies are already installed in this workspace. On a fresh copy:

```sh
cd mobile
npm ci
```

Start the web preview:

```sh
npm run web
```

For native development, run `npm start`, then open a compatible Expo client or use `npm run ios` / `npm run android` with the required platform tooling. The app uses Expo SDK 58; the client must support that SDK. Native status bars and safe areas replace the simulated status bar and home indicator used in the web preview.

Without environment files the app defaults to demo mode. Demo changes persist in device/browser storage. They are never uploaded or copied into a real account. Clearing the `aloe:demo:medications:v1` storage entry restores the three sample records on the next load.

## Connect the supplied Supabase project

The project URL and publishable key supplied in chat are saved in **ignored** `mobile/.env.local` and `backend/.env` files. No service-role key is used. Portable copies exclude these local environment files; use the supplied `.env.example` files to configure another machine.

Hosted project setup and connectivity have **not been verified** because the environment blocked network access.

1. Open the SQL Editor in your Supabase project and run `supabase/setup.sql` once. It creates `public.aloe_medications`, explicit API grants, and ownership policies. If you already ran the initial setup, run `supabase/enable_medication_edits.sql` instead; do not rerun the create-table script.
2. Enable **Anonymous Sign-Ins** in Supabase Authentication settings. The MVP creates a private anonymous identity so no extra login page is needed. An anonymous identity remains tied to the device's stored session; account recovery and cross-device sign-in are not included. Keep this as a development setup until the intended account lifecycle is implemented.
3. Ensure the Data API is enabled for the `public` schema.
4. Start the Python API from a separate terminal:

```sh
cd backend
uv sync --locked
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

5. In `mobile/.env.local`, change `EXPO_PUBLIC_DATA_MODE=demo` to `EXPO_PUBLIC_DATA_MODE=supabase`. Leave `EXPO_PUBLIC_API_URL=http://localhost:8000` for a local browser or simulator. Restart Expo after environment changes.
6. Open the app. A new connected account starts **empty**. Add a test record, pin it, reload, and confirm persistence. Demo prescriptions are intentionally not seeded into connected accounts.

For a physical phone, use your computer's LAN address as the API URL and start Uvicorn with `--host 0.0.0.0` on a trusted development network. Android emulators typically reach the host using `10.0.2.2`. Production requires a hosted HTTPS backend and explicit web origins in `CORS_ORIGINS`; there is no deployment included.

## API

`GET /health` reports process health/configuration only, not live database readiness. API docs are at `/docs`.

All medication endpoints require `Authorization: Bearer <Supabase access token>`:

- `GET /medications`: list the current user's saved medications.
- `POST /medications`: add `name`, `dosage`, exact-time `schedule`, and optional `description`.
- `PATCH /medications/{uuid}`: update the `pinned` boolean, medication name, dosage, exact-time schedule, and/or description.
- `DELETE /medications/{uuid}`: remove the current user's saved item.

The API validates tokens with Supabase Auth, derives ownership from that identity, and forwards the caller's token to PostgREST. Row-level security remains active. The client cannot set an owner through the API. Direct database grants permit inserting and editing medication fields while keeping row access owner-scoped.

## Checks

```sh
cd mobile
npm run typecheck
npm run export:web
npm run lint
```

The first lint run installs Expo's ESLint dependencies if absent and requires registry access. They could not be installed in this session. Commit the updated package files once installed.

```sh   
cd backend
uv run pytest -q
```

See `VALIDATION.md` for the exact verified scope. Supabase setup, a real two-account isolation test, visual browser comparison, and native device testing remain before release.

## Implementation references

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
- [Supabase React Native authentication](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Explicit Data API grants](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
