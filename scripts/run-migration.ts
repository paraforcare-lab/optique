/**
 * One-time migration script.
 * Run with: npx tsx scripts/run-migration.ts
 */

import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve } from "path"

dotenv.config({ override: true })

const url = process.env.VITE_SUPABASE_URL!
const key = process.env.VITE_SUPABASE_SERVICE_KEY!
const supabase = createClient(url, key)

async function run() {
  const files = [
    "MIGRATION_STOCK_HISTORY.sql",
    "MIGRATION_STOCK_CONSTRAINTS.sql",
  ]

  for (const file of files) {
    const sqlPath = resolve(process.cwd(), file)
    let sql: string
    try {
      sql = readFileSync(sqlPath, "utf-8")
    } catch {
      console.log(`File not found: ${file}`)
      continue
    }

    // Split into individual statements
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 5 && !s.startsWith("--"))

    console.log(`\n${file}: ${statements.length} statements`)

    // Execute each statement via supabaseAdmin.rpc('pg_query', ...)
    // If pg_query RPC doesn't exist, use direct pg connection below
    for (const stmt of statements) {
      const { error } = await supabase.rpc("pg_query", { query: stmt + ";" })
      if (error) {
        console.log(`  ✗ ${error.message.substring(0, 80)}`)
        console.log(`  SQL: ${stmt.substring(0, 80)}`)
      } else {
        console.log(`  ✓ ${stmt.substring(0, 60)}...`)
      }
    }
  }

  console.log("\nDone. If pg_query RPC failed, run the SQL manually from Supabase Dashboard > SQL Editor.")
}

run().catch(console.error)
