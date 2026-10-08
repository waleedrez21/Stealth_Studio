# Deploy Stealth Studio independently

1. Create Firebase: enable Email/Password Authentication, create Firestore and Storage, add your website/localhost authorized domains, and get web config plus a private Admin SDK key.
2. Put the unzipped source into your own GitHub repository.
3. Railway: deploy `/backend`, set `/health` as healthcheck, add the backend variables listed in README.md, and generate a public domain.
4. Vercel: deploy `frontend` using Vite, build `npm run build`, output `dist`; fill in its five `VITE_*` values.
5. Put Vercel’s origin into Railway’s `FRONTEND_ORIGINS` and its hostname into Firebase Authentication’s Authorized domains. Apply variable changes and redeploy.
6. Optional: import the included original-site snapshot with `npm run import:legacy --workspace backend` after configuring local backend credentials.
7. Create coach accounts in Firebase Users and approve their emails in Railway COACH_EMAILS, then sign in with email/password using Post script → Coach login and test saving, publishing, editing, deletion and image privacy.

Read README.md for exact values, local commands and verification steps. Firebase Storage requires Blaze billing. This package has no ChatGPT/OpenAI dependency.
