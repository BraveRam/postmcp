# Agent Instructions & Next.js 16 Reference

This repository contains the PostMCP monorepo, including `@postmcp/studio` built on Next.js 16 (App Router, React 19, Turbopack).

## Next.js 16 Documentation & Guidelines
- Documentation: [Next.js 16 App Router](https://nextjs.org/docs/app)
- Upgrade Guide: [Upgrading to Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16)
- AI Coding Agents Guide: [Next.js with AI Agents](https://nextjs.org/docs/app/guides/ai-agents)

## App Router Conventions
- Dynamic APIs (`params`, `searchParams`, `cookies()`, `headers()`) are async Promises in Next.js 16.
- Server Actions & Route Handlers use `export async function GET/POST(request: Request)`.
- Turbopack is the default bundler for development and builds (`next dev --turbo`).
- React 19 features (Actions, `use`, `useActionState`) are supported natively.
