# Repository workflow

Read the parent/user provided AGENTS.md instructions as the workflow baseline. This project uses Node.js 22+, npm, React/Vite, and Express.

- Install: `npm ci`
- Develop: in separate terminals run `npm run dev` and `npm run start`
- Targeted checks: `npm test`, `npm run lint`
- Full completion gate: `npm test && npm run lint && npm run build`
- Deploy/packaging check: after build, run `npm run start` and verify `/api/health`, player, match, and frontend routes.
- No persisted database schema. Followed IDs are localStorage only. `src/heroes.json` is a checked-in OpenDota constants snapshot.
- Keep OpenDota ID validation and AI URL safety restrictions intact. Do not put API keys in browser storage, repository files, or server logs.
