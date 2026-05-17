/**
 * api/index.ts — Vercel Serverless Function entry point
 *
 * Vercel routes every /api/* request here via the rewrites in vercel.json.
 * We wrap the existing Express router so no API logic changes are needed.
 *
 * IMPORTANT: This file is pre-bundled to api/index.js by esbuild during the
 * Vercel build step (see the `vercel-build` script in package.json). We use
 * the `.js` extension on the relative import so that:
 *   - the local dev runtime (tsx) resolves the TS source transparently, and
 *   - the bundled output is a single self-contained JS file with no runtime
 *     resolution of `src/routes/api`, which previously failed on Vercel with
 *     `ERR_MODULE_NOT_FOUND` because the raw .ts source was shipped as-is
 *     but Node's ESM loader cannot resolve extensionless bare paths.
 */

import 'dotenv/config'
import express from 'express'
import type { Request, Response } from 'express'
import apiRouter from '../src/routes/api.js'

const app = express()

// Body parser limits must match server.ts
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Vercel strips /api from req.url before forwarding to this function,
// so the router sees paths like /bons-commande/5/statut directly.
app.use('/', apiRouter)

// Vercel serverless handler — receives (req, res) for every matched request
export default function handler(req: Request, res: Response) {
  return app(req, res)
}
