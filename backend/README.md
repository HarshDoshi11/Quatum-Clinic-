# Q/Clinical backend

FastAPI stub. See the root README for setup, the route table and how to point the frontend at it.

- `app/main.py`: routes ("ML hook" comments mark where the ML pipeline plugs in)
- `app/schemas.py`: request bodies (camelCase, mirrors `frontend/src/types`)
- `app/fixtures/`: JSON exported from the frontend mocks. Don't edit by hand; run
  `npm run export:fixtures` in `frontend/`.
