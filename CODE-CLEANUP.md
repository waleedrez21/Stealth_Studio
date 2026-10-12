# Code readability cleanup

Formatting and explanatory comments only. No dependency, API, schema, theme, or feature changes. 15 backend tests, TypeScript check, and production build passed. Prettier 3.6.2 with the included configuration formats the source.

This package is an overlay for the independent project, not a complete repository. It contains only changed source files and formatter settings; it does not include Firebase data, credentials, dependencies, the export script, or the content ZIP. Your existing README.md and QUICK_START.md stay in place.

Unzip into Downloads so the folder is ~/Downloads/Stealth-Studio-Code-Cleanup. Then run:

```sh
ditto ~/Downloads/Stealth-Studio-Code-Cleanup ~/Downloads/stealth-studio-independent
cd ~/Downloads/stealth-studio-independent
git status --short
git diff --stat
```

Review the source changes, then commit only these paths:

```sh
git add frontend/src backend/src backend/test backend/scripts/import-legacy.mjs .prettierrc.json .prettierignore CODE-CLEANUP.md
git commit -m "Format source and document authorization and update handling"
git push
```

Do not use git add . here: the content export and private files should stay outside the repository. The commands above do not stage your new export script or the content ZIP. GitHub pushes may trigger connected deployments.

For future formatting from project root:

```sh
npx prettier@3.6.2 --write "frontend/src/**/*.{ts,tsx,js,css}" "backend/src/**/*.js" "backend/test/**/*.js"
```

This cleanup improves readability and maintainability; it does not establish who authored the original code or perform the planned Supabase migration.
