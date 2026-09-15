# Payment Ops Copilot

A NestJS API for tracking payment transactions, with a `POST /ask` endpoint
that answers plain-English questions about them using Gemini tool-calling.

## What's in here

- **`Transaction` entity** (TypeORM + PostgreSQL) — `id`, `amount`, `status`
  (`success` / `failed` / `pending`), `failure_reason`, `created_at`,
  `customer_email`.
- **`POST /ask`** — takes `{ "question": "..." }` and returns
  `{ "answer": "..." }`. Under the hood it calls the Gemini API
  (`gemini-3.6-flash`) with a single tool, `query_transactions`, and lets the
  model decide what to look up before answering in natural language.
- **Read-only by construction, not by prompt.** The `query_transactions` tool
  only accepts structured filters (`status`, `customer_email`,
  `failure_reason`, `min_amount`/`max_amount`, `start_date`/`end_date`,
  `limit`). The model can never send raw SQL — [`transactions.service.ts`](src/transactions/transactions.service.ts)
  builds one fixed, parameterized `SELECT` via TypeORM's query builder, so
  there is no code path from the AI agent to an `INSERT`/`UPDATE`/`DELETE`.
  If asked to issue a refund or otherwise change data, the agent explains
  that it can't and that a human needs to handle it.
- **Seed script** (`npm run seed`) — inserts 10 fake transactions (a mix of
  success/failed/pending, with realistic failure reasons like
  `insufficient_funds`, `card_declined`, `expired_card`) using
  `@faker-js/faker`.

## Example

```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How many transactions failed, and why?"}'
```

```json
{
  "answer": "There were 3 failed transactions: 1 due to insufficient funds ($1,076.47), 1 due to a processor timeout ($997.99), and 1 due to an expired card ($1,584.30)."
}
```

## Running locally

Requires a local PostgreSQL instance and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
cp .env.example .env   # fill in DB_* and GEMINI_API_KEY
npm install
npm run seed            # populate fake transaction data
npm run start:dev
```

Env vars (see [.env.example](.env.example)):

| Variable | Description |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL connection |
| `GEMINI_API_KEY` | Used by the `/ask` endpoint to call the Gemini API |

## Running with Docker

```bash
docker build -t payment-ops-copilot .
docker run -p 3000:3000 --env-file .env payment-ops-copilot
```

(If Postgres is running on your host, point `DB_HOST` at
`host.docker.internal` instead of `localhost` in that case.)

## Tests

```bash
npm run test       # unit tests (transaction filtering, DTO validation, the Gemini tool-use loop — all mocked, no network/DB calls)
npm run test:e2e   # e2e tests (HTTP layer; requires a running Postgres for the root AppModule test)
```

## CI/CD

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push/PR:

1. **`test`** — spins up a Postgres service container, then runs `npm run build`, `npm run test`, and `npm run test:e2e`.
2. **`docker`** — on pushes to `main`/`master` only (skipped on PRs), builds the image and publishes it to `ghcr.io/<owner>/<repo>`, tagged `latest`, the short commit SHA, and the branch name.

## Project structure

```text
src/
  transactions/       Transaction entity, TypeORM module, read-only query service
  ask/                POST /ask controller, DTO, and the Gemini tool-use loop
  seed.ts             Seed script (npm run seed)
```
