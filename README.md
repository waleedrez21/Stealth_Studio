# Stealth Studio — independent edition

A complete React website and Node.js backend. This edition does not use ChatGPT, Sites, Cloudflare Workers, D1, R2, or OpenAI APIs. You own the hosting accounts, Firebase project and data.

The footer reads **Made by Waleed Shammarez**. The mobile layout, public script library, seven-day NEW badge, coach login, shared drafts, image uploads, published editing, and confirmed deletion are included.

## What runs where

| Component | Host | Purpose |
| --- | --- | --- |
| `frontend/` | Vercel | React/Vite website and editor |
| `backend/` | Railway | Node/Express API, coach authorization, uploads and live updates |
| Firebase Authentication | Your Firebase project | Email/password coach accounts |
| Cloud Firestore | Your Firebase project | Durable script/draft records, revisions and image metadata |
| Cloud Storage | Your Firebase project | Uploaded image files |

You do not need a Railway PostgreSQL service for this version. Firestore is the database.

## 1. Create and configure Firebase

Open https://console.firebase.google.com and create your own project.

1. Under Project settings → General, register a **Web app**. Copy `apiKey`, `authDomain`, `projectId` and `appId` from its Firebase configuration. Firebase Hosting is not required.
2. Under Build → Authentication → Sign-in method, enable **Email/Password**. The login page supports email/password sign-in and account creation for `@stealthgpt.ai` addresses. Verified accounts on that exact domain automatically receive coach access. For other emails, create an account in Authentication → Users → Add user and approve it in Railway's `COACH_EMAILS`. Coaches can use Set or reset password to choose their own password and must verify their email before posting. Google sign-in is not used by this edition.
3. Under Authentication → Settings → Authorized domains, add **localhost** for local development. Later add the exact Vercel/custom website hostname, without `https://`. New Firebase projects may not include localhost automatically.
4. Under Build → Firestore Database, create the default **Cloud Firestore** database. Choose the region appropriate for your team. Paste `firebase/firestore.rules` into its Rules tab and publish. The rules deny direct browser database access; the Railway API uses the Admin SDK and enforces permissions itself.
5. Under Build → Storage, create a storage bucket. Copy the exact bucket name shown in the console, typically `your-project.firebasestorage.app`. Paste `firebase/storage.rules` into its Rules tab and publish. Keep these rules closed: image access goes through the API, including public images after publication.
6. Cloud Storage for Firebase currently requires the **Blaze pay-as-you-go plan**, which requires billing setup. Hosting services may also bill usage. Configure the budget alerts you want in your own accounts.
7. Under Project settings → Service accounts, generate a Firebase Admin SDK private key. Keep its JSON file private. Only the Railway backend gets it; never put it in Vercel frontend variables, the browser, or Git.

The browser Firebase configuration is public configuration. The service-account JSON is a private backend credential.

## 2. Put this folder in your own Git repository

Unzip and open the top-level `stealth-studio` folder. It contains `frontend`, `backend`, `firebase`, and this README. Upload the source to a private GitHub repository you own. The `.gitignore` excludes local environment files, dependencies and service-account JSON files.

Install Node.js **22.13+** for local use. The root `package-lock.json` locks dependencies for both npm workspaces.

## 3. Deploy the backend to Railway

Open https://railway.com and create a project from your GitHub repository.

- Set the service **Root Directory** to `/backend`.
- The included Dockerfile builds the backend independently. Railway config-file paths do not automatically follow the Root Directory: if using the included config file, select `/backend/railway.json` explicitly. You can instead enter its settings manually.
- Start command: `npm start` (the Dockerfile already supplies the equivalent start command).
- Healthcheck path: `/health`.
- Generate a public HTTPS domain for the service.

Add these Railway variables:

| Variable | Value |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | Exact storage bucket name |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Entire contents of the private service-account JSON, as one environment variable |
| `COACH_EMAILS` | `waleed.shammarez21@gmail.com` initially; add other external coach emails separated by commas. Verified `@stealthgpt.ai` accounts qualify automatically |
| `FRONTEND_ORIGINS` | Your exact website origin, e.g. `https://stealth-studio.vercel.app` |

Railway supplies `PORT`; the backend binds to that port on `0.0.0.0`. Apply/deploy variable changes. Once Firebase credentials and Firestore are working, `https://YOUR-RAILWAY-DOMAIN/health` should return `{"ok":true}`. This health endpoint verifies a database read.

You can obtain the frontend domain before completing this step by creating the Vercel project first. If you need local development too, `FRONTEND_ORIGINS` can contain both origins: `https://YOUR-SITE.vercel.app,http://localhost:5173`. Use exact origins without trailing slashes. A custom domain must be added too. Redeploy the API after changing its variables.

## 4. Deploy the website to Vercel

Open https://vercel.com and import the same GitHub repository.

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework preset | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |

Vercel recognizes npm workspaces and the root lockfile. The included `frontend/vercel.json` sends script/draft page URLs to the React app so directly opening or refreshing those pages works.

Add these Vercel environment variables for Production:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://YOUR-RAILWAY-DOMAIN` |
| `VITE_FIREBASE_API_KEY` | Web app `apiKey` from Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Web app `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | Web app `projectId` |
| `VITE_FIREBASE_APP_ID` | Web app `appId` |

Deploy. Add the final frontend hostname in Firebase Authentication’s **Authorized domains**, and its full HTTPS origin in Railway’s `FRONTEND_ORIGINS`. Redeploy Railway if you changed the origin. If frontend variables change, redeploy Vercel: Vite puts them into the built browser files.

Use a stable production domain for authentication and API access. Preview deployment domains also need explicit authorization if you choose to use them.

## 5. Sign in and verify the product

1. Open the public website in a private browser window. The library should load without login.
2. Choose Post script → Coach login, using an approved email/password account. Create your own account in Firebase first and keep `waleed.shammarez21@gmail.com` in `COACH_EMAILS`.
3. Write a title and text; card description is optional. Add an image and caption if wanted.
4. Choose Save draft. A second approved coach should be able to open it in Script drafts and edit it. Visitors should not see the draft or its private image.
5. Publish. The script should appear for other open viewers without a manual refresh, with a NEW badge for seven days from publication.
6. Open the published script while signed in as a coach. Edit script → Save changes updates the published version and keeps the original publication date.
7. Delete asks for confirmation. Deleted scripts disappear from the public library and shared drafts. The records are marked deleted in Firestore; the UI has no restore workflow. Uploaded files are retained and become private when no published script references them.
8. Try simultaneous edits from two coaches: the second stale save should be rejected while preserving their unsaved text.

Editing is collaboration through saved revisions, **not simultaneous Google Docs-style typing**. If another coach saves while you are editing, the editor warns you and offers the latest version in a new tab. It never replaces your unsaved text automatically.

The editor autosaves after a two-second typing pause and periodically during continuous typing. New scripts become shared drafts after meaningful content is entered; Publish script is still an explicit action. Editing a published script autosaves to the published version. Saving status appears above the editor, and the existing buttons can save immediately. Pending uploads pause autosave. Network failures retry the same request, and the browser warns before leaving with unsaved changes. Edits are not backed up to local storage.

Each editor serializes its writes using the last acknowledged revision. A newer coach revision pauses autosave and leaves the local text available for comparison. Retried POST/PATCH saves use request IDs; the backend acknowledges an identical request once and rejects replays after another edit, pin, archive or deletion. Request metadata is omitted from API reads. Write limits are per verified coach so coaches on the same network do not block each other. No new environment variables or Firebase rules are needed.


## How information updates

Coaches save changes through the Railway API. The API verifies the Firebase ID token, verifies the email and coach allowlist, and stores the change in Firestore. Saves and deletes use Firestore transactions to protect revisions and image visibility together.

Open viewers use a live API stream backed by Firestore snapshot listeners. A saved change triggers a fresh fetch of the library, reader, or draft list. The stream reconnects automatically after a disconnect or token expiration. Scripts do not require a website rebuild or redeployment. Code changes still require a normal deployment.

Firestore and Storage are persistent across Railway restarts and Vercel deployments. They are in **your** Firebase project. Local development with that same project also reads/writes the same data; configure a separate Firebase project if you want separate development data.

## Run locally

From the top-level folder:

```bash
npm ci
```

Copy `frontend/.env.example` to `frontend/.env` and fill in the web configuration. Copy `backend/.env.example` to `backend/.env` and fill in your backend credentials. For the local `.env`, paste service-account JSON on one line; single-quote the whole value if necessary. Keep the JSON’s private-key `\n` escapes intact.

Set `VITE_API_URL=http://localhost:3001`, `FRONTEND_ORIGINS=http://localhost:5173`, and add localhost to Firebase Authentication’s authorized domains.

In one Terminal:

```bash
npm run dev:api
```

In a second Terminal:

```bash
npm run dev:web
```

Open http://localhost:5173. This uses real Firebase authentication and data, not a mock login. The backend fails with a clear setup error if private credentials are missing.

## Existing hosted data

`migration/current-site-data.json` is a snapshot of the original site at export time. It contains the two database records present then and no uploaded-image records. It may include deleted records for completeness. The import script copies active scripts/drafts and skips deleted or already-existing documents.

After you configure `backend/.env`, run locally from the top-level folder:

```bash
npm run import:legacy --workspace backend
```

It imports into the Firebase project in your backend configuration. Existing documents are never overwritten. Old site-specific author IDs remain historical metadata; coach access on the new site comes from Firebase login and the allowlist. The old ChatGPT-hosted site is a separate copy and is not automatically synchronized with the independent version. Changes made after the snapshot are not in this file.

## Verification completed

- Frontend TypeScript check and production build passed.
- Backend API tests passed for anonymous public reads, verified coach permissions, shared drafts, concurrent edit conflicts, private/public image access, edits, deletion, and live update events.
- API tests use an isolated Firebase-compatible test adapter with test identities. No production test tokens or development auth bypass are included in the runtime server.
- Your real Firebase project, Railway deployment and Vercel deployment cannot be checked until you configure your own accounts and credentials. Complete the product checks in step 5 before team rollout.

## Files and troubleshooting

`frontend/src/` contains the interface. `backend/src/app.js` defines API authorization and routes. `backend/src/store.js` contains Firestore transactions and Storage integration. `firebase/` contains closed browser-access rules. `backend/test/` contains the automated API checks.

Run `npm test` for backend checks and `npm run build` for frontend checks/build.

- **Firebase unauthorized domain:** add the frontend hostname (or localhost) to Authentication’s authorized domains.
- **Coach access required:** verify the account email. Exact `@stealthgpt.ai` addresses qualify automatically; external addresses must be in Railway’s `COACH_EMAILS`. Apply/redeploy any backend variable changes.
- **API connection/origin error:** check `VITE_API_URL`, Railway’s `FRONTEND_ORIGINS`, and `/health`.
- **Image uploads fail:** check that Storage exists, its bucket name is correct, Blaze billing is enabled, and the backend service account has access.
- **Live updates reconnecting:** check Railway is running and the API is reachable. Saved data remains in Firestore.
- **Private-key parsing error:** use the entire original service-account JSON and preserve its escaped newline characters.

Official references:

- https://docs.railway.com/deployments/monorepo
- https://docs.railway.com/deployments/healthchecks
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/monorepos
- https://firebase.google.com/docs/admin/setup
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/firestore/query-data/listen
- https://firebase.google.com/docs/storage/faq-and-troubleshooting

## Rich text formatting

Script content, descriptions, image captions and coach notes use a Tiptap editor with bold, italic, underline, strikethrough, headings, lists, quotes, links, alignment, undo/redo and clear formatting. Titles stay plain single-line text. Card descriptions are shown as plain excerpts; formatting is displayed inside the script. Keyboard shortcuts such as Ctrl/Cmd+B and Ctrl/Cmd+I work.

Rich text is stored as a versioned JSON document prefixed `stealth:rich:v1:` inside the existing string fields. Existing plain text and the legacy import remain compatible, so no database migration is required. The backend validates node types, structure, safe link protocols, character counts and request size. The reader renders whitelisted React elements without injecting HTML. Keep the frontend and backend copies of `rich-text.js` in sync when extending the format.

## Script folders

The library and shared drafts have First 10 Scripts, Engagement, Study Sim Scripts and StealthGPT Scripts folders, plus an All scripts view. StealthGPT Scripts replaces the General display name; its stored ID remains `general` so existing records and links keep working. Inside this folder, coaches can assign the StealthGPT or Humanchatgpt subfolder using the editor dropdown. Both public scripts and shared drafts have matching subfolder navigation. Existing records without a subfolder remain in the parent folder; they are not automatically reclassified. Coaches choose a folder in the Post to folder dropdown and can move drafts or published scripts by editing and saving. First 10 Scripts is a manually curated starter collection and displays its regular scripts in posted order, with urgent scripts first; it is not an automatic limit or a rolling list of the newest ten. Older records default to the StealthGPT Scripts parent folder. Firebase stores the folder ID directly on each script, and its existing live updates include folder moves. No Firestore migration or extra index is needed.

## Reference videos

Coaches can add up to 10 reference videos with optional names in the editor. Links appear under the title and byline in published scripts and under the title in previews. Drafts keep their references private. Video links open in a new tab; videos are not embedded. Only http/https URLs are accepted. Firebase stores a `references` array of `{label,url}` objects on each script; older scripts default to an empty array. References can be added, removed or edited when editing a draft or published script.

## Creator script template

The editor provides separate rich text boxes for Note, On-screen text, Script, CTA, Captions, Audio, Notes, Background and Description, alongside the Video Inspiration link boxes. Card description remains a separate short library summary. Empty sections are hidden in published scripts and previews. Extra text and image blocks remain available.

Template text is saved in existing `blocks` entries using an optional `section` label, while Notes uses the existing `notes` field and Video Inspiration uses `references`. No database migration is required. Opening an older script keeps its text, images, notes and references; its first unnamed text block becomes the Script field and the empty template fields are added for editing.

## Audio and optional summaries

Audio has an optional http/https reference link and rich text instructions, plus an explicit None option. None is displayed in previews and published scripts. The setting is stored as optional `audio: {mode: 'link' | 'none', url: string}` on the Audio text block. Legacy Audio fields containing NONE open with None selected.

Card description is optional, including in backend validation. Blank descriptions use a short excerpt from the Script section on cards. Divider lines separate populated sections and visuals in previews and published scripts. No database migration is needed.

## Coach accounts and approval

1. Enable Email/Password in Firebase Authentication.
2. Team members with an exact `@stealthgpt.ai` email click Post script → Create account, choose a password, and verify their mailbox. Verified team accounts receive coach access automatically; no Railway change is needed for each employee. Subdomains and lookalike domains do not qualify.
3. For external coaches, create their email/password account in Firebase Authentication → Users and add the email to Railway's comma-separated `COACH_EMAILS`. Keep `waleed.shammarez21@gmail.com` there for the owner's existing account. External users can reset their passwords on the login page and must also verify their emails.
4. To revoke a company-domain coach, disable their Firebase account; removing them from `COACH_EMAILS` does not revoke domain-based eligibility. For external coaches, remove their approved email and redeploy, or disable the account. Backend token verification checks revocation on protected requests.

Anonymous visitors continue to read published scripts without signing in. All protected APIs require a valid, verified Firebase token and backend eligibility. Merely typing a company email or creating an unverified account grants no coach access. This independent edition uses Firebase authentication.

## Urgent scripts

Coaches can select Mark as urgent when creating or editing any script. It is stored as a boolean `urgent` on the script document. Published urgent scripts appear first in All scripts and each folder, with an Urgent badge; within that group the existing folder date order is preserved. First 10 Scripts uses oldest-first, other folders newest-first. Uncheck the option and save to unpin. Draft urgency is saved for later publication, but the draft stays private.

Older documents without `urgent` behave as regular scripts. Updates that omit the field retain the existing value. No Firestore migration or additional index is required. The existing realtime subscription updates pin/unpin changes.

## Free frontend hosting alternative

Cloudflare Pages can host the same frontend instead of Vercel. Build the root workspace with `npm ci && npm run build --workspace frontend` and publish `frontend/dist`. Set the same five `VITE_*` variables listed above. Update Firebase authorized domains and Railway `FRONTEND_ORIGINS` to your production Pages hostname/origin. This is a single-page app: keep Pages' fallback to index.html for script and draft routes.

## Potential videos — private coach ideas

Potential videos is separate from script drafts. Coaches save a required http/https video link, optional title and formatted thoughts. All approved coaches can edit or delete ideas; stale changes are rejected. Ideas are stored in a separate Firestore `ideas` collection, never in public scripts or drafts. The list updates every 15 seconds without replacing unsaved thoughts. The existing closed Firestore rules also protect this collection; no extra index is required.

## StealthGPT branding and subfolders

The sidebar brand and favicon use the supplied original JPEG at frontend/public/stealthgpt-logo.jpeg. The title remains Stealth Studio. Subfolder IDs are `stealthgpt` and `humanchatgpt`; `subfolder` is empty when unassigned or outside the `general` parent. The backend validates the parent/subfolder combination, preserves omitted subfolder values on updates within the parent, and clears them when moving to another folder. Existing exports preserve the new field automatically. No Firestore indexes, rules or environment-variable changes are required.
