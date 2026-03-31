// Database types derived from supabase/migrations/20260330000000_initial_schema.sql
// Regenerate if schema changes: supabase gen types typescript --project-id <id> > lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type SignalType = 'answer_seeking' | 'urgency_framing' | 'topic_drift' | 'bypass_attempt'

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string
          student_id: string
          course_id: string
          started_at: string
          ended_at: string | null
          context: Json
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          course_id: string
          started_at?: string
          ended_at?: string | null
          context?: Json
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          course_id?: string
          started_at?: string
          ended_at?: string | null
          context?: Json
          created_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          session_id: string
          role: 'student' | 'tutor'
          content: string
          sequence_order: number
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: 'student' | 'tutor'
          content: string
          sequence_order: number
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: 'student' | 'tutor'
          content?: string
          sequence_order?: number
          created_at?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          id: string
          message_id: string
          session_id: string
          signal_type: SignalType
          label: string
          reasoning: string
          confidence: number
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          session_id: string
          signal_type: SignalType
          label: string
          reasoning: string
          confidence: number
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          session_id?: string
          signal_type?: SignalType
          label?: string
          reasoning?: string
          confidence?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

// Convenience row types
export type SessionRow = Database['public']['Tables']['sessions']['Row']
export type MessageRow = Database['public']['Tables']['messages']['Row']
export type SignalRow = Database['public']['Tables']['signals']['Row']

// Shape returned by the nested select in the session replay page
export type MessageWithSignals = MessageRow & {
  signals: Pick<SignalRow, 'signal_type' | 'label' | 'reasoning' | 'confidence'>[]
}

// Typed context JSONB — validated at runtime before use
export interface SessionContext {
  name?: string
  deadline_proximity?: string
  assignment?: string
}

export function parseSessionContext(raw: Json): SessionContext {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const obj = raw as Record<string, Json>
  return {
    name: typeof obj.name === 'string' ? obj.name : undefined,
    deadline_proximity: typeof obj.deadline_proximity === 'string' ? obj.deadline_proximity : undefined,
    assignment: typeof obj.assignment === 'string' ? obj.assignment : undefined,
  }
}
