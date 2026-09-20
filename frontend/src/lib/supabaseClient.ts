import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Copy .env.example to .env and fill them in.",
  )
}

// This is the only thing in the frontend that talks to Supabase's Auth API
// (signUp / signInWithPassword / session management). All actual data reads
// and writes go through the backend API instead.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
