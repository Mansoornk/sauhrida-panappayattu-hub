export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contributions: {
        Row: {
          amount: number
          created_at: string
          entered_by: string
          event_id: string | null
          id: string
          member_id: string
          month: string
          note: string | null
          payment_method: string | null
          published: boolean
          screenshot_path: string | null
          status: string
          utr: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          entered_by?: string
          event_id?: string | null
          id?: string
          member_id: string
          month: string
          note?: string | null
          payment_method?: string | null
          published?: boolean
          screenshot_path?: string | null
          status?: string
          utr?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          entered_by?: string
          event_id?: string | null
          id?: string
          member_id?: string
          month?: string
          note?: string | null
          payment_method?: string | null
          published?: boolean
          screenshot_path?: string | null
          status?: string
          utr?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "payatt_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      live_draws: {
        Row: {
          candidate_ids: string[]
          candidate_names: string[]
          created_at: string
          duration_ms: number
          event_id: string
          event_no: number
          id: string
          month: string
          spun_by_member_id: string | null
          spun_by_name: string
          started_at: string
          turns: number
          winner_index: number
          winner_member_id: string
        }
        Insert: {
          candidate_ids: string[]
          candidate_names: string[]
          created_at?: string
          duration_ms?: number
          event_id: string
          event_no: number
          id?: string
          month: string
          spun_by_member_id?: string | null
          spun_by_name: string
          started_at?: string
          turns?: number
          winner_index: number
          winner_member_id: string
        }
        Update: {
          candidate_ids?: string[]
          candidate_names?: string[]
          created_at?: string
          duration_ms?: number
          event_id?: string
          event_no?: number
          id?: string
          month?: string
          spun_by_member_id?: string | null
          spun_by_name?: string
          started_at?: string
          turns?: number
          winner_index?: number
          winner_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_draws_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "payatt_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_draws_spun_by_member_id_fkey"
            columns: ["spun_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_draws_winner_member_id_fkey"
            columns: ["winner_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_accounts: {
        Row: {
          created_at: string
          last_login_at: string | null
          member_id: string
          must_change_password: boolean
          password_hash: string
          password_salt: string
          session_version: number
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          last_login_at?: string | null
          member_id: string
          must_change_password?: boolean
          password_hash: string
          password_salt: string
          session_version?: number
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          last_login_at?: string | null
          member_id?: string
          must_change_password?: boolean
          password_hash?: string
          password_salt?: string
          session_version?: number
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_accounts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          conducted_month: string | null
          created_at: string
          department: string
          has_conducted: boolean
          id: string
          name: string
          phone: string | null
          slot_no: number
        }
        Insert: {
          conducted_month?: string | null
          created_at?: string
          department: string
          has_conducted?: boolean
          id?: string
          name: string
          phone?: string | null
          slot_no: number
        }
        Update: {
          conducted_month?: string | null
          created_at?: string
          department?: string
          has_conducted?: boolean
          id?: string
          name?: string
          phone?: string | null
          slot_no?: number
        }
        Relationships: []
      }
      payatt_events: {
        Row: {
          appeal_note: string | null
          created_at: string
          event_no: number
          id: string
          month: string
          notes: string | null
          priority_reason: string | null
          recipient_member_id: string | null
          selection_type: string
        }
        Insert: {
          appeal_note?: string | null
          created_at?: string
          event_no?: number
          id?: string
          month: string
          notes?: string | null
          priority_reason?: string | null
          recipient_member_id?: string | null
          selection_type: string
        }
        Update: {
          appeal_note?: string | null
          created_at?: string
          event_no?: number
          id?: string
          month?: string
          notes?: string | null
          priority_reason?: string | null
          recipient_member_id?: string | null
          selection_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payatt_events_recipient_member_id_fkey"
            columns: ["recipient_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      payatt_months: {
        Row: {
          conductor1_id: string | null
          conductor1_payout: number
          conductor1_reason: string | null
          conductor2_id: string | null
          conductor2_payout: number
          created_at: string
          draw_at: string | null
          event_time: string | null
          id: string
          ledger_published: boolean
          month: string
          payatt_date: string
          published_at: string | null
          tea_menu: string[]
          venue: string | null
          wheel_override: boolean
        }
        Insert: {
          conductor1_id?: string | null
          conductor1_payout?: number
          conductor1_reason?: string | null
          conductor2_id?: string | null
          conductor2_payout?: number
          created_at?: string
          draw_at?: string | null
          event_time?: string | null
          id?: string
          ledger_published?: boolean
          month: string
          payatt_date: string
          published_at?: string | null
          tea_menu?: string[]
          venue?: string | null
          wheel_override?: boolean
        }
        Update: {
          conductor1_id?: string | null
          conductor1_payout?: number
          conductor1_reason?: string | null
          conductor2_id?: string | null
          conductor2_payout?: number
          created_at?: string
          draw_at?: string | null
          event_time?: string | null
          id?: string
          ledger_published?: boolean
          month?: string
          payatt_date?: string
          published_at?: string | null
          tea_menu?: string[]
          venue?: string | null
          wheel_override?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payatt_months_conductor1_id_fkey"
            columns: ["conductor1_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payatt_months_conductor2_id_fkey"
            columns: ["conductor2_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      priority_requests: {
        Row: {
          admin_note: string | null
          amount_needed: number | null
          assigned_month: string | null
          created_at: string
          details: string | null
          id: string
          member_id: string
          preferred_month: string | null
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount_needed?: number | null
          assigned_month?: string | null
          created_at?: string
          details?: string | null
          id?: string
          member_id: string
          preferred_month?: string | null
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount_needed?: number | null
          assigned_month?: string | null
          created_at?: string
          details?: string | null
          id?: string
          member_id?: string
          preferred_month?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "priority_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      role_pins: {
        Row: {
          pin_hash: string
          role: string
          updated_at: string
        }
        Insert: {
          pin_hash: string
          role: string
          updated_at?: string
        }
        Update: {
          pin_hash?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      tea_parties: {
        Row: {
          created_at: string
          host_member_id: string | null
          id: string
          menu: string | null
          notes: string | null
          party_date: string
          party_time: string | null
          title: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          host_member_id?: string | null
          id?: string
          menu?: string | null
          notes?: string | null
          party_date: string
          party_time?: string | null
          title: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          host_member_id?: string | null
          id?: string
          menu?: string | null
          notes?: string | null
          party_date?: string
          party_time?: string | null
          title?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tea_parties_host_member_id_fkey"
            columns: ["host_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
