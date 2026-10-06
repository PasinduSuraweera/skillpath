# SkillPath web app (Stage 10)

React + TypeScript + Vite + Material UI front end for the SkillPath API.

```bash
npm install        # first time only
npm run dev        # http://localhost:5173 (needs the API: uvicorn app.main:app on port 8000)
npm run build      # type-check and build to dist/
npm run lint       # oxlint
npm test           # unit tests (Vitest), src/*.test.ts
npm run e2e        # browser test in Chrome; needs the API and npm run dev running
```

See the "Web app (Stage 10)" section of the main README for what the app does and how it is
organised, and `reports/testing.md` for the test cases.
