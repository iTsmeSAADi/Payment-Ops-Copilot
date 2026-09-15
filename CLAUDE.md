# Payment Ops Copilot

## What this is
A NestJS API with an /ask endpoint that answers plain-English 
questions about transactions using Gemini tool-calling.

## Stack
- NestJS + TypeORM
- PostgreSQL
- Google Gemini API (@google/genai, gemini-2.5-flash) for the /ask agent

## Run it
npm run start:dev
npm run seed   # populates fake transaction data

## Rules for Claude Code
- Never let the AI agent run write queries (INSERT/UPDATE/DELETE) — 
  read-only only, enforced in code, not just prompt.
- Refunds are never automatic — flag_for_refund only logs a pending 
  request, it doesn't execute anything.