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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          comment_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          file_name: string
          id: string
          mime_type: string | null
          organization_id: string
          size_bytes: number | null
          storage_path: string
          task_id: string | null
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          organization_id: string
          size_bytes?: number | null
          storage_path: string
          task_id?: string | null
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          size_bytes?: number | null
          storage_path?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          id: number
          ip: unknown
          organization_id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          id?: never
          ip?: unknown
          organization_id: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          id?: never
          ip?: unknown
          organization_id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          project_id: string | null
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          project_id?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          project_id?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          ends_at: string
          event_type: string
          external_calendar_id: string | null
          id: string
          organization_id: string
          project_id: string | null
          starts_at: string
          talent_id: string | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          all_day?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          ends_at: string
          event_type: string
          external_calendar_id?: string | null
          id?: string
          organization_id: string
          project_id?: string | null
          starts_at: string
          talent_id?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          all_day?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          ends_at?: string
          event_type?: string
          external_calendar_id?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          starts_at?: string
          talent_id?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talents"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          published_at: string | null
          talent_id: string
          thumbnail_url: string | null
          title: string | null
          twitch_clip_id: string
          url: string | null
          view_count: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          published_at?: string | null
          talent_id: string
          thumbnail_url?: string | null
          title?: string | null
          twitch_clip_id: string
          url?: string | null
          view_count?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          published_at?: string | null
          talent_id?: string
          thumbnail_url?: string | null
          title?: string | null
          twitch_clip_id?: string
          url?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clips_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talents"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          task_id: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          task_id?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          task_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_drive_items: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          kind: string
          mime_type: string | null
          name: string
          organization_id: string
          parent_id: string | null
          path: string
          size_bytes: number | null
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
          ready_for_twitch: boolean
          asset_kind: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          name: string
          organization_id: string
          parent_id?: string | null
          path?: string
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          ready_for_twitch?: boolean
          asset_kind?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          name?: string
          organization_id?: string
          parent_id?: string | null
          path?: string
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          ready_for_twitch?: boolean
          asset_kind?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_drive_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_drive_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "creative_drive_items"
            referencedColumns: ["id"]
          },
        ]
      }
      design_briefs: {
        Row: {
          id: string
          organization_id: string
          title: string
          talent_id: string | null
          talent_login: string | null
          calendar_event_id: string | null
          deal_id: string | null
          stream_title: string | null
          stream_starts_at: string | null
          body: string
          asset_checklist: string[]
          drive_folder_id: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          title: string
          talent_id?: string | null
          talent_login?: string | null
          calendar_event_id?: string | null
          deal_id?: string | null
          stream_title?: string | null
          stream_starts_at?: string | null
          body?: string
          asset_checklist?: string[]
          drive_folder_id?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          title?: string
          talent_id?: string | null
          talent_login?: string | null
          calendar_event_id?: string | null
          deal_id?: string | null
          stream_title?: string | null
          stream_starts_at?: string | null
          body?: string
          asset_checklist?: string[]
          drive_folder_id?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      design_gap_resolutions: {
        Row: {
          created_at: string
          id: string
          notes: string
          organization_id: string
          resolved_at: string
          resolved_by: string | null
          resolved_by_login: string | null
          talent_id: string | null
          talent_login: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          organization_id: string
          resolved_at?: string
          resolved_by?: string | null
          resolved_by_login?: string | null
          talent_id?: string | null
          talent_login: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          organization_id?: string
          resolved_at?: string
          resolved_by?: string | null
          resolved_by_login?: string | null
          talent_id?: string | null
          talent_login?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_gap_resolutions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_gap_resolutions_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talents"
            referencedColumns: ["id"]
          },
        ]
      }
      design_gap_ignores: {
        Row: {
          created_at: string
          id: string
          ignored_at: string
          ignored_by: string | null
          ignored_by_login: string | null
          notes: string
          organization_id: string
          talent_id: string | null
          talent_login: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ignored_at?: string
          ignored_by?: string | null
          ignored_by_login?: string | null
          notes?: string
          organization_id: string
          talent_id?: string | null
          talent_login: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ignored_at?: string
          ignored_by?: string | null
          ignored_by_login?: string | null
          notes?: string
          organization_id?: string
          talent_id?: string | null
          talent_login?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_gap_ignores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_gap_ignores_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_blocks: {
        Row: {
          content: Json
          created_at: string | null
          deleted_at: string | null
          document_id: string
          id: string
          organization_id: string
          parent_id: string | null
          position: number | null
          type: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          content?: Json
          created_at?: string | null
          deleted_at?: string | null
          document_id: string
          id?: string
          organization_id: string
          parent_id?: string | null
          position?: number | null
          type: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          deleted_at?: string | null
          document_id?: string
          id?: string
          organization_id?: string
          parent_id?: string | null
          position?: number | null
          type?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_blocks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_blocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_blocks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          cover_url: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          file_name: string | null
          icon: string | null
          id: string
          kind: string | null
          mime_type: string | null
          organization_id: string
          parent_id: string | null
          path: string
          size_bytes: number | null
          storage_bucket: string | null
          storage_path: string | null
          talent_id: string | null
          title: string
          updated_at: string | null
          version: number | null
          is_root_custom: boolean
        }
        Insert: {
          category?: string
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          file_name?: string | null
          icon?: string | null
          id?: string
          kind?: string | null
          mime_type?: string | null
          organization_id: string
          parent_id?: string | null
          path?: string
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          talent_id?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
          is_root_custom?: boolean
        }
        Update: {
          category?: string
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          file_name?: string | null
          icon?: string | null
          id?: string
          kind?: string | null
          mime_type?: string | null
          organization_id?: string
          parent_id?: string | null
          path?: string
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          talent_id?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
          is_root_custom?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talents"
            referencedColumns: ["id"]
          },
        ]
      }
      follower_snapshots: {
        Row: {
          captured_at: string
          followers: number
          id: number
          organization_id: string
          talent_id: string
        }
        Insert: {
          captured_at?: string
          followers: number
          id?: never
          organization_id: string
          talent_id: string
        }
        Update: {
          captured_at?: string
          followers?: number
          id?: never
          organization_id?: string
          talent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follower_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follower_snapshots_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talents"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          deleted_at: string | null
          id: string
          organization_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_coverage: {
        Row: {
          id: string
          organization_id: string
          coverage_date: string
          user_id: string | null
          login: string
          display_name: string
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          coverage_date: string
          user_id?: string | null
          login: string
          display_name?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          coverage_date?: string
          user_id?: string | null
          login?: string
          display_name?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_coverage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_day_notes: {
        Row: {
          id: string
          organization_id: string
          note_date: string
          body: string
          owner_user_id: string
          owner_login: string
          assistant_user_id: string | null
          assistant_login: string | null
          updated_by: string | null
          updated_by_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          note_date: string
          body?: string
          owner_user_id: string
          owner_login: string
          assistant_user_id?: string | null
          assistant_login?: string | null
          updated_by?: string | null
          updated_by_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          note_date?: string
          body?: string
          owner_user_id?: string
          owner_login?: string
          assistant_user_id?: string | null
          assistant_login?: string | null
          updated_by?: string | null
          updated_by_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_day_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_event_fichas: {
        Row: {
          id: string
          organization_id: string
          nombre: string
          objetivo: string
          fecha: string | null
          responsable: string
          participantes: string
          contenido_necesario: string
          promocion: string
          recursos: string
          aprobacion_directiva: string
          estado: string
          created_by: string | null
          created_by_login: string | null
          updated_by: string | null
          updated_by_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          nombre: string
          objetivo?: string
          fecha?: string | null
          responsable?: string
          participantes?: string
          contenido_necesario?: string
          promocion?: string
          recursos?: string
          aprobacion_directiva?: string
          estado?: string
          created_by?: string | null
          created_by_login?: string | null
          updated_by?: string | null
          updated_by_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          nombre?: string
          objetivo?: string
          fecha?: string | null
          responsable?: string
          participantes?: string
          contenido_necesario?: string
          promocion?: string
          recursos?: string
          aprobacion_directiva?: string
          estado?: string
          created_by?: string | null
          created_by_login?: string | null
          updated_by?: string | null
          updated_by_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_event_fichas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_owner_assistant_links: {
        Row: {
          id: string
          organization_id: string
          owner_user_id: string
          owner_login: string
          assistant_user_id: string
          assistant_login: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          owner_user_id: string
          owner_login: string
          assistant_user_id: string
          assistant_login: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          owner_user_id?: string
          owner_login?: string
          assistant_user_id?: string
          assistant_login?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_owner_assistant_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          ends_at: string | null
          id: string
          name: string
          organization_id: string
          space_id: string | null
          starts_at: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          organization_id: string
          space_id?: string | null
          starts_at?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          space_id?: string | null
          starts_at?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: string
          name: Database["public"]["Enums"]["app_role"]
          permissions: Json
        }
        Insert: {
          id?: string
          name: Database["public"]["Enums"]["app_role"]
          permissions?: Json
        }
        Update: {
          id?: string
          name?: Database["public"]["Enums"]["app_role"]
          permissions?: Json
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          organization_id: string
          updated_at: string | null
          user_id: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          organization_id: string
          updated_at?: string | null
          user_id?: string | null
          value?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          organization_id?: string
          updated_at?: string | null
          user_id?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string
          deleted_at: string | null
          icon: string | null
          id: string
          name: string
          organization_id: string
          position: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          name: string
          organization_id: string
          position?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string
          position?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_metrics: {
        Row: {
          captured_at: string
          followers: number | null
          id: number
          organization_id: string
          session_id: string
          subscribers: number | null
          viewers: number
        }
        Insert: {
          captured_at?: string
          followers?: number | null
          id?: never
          organization_id: string
          session_id: string
          subscribers?: number | null
          viewers: number
        }
        Update: {
          captured_at?: string
          followers?: number | null
          id?: never
          organization_id?: string
          session_id?: string
          subscribers?: number | null
          viewers?: number
        }
        Relationships: [
          {
            foreignKeyName: "stream_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stream_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_sessions: {
        Row: {
          average_viewers: number | null
          category_id: string | null
          category_name: string | null
          created_at: string
          deleted_at: string | null
          ended_at: string | null
          id: string
          organization_id: string
          peak_viewers: number
          started_at: string
          talent_id: string
          title: string | null
          twitch_stream_id: string | null
          updated_at: string
        }
        Insert: {
          average_viewers?: number | null
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          organization_id: string
          peak_viewers?: number
          started_at: string
          talent_id: string
          title?: string | null
          twitch_stream_id?: string | null
          updated_at?: string
        }
        Update: {
          average_viewers?: number | null
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          organization_id?: string
          peak_viewers?: number
          started_at?: string
          talent_id?: string
          title?: string | null
          twitch_stream_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_sessions_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talents"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          completed: boolean | null
          created_at: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          position: number | null
          task_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          position?: number | null
          task_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          position?: number | null
          task_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      talents: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          display_name: string
          id: string
          login: string
          metadata: Json
          notes: string | null
          organization_id: string
          twitch_created_at: string | null
          twitch_user_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          login: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          twitch_created_at?: string | null
          twitch_user_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          login?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          twitch_created_at?: string | null
          twitch_user_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "talents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_at: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          depends_on_id: string
          task_id: string
        }
        Insert: {
          depends_on_id: string
          task_id: string
        }
        Update: {
          depends_on_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_id_fkey"
            columns: ["depends_on_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_priority: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          level: Database["public"]["Enums"]["task_priority_level"]
          name: string
          organization_id: string
          position: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          level: Database["public"]["Enums"]["task_priority_level"]
          name: string
          organization_id: string
          position?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          level?: Database["public"]["Enums"]["task_priority_level"]
          name?: string
          organization_id?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_priority_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          position: number | null
          state: Database["public"]["Enums"]["task_state"]
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          position?: number | null
          state: Database["public"]["Enums"]["task_state"]
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          position?: number | null
          state?: Database["public"]["Enums"]["task_state"]
        }
        Relationships: [
          {
            foreignKeyName: "task_status_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          tag_id: string
          task_id: string
        }
        Insert: {
          tag_id: string
          task_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          board_id: string | null
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_at: string | null
          estimate_minutes: number | null
          id: string
          organization_id: string
          parent_id: string | null
          position: number
          priority_id: string | null
          project_id: string | null
          starts_at: string | null
          status_id: string | null
          title: string
          tracked_minutes: number
          updated_at: string
          version: number
        }
        Insert: {
          assigned_by?: string | null
          board_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          estimate_minutes?: number | null
          id?: string
          organization_id: string
          parent_id?: string | null
          position?: number
          priority_id?: string | null
          project_id?: string | null
          starts_at?: string | null
          status_id?: string | null
          title: string
          tracked_minutes?: number
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_by?: string | null
          board_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          estimate_minutes?: number | null
          id?: string
          organization_id?: string
          parent_id?: string | null
          position?: number
          priority_id?: string | null
          project_id?: string | null
          starts_at?: string | null
          status_id?: string | null
          title?: string
          tracked_minutes?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_priority_id_fkey"
            columns: ["priority_id"]
            isOneToOne: false
            referencedRelation: "task_priority"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "task_status"
            referencedColumns: ["id"]
          },
        ]
      }
      twitch_accounts: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_name: string | null
          encrypted_access_token: string
          encrypted_refresh_token: string
          expires_at: string
          id: string
          organization_id: string
          scopes: string[]
          twitch_user_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          encrypted_access_token: string
          encrypted_refresh_token: string
          expires_at: string
          id?: string
          organization_id: string
          scopes?: string[]
          twitch_user_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          encrypted_access_token?: string
          encrypted_refresh_token?: string
          expires_at?: string
          id?: string
          organization_id?: string
          scopes?: string[]
          twitch_user_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twitch_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twitch_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role_id: string
          user_id: string
        }
        Insert: {
          role_id: string
          user_id: string
        }
        Update: {
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          organization_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id: string
          organization_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          organization_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      viewer_snapshots: {
        Row: {
          captured_at: string
          id: number
          organization_id: string
          talent_id: string
          viewers: number
        }
        Insert: {
          captured_at?: string
          id?: never
          organization_id: string
          talent_id: string
          viewers: number
        }
        Update: {
          captured_at?: string
          id?: never
          organization_id?: string
          talent_id?: string
          viewers?: number
        }
        Relationships: [
          {
            foreignKeyName: "viewer_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewer_snapshots_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talents"
            referencedColumns: ["id"]
          },
        ]
      }
      vods: {
        Row: {
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          id: string
          organization_id: string
          published_at: string | null
          talent_id: string
          title: string | null
          twitch_video_id: string
          url: string | null
          view_count: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          id?: string
          organization_id: string
          published_at?: string | null
          talent_id: string
          title?: string | null
          twitch_video_id: string
          url?: string | null
          view_count?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          id?: string
          organization_id?: string
          published_at?: string | null
          talent_id?: string
          title?: string | null
          twitch_video_id?: string
          url?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vods_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      talent_daily_metrics: {
        Row: {
          average_viewers: number | null
          follower_growth: number | null
          metric_day: string | null
          organization_id: string | null
          peak_viewers: number | null
          talent_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stream_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_sessions_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      dashboard_metrics: { Args: { period_start?: string }; Returns: Json }
      health_ping: {
        Args: Record<string, never>
        Returns: {
          ok: boolean
          server_time: string
          roles_count: number
          talents_count: number
          app_users_count: number
        }
      }
      log_activity: {
        Args: {
          p_entity_type: string
          p_entity_id?: string | null
          p_action: string
          p_metadata?: Json
        }
        Returns: number
      }
      lookup_activity_actors: {
        Args: { p_ids: string[] }
        Returns: {
          auth_user_id: string
          display_name: string | null
          twitch_login: string | null
        }[]
      }
      sync_auth_user_from_app: {
        Args: { p_auth_user_id: string; p_org_id?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "staff" | "dev" | "designer" | "league_manager" | "coach" | "analyst" | "player"
      task_priority_level: "low" | "medium" | "high" | "urgent"
      task_state: "backlog" | "progress" | "review" | "done" | "archived"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["owner", "admin", "manager", "staff", "dev", "designer", "league_manager", "coach", "analyst", "player"],
      task_priority_level: ["low", "medium", "high", "urgent"],
      task_state: ["backlog", "progress", "review", "done", "archived"],
    },
  },
} as const

