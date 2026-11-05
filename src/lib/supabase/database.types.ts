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
      app_events: {
        Row: {
          created_at: string
          id: number
          name: string
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          props?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arrival_checks: {
        Row: {
          booking_id: string
          delete_after: string
          doctor_id: string
          selfie_path: string
          taken_at: string
        }
        Insert: {
          booking_id: string
          delete_after?: string
          doctor_id: string
          selfie_path: string
          taken_at?: string
        }
        Update: {
          booking_id?: string
          delete_after?: string
          doctor_id?: string
          selfie_path?: string
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arrival_checks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_checks_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          detail: string | null
          id: number
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          detail?: string | null
          id?: number
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          detail?: string | null
          id?: number
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          active: boolean
          city: string
          created_at: string
          doctor_id: string
          from_at: string
          id: string
          min_pay_egp: number | null
          note: string | null
          subspecialty: Database["public"]["Enums"]["subspecialty"] | null
          to_at: string
        }
        Insert: {
          active?: boolean
          city: string
          created_at?: string
          doctor_id: string
          from_at: string
          id?: string
          min_pay_egp?: number | null
          note?: string | null
          subspecialty?: Database["public"]["Enums"]["subspecialty"] | null
          to_at: string
        }
        Update: {
          active?: boolean
          city?: string
          created_at?: string
          doctor_id?: string
          from_at?: string
          id?: string
          min_pay_egp?: number | null
          note?: string | null
          subspecialty?: Database["public"]["Enums"]["subspecialty"] | null
          to_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          arrival_confirmed_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          doctor_completed: boolean
          doctor_id: string
          doctor_no_show: boolean
          id: string
          late_cancel: boolean
          payment_status: Database["public"]["Enums"]["pay_status"]
          poster_completed: boolean
          poster_id: string
          shift_id: string
        }
        Insert: {
          arrival_confirmed_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          doctor_completed?: boolean
          doctor_id: string
          doctor_no_show?: boolean
          id?: string
          late_cancel?: boolean
          payment_status?: Database["public"]["Enums"]["pay_status"]
          poster_completed?: boolean
          poster_id: string
          shift_id: string
        }
        Update: {
          arrival_confirmed_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          doctor_completed?: boolean
          doctor_id?: string
          doctor_no_show?: boolean
          id?: string
          late_cancel?: boolean
          payment_status?: Database["public"]["Enums"]["pay_status"]
          poster_completed?: boolean
          poster_id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_evidence: {
        Row: {
          body: string | null
          created_at: string
          dispute_id: string
          file_path: string | null
          id: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dispute_id: string
          file_path?: string | null
          id?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dispute_id?: string
          file_path?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_evidence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          booking_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          description: string
          id: string
          kind: Database["public"]["Enums"]["dispute_kind"]
          opened_by: string
          outcome: string | null
          resolution: string | null
          response_due_at: string
          status: Database["public"]["Enums"]["dispute_status"]
        }
        Insert: {
          booking_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description: string
          id?: string
          kind: Database["public"]["Enums"]["dispute_kind"]
          opened_by: string
          outcome?: string | null
          resolution?: string | null
          response_due_at?: string
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Update: {
          booking_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["dispute_kind"]
          opened_by?: string
          outcome?: string | null
          resolution?: string | null
          response_due_at?: string
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Relationships: [
          {
            foreignKeyName: "disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          expires_on: string | null
          file_path: string
          id: string
          reject_reason: string | null
          reminded_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["review_status"]
          type: Database["public"]["Enums"]["doc_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_on?: string | null
          file_path: string
          id?: string
          reject_reason?: string | null
          reminded_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          type: Database["public"]["Enums"]["doc_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_on?: string | null
          file_path?: string
          id?: string
          reject_reason?: string | null
          reminded_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          type?: Database["public"]["Enums"]["doc_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          code: string
          group_id: string
        }
        Insert: {
          code?: string
          group_id: string
        }
        Update: {
          code?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          group_id: string
          proof_path: string | null
          requested_at: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          group_id: string
          proof_path?: string | null
          requested_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          group_id?: string
          proof_path?: string | null
          requested_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          hospital_id: string | null
          id: string
          institution: string
          name: string
          proof_path: string | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["group_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          hospital_id?: string | null
          id?: string
          institution: string
          name: string
          proof_path?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["group_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          hospital_id?: string | null
          id?: string
          institution?: string
          name?: string
          proof_path?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["group_status"]
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospital_ratings"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "groups_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_staff: {
        Row: {
          hospital_id: string
          user_id: string
        }
        Insert: {
          hospital_id: string
          user_id: string
        }
        Update: {
          hospital_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_staff_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospital_ratings"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "hospital_staff_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string | null
          area: string | null
          city: string
          contact: string | null
          created_at: string
          id: string
          name: string
          verified: boolean
        }
        Insert: {
          address?: string | null
          area?: string | null
          city: string
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          verified?: boolean
        }
        Update: {
          address?: string | null
          area?: string | null
          city?: string
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          verified?: boolean
        }
        Relationships: []
      }
      logbook_entries: {
        Row: {
          booking_id: string | null
          cases_count: number | null
          created_at: string
          entry_date: string
          hospital_id: string | null
          hospital_name: string | null
          hours: number | null
          id: string
          note: string | null
          subspecialty: Database["public"]["Enums"]["subspecialty"]
          user_id: string
          verified: boolean
        }
        Insert: {
          booking_id?: string | null
          cases_count?: number | null
          created_at?: string
          entry_date: string
          hospital_id?: string | null
          hospital_name?: string | null
          hours?: number | null
          id?: string
          note?: string | null
          subspecialty?: Database["public"]["Enums"]["subspecialty"]
          user_id: string
          verified?: boolean
        }
        Update: {
          booking_id?: string | null
          cases_count?: number | null
          created_at?: string
          entry_date?: string
          hospital_id?: string | null
          hospital_name?: string | null
          hours?: number | null
          id?: string
          note?: string | null
          subspecialty?: Database["public"]["Enums"]["subspecialty"]
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "logbook_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospital_ratings"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "logbook_entries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          booking_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          booking_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          booking_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          email_opt_in: boolean
          language: string
          user_id: string
          whatsapp_number: string | null
          whatsapp_opt_in: boolean
        }
        Insert: {
          email_opt_in?: boolean
          language?: string
          user_id: string
          whatsapp_number?: string | null
          whatsapp_opt_in?: boolean
        }
        Update: {
          email_opt_in?: boolean
          language?: string
          user_id?: string
          whatsapp_number?: string | null
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          message: string | null
          shift_id: string
          status: Database["public"]["Enums"]["offer_status"]
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          message?: string | null
          shift_id: string
          status?: Database["public"]["Enums"]["offer_status"]
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          message?: string | null
          shift_id?: string
          status?: Database["public"]["Enums"]["offer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "offers_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          full_name: string
          grade: string | null
          id: string
          is_admin: boolean
          is_premium: boolean
          max_groups: number
          phone: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["user_status"]
          suspended_reason: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          full_name: string
          grade?: string | null
          id: string
          is_admin?: boolean
          is_premium?: boolean
          max_groups?: number
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          suspended_reason?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          full_name?: string
          grade?: string | null
          id?: string
          is_admin?: boolean
          is_premium?: boolean
          max_groups?: number
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          suspended_reason?: string | null
        }
        Relationships: []
      }
      rating_replies: {
        Row: {
          body: string
          created_at: string
          rating_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          rating_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          rating_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_replies_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: true
            referencedRelation: "ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          from_user: string
          id: string
          score_1: number
          score_2: number
          score_3: number
          to_hospital: string | null
          to_user: string | null
          visible: boolean
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          from_user: string
          id?: string
          score_1: number
          score_2: number
          score_3: number
          to_hospital?: string | null
          to_user?: string | null
          visible?: boolean
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          from_user?: string
          id?: string
          score_1?: number
          score_2?: number
          score_3?: number
          to_hospital?: string | null
          to_user?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_to_hospital_fkey"
            columns: ["to_hospital"]
            isOneToOne: false
            referencedRelation: "hospital_ratings"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "ratings_to_hospital_fkey"
            columns: ["to_hospital"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_templates: {
        Row: {
          active: boolean
          created_at: string
          duration_hours: number
          food_provided: boolean
          group_id: string | null
          has_call_room: boolean
          hospital_id: string
          id: string
          instant_book: boolean
          min_grade: string
          name: string
          notes: string | null
          owner_id: string
          pay_egp: number
          payment: Database["public"]["Enums"]["payment_type"]
          payment_days_after: number | null
          start_time: string
          subspecialty: Database["public"]["Enums"]["subspecialty"]
          support_staff: string | null
          type: Database["public"]["Enums"]["shift_type"]
          weekdays: number[]
          workload: Database["public"]["Enums"]["workload"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          duration_hours: number
          food_provided?: boolean
          group_id?: string | null
          has_call_room?: boolean
          hospital_id: string
          id?: string
          instant_book?: boolean
          min_grade?: string
          name: string
          notes?: string | null
          owner_id: string
          pay_egp: number
          payment?: Database["public"]["Enums"]["payment_type"]
          payment_days_after?: number | null
          start_time: string
          subspecialty?: Database["public"]["Enums"]["subspecialty"]
          support_staff?: string | null
          type?: Database["public"]["Enums"]["shift_type"]
          weekdays: number[]
          workload?: Database["public"]["Enums"]["workload"]
        }
        Update: {
          active?: boolean
          created_at?: string
          duration_hours?: number
          food_provided?: boolean
          group_id?: string | null
          has_call_room?: boolean
          hospital_id?: string
          id?: string
          instant_book?: boolean
          min_grade?: string
          name?: string
          notes?: string | null
          owner_id?: string
          pay_egp?: number
          payment?: Database["public"]["Enums"]["payment_type"]
          payment_days_after?: number | null
          start_time?: string
          subspecialty?: Database["public"]["Enums"]["subspecialty"]
          support_staff?: string | null
          type?: Database["public"]["Enums"]["shift_type"]
          weekdays?: number[]
          workload?: Database["public"]["Enums"]["workload"]
        }
        Relationships: [
          {
            foreignKeyName: "rota_templates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_templates_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospital_ratings"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "rota_templates_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_alerts: {
        Row: {
          city: string | null
          created_at: string
          id: string
          immediate_only: boolean
          min_pay_egp: number | null
          shift_type: Database["public"]["Enums"]["shift_type"] | null
          subspecialty: Database["public"]["Enums"]["subspecialty"] | null
          urgent_only: boolean
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          immediate_only?: boolean
          min_pay_egp?: number | null
          shift_type?: Database["public"]["Enums"]["shift_type"] | null
          subspecialty?: Database["public"]["Enums"]["subspecialty"] | null
          urgent_only?: boolean
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          immediate_only?: boolean
          min_pay_egp?: number | null
          shift_type?: Database["public"]["Enums"]["shift_type"] | null
          subspecialty?: Database["public"]["Enums"]["subspecialty"] | null
          urgent_only?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_invites: {
        Row: {
          created_at: string
          doctor_id: string
          invited_by: string
          shift_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          invited_by: string
          shift_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          invited_by?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_invites_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_invites_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          deal_kind: string
          duration_hours: number
          food_provided: boolean
          group_id: string | null
          has_call_room: boolean
          hospital_id: string
          id: string
          instant_book: boolean
          min_grade: string
          min_reliability_pct: number | null
          min_shifts_done: number
          notes: string | null
          pay_egp: number
          payment: Database["public"]["Enums"]["payment_type"]
          payment_date: string | null
          poster_id: string
          share_token: string | null
          start_at: string
          status: Database["public"]["Enums"]["shift_status"]
          subspecialty: Database["public"]["Enums"]["subspecialty"]
          support_staff: string | null
          swap_note: string | null
          template_id: string | null
          type: Database["public"]["Enums"]["shift_type"]
          urgent: boolean
          workload: Database["public"]["Enums"]["workload"]
        }
        Insert: {
          created_at?: string
          deal_kind?: string
          duration_hours: number
          food_provided?: boolean
          group_id?: string | null
          has_call_room?: boolean
          hospital_id: string
          id?: string
          instant_book?: boolean
          min_grade?: string
          min_reliability_pct?: number | null
          min_shifts_done?: number
          notes?: string | null
          pay_egp: number
          payment: Database["public"]["Enums"]["payment_type"]
          payment_date?: string | null
          poster_id: string
          share_token?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["shift_status"]
          subspecialty?: Database["public"]["Enums"]["subspecialty"]
          support_staff?: string | null
          swap_note?: string | null
          template_id?: string | null
          type: Database["public"]["Enums"]["shift_type"]
          urgent?: boolean
          workload?: Database["public"]["Enums"]["workload"]
        }
        Update: {
          created_at?: string
          deal_kind?: string
          duration_hours?: number
          food_provided?: boolean
          group_id?: string | null
          has_call_room?: boolean
          hospital_id?: string
          id?: string
          instant_book?: boolean
          min_grade?: string
          min_reliability_pct?: number | null
          min_shifts_done?: number
          notes?: string | null
          pay_egp?: number
          payment?: Database["public"]["Enums"]["payment_type"]
          payment_date?: string | null
          poster_id?: string
          share_token?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["shift_status"]
          subspecialty?: Database["public"]["Enums"]["subspecialty"]
          support_staff?: string | null
          swap_note?: string | null
          template_id?: string | null
          type?: Database["public"]["Enums"]["shift_type"]
          urgent?: boolean
          workload?: Database["public"]["Enums"]["workload"]
        }
        Relationships: [
          {
            foreignKeyName: "shifts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospital_ratings"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "shifts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rota_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      work_history: {
        Row: {
          from_year: number | null
          hospital_id: string | null
          hospital_name: string | null
          id: string
          role: string | null
          to_year: number | null
          user_id: string
        }
        Insert: {
          from_year?: number | null
          hospital_id?: string | null
          hospital_name?: string | null
          id?: string
          role?: string | null
          to_year?: number | null
          user_id: string
        }
        Update: {
          from_year?: number | null
          hospital_id?: string | null
          hospital_name?: string | null
          id?: string
          role?: string | null
          to_year?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_history_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospital_ratings"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "work_history_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_metrics_daily: {
        Row: {
          avg_hours_to_fill: number | null
          avg_offers_per_shift: number | null
          day: string | null
          shifts_filled: number | null
          shifts_posted: number | null
        }
        Relationships: []
      }
      admin_repeat_posters: {
        Row: {
          repeat_posters: number | null
          total_posters: number | null
        }
        Relationships: []
      }
      hospital_ratings: {
        Row: {
          hospital_id: string | null
          paid_on_time: number | null
          pay_as_agreed: number | null
          review_count: number | null
          workload_as_described: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_offer: { Args: { p_offer: string }; Returns: string }
      admin_resolve_dispute: {
        Args: {
          p_dispute: string
          p_mark_no_show?: boolean
          p_outcome: string
          p_resolution: string
        }
        Returns: undefined
      }
      admin_review_document: {
        Args: {
          p_approve: boolean
          p_doc: string
          p_expires_on?: string
          p_reason: string
        }
        Returns: undefined
      }
      allow_rejoin: {
        Args: { p_group: string; p_user: string }
        Returns: undefined
      }
      admin_review_group: {
        Args: { p_approve: boolean; p_group: string; p_reason: string }
        Returns: undefined
      }
      cancel_booking: {
        Args: { p_booking: string; p_reason: string }
        Returns: undefined
      }
      candidate_doctors: {
        Args: { p_shift: string }
        Returns: {
          avg_rating: number
          doctor_id: string
          full_name: string
          grade: string
          has_availability: boolean
        }[]
      }
      confirm_arrival: { Args: { p_booking: string }; Returns: undefined }
      create_group: {
        Args: {
          p_description: string
          p_hospital: string
          p_institution: string
          p_name: string
          p_proof_path: string
        }
        Returns: string
      }
      decide_member: {
        Args: { p_accept: boolean; p_group: string; p_user: string }
        Returns: undefined
      }
      doctor_has_overlap: {
        Args: { p_doctor: string; p_shift: string }
        Returns: boolean
      }
      doctor_stats: {
        Args: { p_doctor: string }
        Returns: {
          avg_rating: number
          late_cancels: number
          no_shows: number
          rank_percentile: number
          shifts_done: number
          show_up_pct: number
        }[]
      }
      doctor_trust: {
        Args: { p_doctor: string }
        Returns: {
          badge: string
          confirmed_shifts: number
          docs_verified: boolean
          selfie_verified: boolean
        }[]
      }
      fatigue_check: {
        Args: { p_shift: string }
        Returns: {
          hours_in_window: number
          rest_after_hours: number
          rest_before_hours: number
          warn: boolean
        }[]
      }
      generate_rota: {
        Args: { p_from: string; p_template: string; p_to: string }
        Returns: number
      }
      grade_rank: { Args: { g: string }; Returns: number }
      hospital_report: {
        Args: { p_hospital: string; p_month: string }
        Returns: {
          avg_hours_to_fill: number
          avg_paid_on_time: number
          avg_pay_as_agreed: number
          avg_workload: number
          cancellations: number
          city_median_pay_per_hour: number
          my_median_pay_per_hour: number
          reviews: number
          shifts_filled: number
          shifts_posted: number
        }[]
      }
      instant_book: { Args: { p_shift: string }; Returns: string }
      invite_doctor: {
        Args: { p_doctor: string; p_shift: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      is_booking_party: { Args: { p_booking: string }; Returns: boolean }
      is_group_manager: { Args: { p_group: string }; Returns: boolean }
      is_group_member: { Args: { p_group: string }; Returns: boolean }
      is_premium: { Args: never; Returns: boolean }
      lapse_expired_users: { Args: never; Returns: number }
      leave_group: { Args: { p_group: string }; Returns: undefined }
      readd_member: {
        Args: { p_group: string; p_user: string }
        Returns: undefined
      }
      renew_invite_code: { Args: { p_group: string }; Returns: string }
      my_duty_hours: {
        Args: { p_from: string; p_to: string }
        Returns: {
          day: string
          hours: number
        }[]
      }
      my_pending_requests: {
        Args: never
        Returns: {
          group_id: string
          group_name: string
          requested_at: string
        }[]
      }
      open_dispute: {
        Args: {
          p_booking: string
          p_description: string
          p_kind: Database["public"]["Enums"]["dispute_kind"]
        }
        Returns: string
      }
      pay_benchmark: {
        Args: {
          p_city: string
          p_subspecialty?: Database["public"]["Enums"]["subspecialty"]
          p_type: Database["public"]["Enums"]["shift_type"]
        }
        Returns: {
          median_per_hour: number
          p25_per_hour: number
          p75_per_hour: number
          sample_size: number
        }[]
      }
      queue_expiry_reminders: { Args: never; Returns: number }
      request_to_join: {
        Args: { p_code: string; p_proof_path?: string }
        Returns: string
      }
      roster: {
        Args: { p_from: string; p_hospital: string; p_to: string }
        Returns: {
          doctor_id: string
          doctor_name: string
          duration_hours: number
          shift_id: string
          start_at: string
          status: Database["public"]["Enums"]["shift_status"]
          subspecialty: Database["public"]["Enums"]["subspecialty"]
          urgent: boolean
        }[]
      }
      refuse_offer: { Args: { p_offer: string }; Returns: undefined }
      rotate_invite_code: { Args: { p_group: string }; Returns: string }
      shift_teaser: {
        Args: { p_token: string }
        Returns: {
          city: string
          duration_hours: number
          start_at: string
          subspecialty: Database["public"]["Enums"]["subspecialty"]
          type: Database["public"]["Enums"]["shift_type"]
          urgent: boolean
        }[]
      }
      suggest_doctors_for_shift: {
        Args: { p_limit?: number; p_shift: string }
        Returns: {
          avg_rating: number
          doctor_id: string
          full_name: string
          grade: string
          has_availability: boolean
        }[]
      }
    }
    Enums: {
      dispute_kind: "unpaid" | "no_show" | "rating" | "conduct" | "other"
      dispute_status: "open" | "resolved" | "dismissed"
      doc_type: "syndicate_card" | "license" | "certificate" | "selfie"
      group_status: "pending" | "approved" | "rejected" | "suspended"
      member_role: "owner" | "moderator" | "member"
      member_status: "pending" | "active" | "removed"
      offer_status: "pending" | "accepted" | "refused" | "withdrawn"
      pay_status: "pending" | "paid" | "disputed"
      payment_type: "immediate" | "on_date"
      review_status: "pending" | "approved" | "rejected"
      shift_status: "open" | "filled" | "completed" | "cancelled"
      shift_type: "shift" | "per_case" | "replacement"
      subspecialty:
        | "general"
        | "cardiac"
        | "pediatric"
        | "obstetric"
        | "icu"
        | "regional"
        | "neuro"
        | "other"
      user_status: "pending" | "approved" | "suspended"
      workload: "light" | "moderate" | "heavy"
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
    Enums: {
      dispute_kind: ["unpaid", "no_show", "rating", "conduct", "other"],
      dispute_status: ["open", "resolved", "dismissed"],
      doc_type: ["syndicate_card", "license", "certificate", "selfie"],
      group_status: ["pending", "approved", "rejected", "suspended"],
      member_role: ["owner", "moderator", "member"],
      member_status: ["pending", "active", "removed"],
      offer_status: ["pending", "accepted", "refused", "withdrawn"],
      pay_status: ["pending", "paid", "disputed"],
      payment_type: ["immediate", "on_date"],
      review_status: ["pending", "approved", "rejected"],
      shift_status: ["open", "filled", "completed", "cancelled"],
      shift_type: ["shift", "per_case", "replacement"],
      subspecialty: [
        "general",
        "cardiac",
        "pediatric",
        "obstetric",
        "icu",
        "regional",
        "neuro",
        "other",
      ],
      user_status: ["pending", "approved", "suspended"],
      workload: ["light", "moderate", "heavy"],
    },
  },
} as const
