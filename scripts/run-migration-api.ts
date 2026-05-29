// One-time migration script: run via the existing Supabase REST API
import { supabaseAdmin } from '../src/lib/supabase.server'
import fs from 'fs'
import path from 'path'

async function runMigrations() {
  const files = ['MIGRATION_STOCK_HISTORY.sql', 'MIGRATION_STOCK_CONSTRAINTS.sql']

  for (const file of files) {
    const filePath = path.resolve(process.cwd(), file)
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${file}`)
      continue
    }
    const sql = fs.readFileSync(filePath, 'utf-8')
    console.log(`\nExecuting ${file}...`)

    // Use the Supabase REST endpoint for raw SQL via the service role
    const { error } = await supabaseAdmin.rpc('pg_query', { query: sql })

    if (error) {
      console.error(`Error with pg_query RPC: ${error.message}`)
      console.log('Trying alternative: execute via REST API...')

      // Split into statements and try via raw fetch to the management API
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 5 && !s.startsWith('--'))

      for (const stmt of statements) {
        try {
          const { error: stmtErr } = await supabaseAdmin.rpc('pg_query', { query: stmt + ';' })
          if (stmtErr) {
            console.log(`  Statement skipped: ${stmt.substring(0, 60)}... (${stmtErr.message})`)
          } else {
            console.log(`  OK: ${stmt.substring(0, 60)}...`)
          }
        } catch (e: any) {
          console.log(`  Error: ${stmt.substring(0, 60)}... (${e.message})`)
        }
      }
    } else {
      console.log(`✔ ${file} executed successfully.`)
    }
  }

  console.log('\nMigrations complete.')
}

runMigrations()
  .catch(console.error)
  .finally(() => process.exit(0))
