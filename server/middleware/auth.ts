import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const ALLOWED_EMAILS = ['chris@chrisgrime.com']

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid authorization header' })
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    // Check if email is whitelisted
    if (!user.email || !ALLOWED_EMAILS.includes(user.email)) {
      return res.status(403).json({ message: 'Access denied - email not authorized' })
    }

    // Attach user to request for downstream use
    ;(req as any).user = user

    next()
  } catch (error: any) {
    console.error('Auth middleware error:', error)
    return res.status(500).json({ message: 'Authentication error' })
  }
}
