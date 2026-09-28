# Repository workflow

Read the parent/user provided AGENTS.md instructions as the workflow baseline. This project uses Node.js 22+, npm, React/Vite, and Express.

- Install: `npm ci`
- Develop: in separate terminals run `npm run dev` and `npm run start`
- Targeted checks: `npm test`, `npm run lint`
- Full completion gate: `npm test && npm run lint && npm run build`
- Deploy/packaging check: after build, run `npm run start` and verify `/api/health`, player, match, and frontend routes. Production deployment runs only from GitHub Actions on main; beta deployment is `npm run deploy:beta` from the local worktree.
- D1 stores AI analysis jobs and shared results; migrations are in `migrations/`. Apply pending remote migrations before deploying either environment. Followed IDs are localStorage only. `src/heroes.json` is a checked-in OpenDota constants snapshot.
- Keep OpenDota ID validation and AI URL safety restrictions intact. Do not put API keys in repository files or server logs. Browser storage is controlled by the opt-in "remember API Key" setting.
