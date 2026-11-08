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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_actions: {
        Row: {
          action_type: string
          created_at: string
          executed_at: string | null
          id: string
          insight_id: string
          payload: Json | null
          result: string | null
          status: string
        }
        Insert: {
          action_type: string
          created_at?: string
          executed_at?: string | null
          id?: string
          insight_id: string
          payload?: Json | null
          result?: string | null
          status?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          executed_at?: string | null
          id?: string
          insight_id?: string
          payload?: Json | null
          result?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "ai_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      ai_insight_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          insight_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          insight_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          insight_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insight_messages_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "ai_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          area: string
          confidence: number
          created_at: string
          decision: Json | null
          description: string | null
          id: string
          impact: number
          risk: number
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area: string
          confidence?: number
          created_at?: string
          decision?: Json | null
          description?: string | null
          id?: string
          impact?: number
          risk?: number
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string
          confidence?: number
          created_at?: string
          decision?: Json | null
          description?: string | null
          id?: string
          impact?: number
          risk?: number
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_policies: {
        Row: {
          area: string
          autopilot: boolean
          created_at: string
          id: string
          max_risk: number
          updated_at: string
        }
        Insert: {
          area: string
          autopilot?: boolean
          created_at?: string
          id?: string
          max_risk?: number
          updated_at?: string
        }
        Update: {
          area?: string
          autopilot?: boolean
          created_at?: string
          id?: string
          max_risk?: number
          updated_at?: string
        }
        Relationships: []
      }
      amendoim_sealed_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_key: string
          grams_delta: number
          grams_new: number
          grams_previous: number
          id: string
          movement_type: string
          new_balance: number
          notes: string | null
          previous_balance: number
          reference_id: string
          reference_type: string
          sacks: number
          storage_location_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_key: string
          grams_delta: number
          grams_new: number
          grams_previous: number
          id?: string
          movement_type: string
          new_balance: number
          notes?: string | null
          previous_balance: number
          reference_id: string
          reference_type: string
          sacks: number
          storage_location_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_key?: string
          grams_delta?: number
          grams_new?: number
          grams_previous?: number
          id?: string
          movement_type?: string
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          reference_id?: string
          reference_type?: string
          sacks?: number
          storage_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amendoim_sealed_events_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      amendoim_sealed_stock: {
        Row: {
          sacks: number
          storage_location_id: string
          updated_at: string
        }
        Insert: {
          sacks?: number
          storage_location_id: string
          updated_at?: string
        }
        Update: {
          sacks?: number
          storage_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amendoim_sealed_stock_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: true
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_users: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          role: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          role?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          role?: string | null
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          action_result: Json | null
          id: string
          rule_id: string
          status: string
          task_id: string | null
          trigger_data: Json | null
          triggered_at: string
        }
        Insert: {
          action_result?: Json | null
          id?: string
          rule_id: string
          status?: string
          task_id?: string | null
          trigger_data?: Json | null
          triggered_at?: string
        }
        Update: {
          action_result?: Json | null
          id?: string
          rule_id?: string
          status?: string
          task_id?: string | null
          trigger_data?: Json | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_applications: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          authenticated_identity_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          idea_id: string
          metric_name: string
          metric_unit: string
          objective: string
          owner_user_id: string
          status: string
          success_definition: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          authenticated_identity_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          idea_id: string
          metric_name: string
          metric_unit: string
          objective: string
          owner_user_id: string
          status?: string
          success_definition: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          authenticated_identity_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          idea_id?: string
          metric_name?: string
          metric_unit?: string
          objective?: string
          owner_user_id?: string
          status?: string
          success_definition?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_applications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_applications_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_applications_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "digital_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_applications_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_evidence: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string
          description: string | null
          execution_id: string
          id: string
          kind: string
          url: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by: string
          description?: string | null
          execution_id: string
          id?: string
          kind?: string
          url?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          execution_id?: string
          id?: string
          kind?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_evidence_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_evidence_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_evidence_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "campaign_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_executions: {
        Row: {
          campaign_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          id: string
          planned_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          planned_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          planned_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_executions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_executions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_executions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_learnings: {
        Row: {
          campaign_id: string
          content: string
          created_at: string
          created_by: string
          id: string
        }
        Insert: {
          campaign_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_learnings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_learnings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_metrics: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string
          execution_id: string | null
          id: string
          measured_at: string
          metric_name: string
          metric_unit: string
          metric_value: number
          note: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by: string
          execution_id?: string | null
          id?: string
          measured_at?: string
          metric_name: string
          metric_unit: string
          metric_value: number
          note?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string
          execution_id?: string | null
          id?: string
          measured_at?: string
          metric_name?: string
          metric_unit?: string
          metric_value?: number
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_metrics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_metrics_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "campaign_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_accounts: {
        Row: {
          created_at: string
          external_identifier: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          platform_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_identifier?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          platform_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_identifier?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          platform_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_accounts_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      chocolate_sealed_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_key: string
          id: string
          movement_type: string
          new_balance: number
          notes: string | null
          previous_balance: number
          reference_id: string | null
          reference_type: string
          sacks: number
          storage_location_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_key: string
          id?: string
          movement_type: string
          new_balance: number
          notes?: string | null
          previous_balance: number
          reference_id?: string | null
          reference_type: string
          sacks: number
          storage_location_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_key?: string
          id?: string
          movement_type?: string
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          reference_id?: string | null
          reference_type?: string
          sacks?: number
          storage_location_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chocolate_sealed_events_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chocolate_sealed_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      chocolate_sealed_stock: {
        Row: {
          sacks: number
          storage_location_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          sacks?: number
          storage_location_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          sacks?: number
          storage_location_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chocolate_sealed_stock_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chocolate_sealed_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_presentation_components: {
        Row: {
          id: string
          presentation_id: string
          product_id: string
          quantity: number
          variant_id: string
        }
        Insert: {
          id?: string
          presentation_id: string
          product_id: string
          quantity: number
          variant_id: string
        }
        Update: {
          id?: string
          presentation_id?: string
          product_id?: string
          quantity?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_presentation_components_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "commercial_presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_presentation_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_presentation_components_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_presentations: {
        Row: {
          commercial_unit_label: string
          composition_mode: string
          conversion_factor: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          product_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          commercial_unit_label: string
          composition_mode?: string
          conversion_factor: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          product_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          commercial_unit_label?: string
          composition_mode?: string
          conversion_factor?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          product_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_presentations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_presentations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_activities: {
        Row: {
          activity_type: string
          completed_at: string | null
          contact_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          title: string
        }
        Insert: {
          activity_type?: string
          completed_at?: string | null
          contact_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          title: string
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_history: {
        Row: {
          contact_id: string
          created_at: string
          description: string
          event_code: string | null
          event_metadata: Json
          event_type: string
          id: string
          interaction_date: string | null
          interaction_type: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          description: string
          event_code?: string | null
          event_metadata?: Json
          event_type?: string
          id?: string
          interaction_date?: string | null
          interaction_type?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          description?: string
          event_code?: string | null
          event_metadata?: Json
          event_type?: string
          id?: string
          interaction_date?: string | null
          interaction_type?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tag_assignments: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tag_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "contact_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          avg_load_percentage: number | null
          billing_address: string | null
          billing_city: string | null
          billing_complement: string | null
          billing_neighborhood: string | null
          billing_number: string | null
          billing_state: string | null
          billing_zip_code: string | null
          birth_date: string | null
          birthplace: string | null
          campaign_idea_id: string | null
          category: string | null
          city: string | null
          client_classification: string | null
          code: string | null
          commercial_opt_out: boolean
          company_name: string | null
          contact_info: string | null
          contact_people: Json | null
          contact_type: string | null
          converted_at: string | null
          created_at: string
          credit_limit_type: string | null
          credit_limit_value: number | null
          customer_since: string | null
          default_operation_nature: string | null
          document: string | null
          email: string | null
          fantasy_name: string | null
          father_cpf: string | null
          father_name: string | null
          fax: string | null
          funnel_status: string | null
          gender: string | null
          id: string
          is_active: boolean
          issuing_agency: string | null
          landline: string | null
          last_payment_date: string | null
          last_purchase_date: string | null
          lifetime_value: number
          lost_at: string | null
          lost_reason: string | null
          lost_reason_detail: string | null
          marital_status: string | null
          mobile: string | null
          mobile_carrier: string | null
          mother_cpf: string | null
          mother_name: string | null
          name: string
          neighborhood: string | null
          next_action_date: string | null
          next_action_text: string | null
          next_contact_date: string | null
          next_visit: string | null
          nfe_email: string | null
          notes: string | null
          origem_lead: string | null
          paid_orders_count: number
          payment_condition: string | null
          person_type: string | null
          phone: string | null
          phone_normalized: string | null
          photo_url: string | null
          profession: string | null
          rg: string | null
          sales_channels: Json | null
          salesperson: string | null
          skype: string | null
          state: string | null
          state_registration: string | null
          taxpayer_type: string | null
          temperatura_lead: string | null
          type: string
          ultimo_contato: string | null
          updated_at: string
          valor_estimado: number | null
          website: string | null
          whatsapp: string | null
          whatsapp_photo_synced_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          avg_load_percentage?: number | null
          billing_address?: string | null
          billing_city?: string | null
          billing_complement?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          billing_zip_code?: string | null
          birth_date?: string | null
          birthplace?: string | null
          campaign_idea_id?: string | null
          category?: string | null
          city?: string | null
          client_classification?: string | null
          code?: string | null
          commercial_opt_out?: boolean
          company_name?: string | null
          contact_info?: string | null
          contact_people?: Json | null
          contact_type?: string | null
          converted_at?: string | null
          created_at?: string
          credit_limit_type?: string | null
          credit_limit_value?: number | null
          customer_since?: string | null
          default_operation_nature?: string | null
          document?: string | null
          email?: string | null
          fantasy_name?: string | null
          father_cpf?: string | null
          father_name?: string | null
          fax?: string | null
          funnel_status?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean
          issuing_agency?: string | null
          landline?: string | null
          last_payment_date?: string | null
          last_purchase_date?: string | null
          lifetime_value?: number
          lost_at?: string | null
          lost_reason?: string | null
          lost_reason_detail?: string | null
          marital_status?: string | null
          mobile?: string | null
          mobile_carrier?: string | null
          mother_cpf?: string | null
          mother_name?: string | null
          name: string
          neighborhood?: string | null
          next_action_date?: string | null
          next_action_text?: string | null
          next_contact_date?: string | null
          next_visit?: string | null
          nfe_email?: string | null
          notes?: string | null
          origem_lead?: string | null
          paid_orders_count?: number
          payment_condition?: string | null
          person_type?: string | null
          phone?: string | null
          phone_normalized?: string | null
          photo_url?: string | null
          profession?: string | null
          rg?: string | null
          sales_channels?: Json | null
          salesperson?: string | null
          skype?: string | null
          state?: string | null
          state_registration?: string | null
          taxpayer_type?: string | null
          temperatura_lead?: string | null
          type?: string
          ultimo_contato?: string | null
          updated_at?: string
          valor_estimado?: number | null
          website?: string | null
          whatsapp?: string | null
          whatsapp_photo_synced_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          avg_load_percentage?: number | null
          billing_address?: string | null
          billing_city?: string | null
          billing_complement?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          billing_zip_code?: string | null
          birth_date?: string | null
          birthplace?: string | null
          campaign_idea_id?: string | null
          category?: string | null
          city?: string | null
          client_classification?: string | null
          code?: string | null
          commercial_opt_out?: boolean
          company_name?: string | null
          contact_info?: string | null
          contact_people?: Json | null
          contact_type?: string | null
          converted_at?: string | null
          created_at?: string
          credit_limit_type?: string | null
          credit_limit_value?: number | null
          customer_since?: string | null
          default_operation_nature?: string | null
          document?: string | null
          email?: string | null
          fantasy_name?: string | null
          father_cpf?: string | null
          father_name?: string | null
          fax?: string | null
          funnel_status?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean
          issuing_agency?: string | null
          landline?: string | null
          last_payment_date?: string | null
          last_purchase_date?: string | null
          lifetime_value?: number
          lost_at?: string | null
          lost_reason?: string | null
          lost_reason_detail?: string | null
          marital_status?: string | null
          mobile?: string | null
          mobile_carrier?: string | null
          mother_cpf?: string | null
          mother_name?: string | null
          name?: string
          neighborhood?: string | null
          next_action_date?: string | null
          next_action_text?: string | null
          next_contact_date?: string | null
          next_visit?: string | null
          nfe_email?: string | null
          notes?: string | null
          origem_lead?: string | null
          paid_orders_count?: number
          payment_condition?: string | null
          person_type?: string | null
          phone?: string | null
          phone_normalized?: string | null
          photo_url?: string | null
          profession?: string | null
          rg?: string | null
          sales_channels?: Json | null
          salesperson?: string | null
          skype?: string | null
          state?: string | null
          state_registration?: string | null
          taxpayer_type?: string | null
          temperatura_lead?: string | null
          type?: string
          ultimo_contato?: string | null
          updated_at?: string
          valor_estimado?: number | null
          website?: string | null
          whatsapp?: string | null
          whatsapp_photo_synced_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_campaign_idea_id_fkey"
            columns: ["campaign_idea_id"]
            isOneToOne: false
            referencedRelation: "digital_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaign_recipient_reconciliations: {
        Row: {
          actor_app_user_id: string
          actor_auth_user_id: string
          after_status: string
          before_status: string
          campaign_id: string
          evidence_delivery_status: string
          evidence_snapshot: Json
          id: string
          provider_message_id: string
          recipient_id: string
          reconciled_at: string
          service_message_id: string
        }
        Insert: {
          actor_app_user_id: string
          actor_auth_user_id: string
          after_status: string
          before_status: string
          campaign_id: string
          evidence_delivery_status: string
          evidence_snapshot: Json
          id?: string
          provider_message_id: string
          recipient_id: string
          reconciled_at?: string
          service_message_id: string
        }
        Update: {
          actor_app_user_id?: string
          actor_auth_user_id?: string
          after_status?: string
          before_status?: string
          campaign_id?: string
          evidence_delivery_status?: string
          evidence_snapshot?: Json
          id?: string
          provider_message_id?: string
          recipient_id?: string
          reconciled_at?: string
          service_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_recipient_reconciliations_actor_app_user_id_fkey"
            columns: ["actor_app_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_recipient_reconciliations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_recipient_reconciliations_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: true
            referencedRelation: "crm_campaign_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_recipient_reconciliations_service_message_id_fkey"
            columns: ["service_message_id"]
            isOneToOne: false
            referencedRelation: "service_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string
          conversation_id: string | null
          created_at: string
          delivery_mode: string | null
          error_code: string | null
          error_message: string | null
          exclusion_reason: string | null
          external_message_id: string | null
          id: string
          phone_normalized: string | null
          rendered_message: string | null
          sent_at: string | null
          service_message_id: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          contact_id: string
          conversation_id?: string | null
          created_at?: string
          delivery_mode?: string | null
          error_code?: string | null
          error_message?: string | null
          exclusion_reason?: string | null
          external_message_id?: string | null
          id?: string
          phone_normalized?: string | null
          rendered_message?: string | null
          sent_at?: string | null
          service_message_id?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          conversation_id?: string | null
          created_at?: string
          delivery_mode?: string | null
          error_code?: string | null
          error_message?: string | null
          exclusion_reason?: string | null
          external_message_id?: string | null
          id?: string
          phone_normalized?: string | null
          rendered_message?: string | null
          sent_at?: string | null
          service_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message_text: string
          name: string
          segment_filters: Json | null
          started_at: string | null
          status: string
          total_eligible: number
          total_excluded: number
          total_failed: number
          total_selected: number
          total_sent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_text: string
          name: string
          segment_filters?: Json | null
          started_at?: string | null
          status?: string
          total_eligible?: number
          total_excluded?: number
          total_failed?: number
          total_selected?: number
          total_sent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_text?: string
          name?: string
          segment_filters?: Json | null
          started_at?: string | null
          status?: string
          total_eligible?: number
          total_excluded?: number
          total_failed?: number
          total_selected?: number
          total_sent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_routes: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          driver_name: string | null
          id: string
          name: string
          notes: string | null
          origin_address: string | null
          route_type: string
          scheduled_date: string | null
          started_at: string | null
          status: string
          updated_at: string
          vehicle: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          driver_name?: string | null
          id?: string
          name: string
          notes?: string | null
          origin_address?: string | null
          route_type?: string
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          driver_name?: string | null
          id?: string
          name?: string
          notes?: string | null
          origin_address?: string | null
          route_type?: string
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle?: string | null
        }
        Relationships: []
      }
      delivery_stops: {
        Row: {
          address: string
          address_number: string | null
          city: string | null
          complement: string | null
          contact_id: string | null
          created_at: string
          customer_name: string | null
          delivered_at: string | null
          delivery_notes: string | null
          failure_reason: string | null
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          notes: string | null
          order_id: string | null
          order_index: number
          phone: string | null
          photo_url: string | null
          reference_point: string | null
          route_id: string
          signature_url: string | null
          state: string | null
          status: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address: string
          address_number?: string | null
          city?: string | null
          complement?: string | null
          contact_id?: string | null
          created_at?: string
          customer_name?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          failure_reason?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          notes?: string | null
          order_id?: string | null
          order_index?: number
          phone?: string | null
          photo_url?: string | null
          reference_point?: string | null
          route_id: string
          signature_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string
          address_number?: string | null
          city?: string | null
          complement?: string | null
          contact_id?: string | null
          created_at?: string
          customer_name?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          failure_reason?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          notes?: string | null
          order_id?: string | null
          order_index?: number
          phone?: string | null
          photo_url?: string | null
          reference_point?: string | null
          route_id?: string
          signature_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_idea_types: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          is_default: boolean
          key: string
          label: string
          order_index: number
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          key: string
          label: string
          order_index?: number
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          key?: string
          label?: string
          order_index?: number
        }
        Relationships: []
      }
      digital_ideas: {
        Row: {
          action_tags: Json | null
          created_at: string
          custom_field_values: Json | null
          custom_fields: Json | null
          id: string
          idea_type: string
          key_message: string | null
          kpi: string | null
          media_urls: Json | null
          node_id: string | null
          objective: string | null
          order_index: number | null
          product_id: string | null
          seasonal_date: string | null
          seasonal_day_id: string | null
          serial_number: string | null
          status: string
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_tags?: Json | null
          created_at?: string
          custom_field_values?: Json | null
          custom_fields?: Json | null
          id?: string
          idea_type?: string
          key_message?: string | null
          kpi?: string | null
          media_urls?: Json | null
          node_id?: string | null
          objective?: string | null
          order_index?: number | null
          product_id?: string | null
          seasonal_date?: string | null
          seasonal_day_id?: string | null
          serial_number?: string | null
          status?: string
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_tags?: Json | null
          created_at?: string
          custom_field_values?: Json | null
          custom_fields?: Json | null
          id?: string
          idea_type?: string
          key_message?: string | null
          kpi?: string | null
          media_urls?: Json | null
          node_id?: string | null
          objective?: string | null
          order_index?: number | null
          product_id?: string | null
          seasonal_date?: string | null
          seasonal_day_id?: string | null
          serial_number?: string | null
          status?: string
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_ideas_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_ideas_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_ideas_seasonal_day_id_fkey"
            columns: ["seasonal_day_id"]
            isOneToOne: false
            referencedRelation: "seasonal_days"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_interactions: {
        Row: {
          actual_response: string | null
          ai_suggested_response: string | null
          contact_handle: string | null
          contact_name: string | null
          content: string
          created_at: string
          funnel_stage: string
          id: string
          interaction_type: string
          platform_id: string | null
          responded_at: string | null
          status: string
          updated_at: string
          variation_id: string | null
        }
        Insert: {
          actual_response?: string | null
          ai_suggested_response?: string | null
          contact_handle?: string | null
          contact_name?: string | null
          content: string
          created_at?: string
          funnel_stage?: string
          id?: string
          interaction_type?: string
          platform_id?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
          variation_id?: string | null
        }
        Update: {
          actual_response?: string | null
          ai_suggested_response?: string | null
          contact_handle?: string | null
          contact_name?: string | null
          content?: string
          created_at?: string
          funnel_stage?: string
          id?: string
          interaction_type?: string
          platform_id?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "digital_interactions_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_interactions_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "digital_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_knowledge_base: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[] | null
          platform_id: string | null
          question: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          platform_id?: string | null
          question: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          platform_id?: string | null
          question?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "digital_knowledge_base_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_media: {
        Row: {
          ai_enhanced: boolean | null
          created_at: string
          enhancement_type: string | null
          file_size: number | null
          file_type: string | null
          filename: string | null
          folder_id: string | null
          id: string
          idea_id: string | null
          is_product_cover: boolean
          original_url: string | null
          parent_media_id: string | null
          product_id: string | null
          quality_status: string | null
          tags: string[] | null
          url: string
          variation_id: string | null
          version: number | null
        }
        Insert: {
          ai_enhanced?: boolean | null
          created_at?: string
          enhancement_type?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string | null
          folder_id?: string | null
          id?: string
          idea_id?: string | null
          is_product_cover?: boolean
          original_url?: string | null
          parent_media_id?: string | null
          product_id?: string | null
          quality_status?: string | null
          tags?: string[] | null
          url: string
          variation_id?: string | null
          version?: number | null
        }
        Update: {
          ai_enhanced?: boolean | null
          created_at?: string
          enhancement_type?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string | null
          folder_id?: string | null
          id?: string
          idea_id?: string | null
          is_product_cover?: boolean
          original_url?: string | null
          parent_media_id?: string | null
          product_id?: string | null
          quality_status?: string | null
          tags?: string[] | null
          url?: string
          variation_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "digital_media_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "digital_media_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_media_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "digital_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_media_parent_media_id_fkey"
            columns: ["parent_media_id"]
            isOneToOne: false
            referencedRelation: "digital_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_media_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "digital_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_media_folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          order_index: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          order_index?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          order_index?: number | null
        }
        Relationships: []
      }
      digital_platform_groups: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      digital_platforms: {
        Row: {
          aspect_ratio: string | null
          checklist_template: Json | null
          created_at: string
          custom_fields: Json | null
          duration: string | null
          fields: string[] | null
          group_id: string | null
          group_type: string
          icon: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          parent_id: string | null
          platform_replica: Json
          structure_media_urls: Json
          updated_at: string
        }
        Insert: {
          aspect_ratio?: string | null
          checklist_template?: Json | null
          created_at?: string
          custom_fields?: Json | null
          duration?: string | null
          fields?: string[] | null
          group_id?: string | null
          group_type?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          parent_id?: string | null
          platform_replica?: Json
          structure_media_urls?: Json
          updated_at?: string
        }
        Update: {
          aspect_ratio?: string | null
          checklist_template?: Json | null
          created_at?: string
          custom_fields?: Json | null
          duration?: string | null
          fields?: string[] | null
          group_id?: string | null
          group_type?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          parent_id?: string | null
          platform_replica?: Json
          structure_media_urls?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_platforms_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "digital_platform_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_platforms_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_templates: {
        Row: {
          checklist_template: Json | null
          config: Json | null
          created_at: string
          id: string
          name: string
          platform: string
        }
        Insert: {
          checklist_template?: Json | null
          config?: Json | null
          created_at?: string
          id?: string
          name: string
          platform: string
        }
        Update: {
          checklist_template?: Json | null
          config?: Json | null
          created_at?: string
          id?: string
          name?: string
          platform?: string
        }
        Relationships: []
      }
      digital_trends: {
        Row: {
          created_at: string
          id: string
          insights: string | null
          niche: string | null
          query: string
          results: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          insights?: string | null
          niche?: string | null
          query: string
          results?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          insights?: string | null
          niche?: string | null
          query?: string
          results?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      digital_variations: {
        Row: {
          additional_dates: Json | null
          aspect_ratio: string | null
          caption: string | null
          chapters: string | null
          checklist: Json | null
          cover_url: string | null
          created_at: string
          cta: string | null
          custom_field_values: Json | null
          description: string | null
          duration_seconds: number | null
          extra_media_ids: Json | null
          hashtags: string | null
          hidden_inherited_media: Json | null
          id: string
          idea_id: string
          is_posted: boolean
          is_template: boolean | null
          link: string | null
          media_mode: string | null
          media_transforms: Json | null
          media_urls: Json | null
          metric_clicks: number | null
          metric_ctr: number | null
          metric_engagement: number | null
          metric_reach: number | null
          metric_retention: number | null
          music: string | null
          order_index: number | null
          platform: string
          playlist: string | null
          resolution: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string
          tags: string | null
          template_name: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          additional_dates?: Json | null
          aspect_ratio?: string | null
          caption?: string | null
          chapters?: string | null
          checklist?: Json | null
          cover_url?: string | null
          created_at?: string
          cta?: string | null
          custom_field_values?: Json | null
          description?: string | null
          duration_seconds?: number | null
          extra_media_ids?: Json | null
          hashtags?: string | null
          hidden_inherited_media?: Json | null
          id?: string
          idea_id: string
          is_posted?: boolean
          is_template?: boolean | null
          link?: string | null
          media_mode?: string | null
          media_transforms?: Json | null
          media_urls?: Json | null
          metric_clicks?: number | null
          metric_ctr?: number | null
          metric_engagement?: number | null
          metric_reach?: number | null
          metric_retention?: number | null
          music?: string | null
          order_index?: number | null
          platform: string
          playlist?: string | null
          resolution?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          tags?: string | null
          template_name?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          additional_dates?: Json | null
          aspect_ratio?: string | null
          caption?: string | null
          chapters?: string | null
          checklist?: Json | null
          cover_url?: string | null
          created_at?: string
          cta?: string | null
          custom_field_values?: Json | null
          description?: string | null
          duration_seconds?: number | null
          extra_media_ids?: Json | null
          hashtags?: string | null
          hidden_inherited_media?: Json | null
          id?: string
          idea_id?: string
          is_posted?: boolean
          is_template?: boolean | null
          link?: string | null
          media_mode?: string | null
          media_transforms?: Json | null
          media_urls?: Json | null
          metric_clicks?: number | null
          metric_ctr?: number | null
          metric_engagement?: number | null
          metric_reach?: number | null
          metric_retention?: number | null
          music?: string | null
          order_index?: number | null
          platform?: string
          playlist?: string | null
          resolution?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          tags?: string | null
          template_name?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_variations_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "digital_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_cost_configuration_components: {
        Row: {
          component_product_id: string
          component_variant_id: string | null
          configuration_id: string
          created_at: string
          id: string
          incidence: string
          notes: string | null
          quantity: number
          sort_order: number
          subcategory: string | null
        }
        Insert: {
          component_product_id: string
          component_variant_id?: string | null
          configuration_id: string
          created_at?: string
          id?: string
          incidence: string
          notes?: string | null
          quantity: number
          sort_order?: number
          subcategory?: string | null
        }
        Update: {
          component_product_id?: string
          component_variant_id?: string | null
          configuration_id?: string
          created_at?: string
          id?: string
          incidence?: string
          notes?: string | null
          quantity?: number
          sort_order?: number
          subcategory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_cost_configuration_component_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_cost_configuration_component_component_variant_id_fkey"
            columns: ["component_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_cost_configuration_components_configuration_id_fkey"
            columns: ["configuration_id"]
            isOneToOne: false
            referencedRelation: "economic_cost_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_cost_configurations: {
        Row: {
          block: string
          code: string
          commercial_presentation_id: string | null
          created_at: string
          id: string
          is_active: boolean
          is_zero_confirmed: boolean
          name: string
          notes: string | null
          product_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          block: string
          code: string
          commercial_presentation_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_zero_confirmed?: boolean
          name: string
          notes?: string | null
          product_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          block?: string
          code?: string
          commercial_presentation_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_zero_confirmed?: boolean
          name?: string
          notes?: string | null
          product_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_cost_configurations_commercial_presentation_id_fkey"
            columns: ["commercial_presentation_id"]
            isOneToOne: false
            referencedRelation: "commercial_presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_cost_configurations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_cost_configurations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_financial_attributions: {
        Row: {
          allocated_value: number
          block: string
          created_at: string
          created_by: string | null
          effect: string
          financial_entry_id: string
          id: string
          incident_id: string | null
          notes: string | null
          order_id: string | null
          subcategory: string
        }
        Insert: {
          allocated_value: number
          block: string
          created_at?: string
          created_by?: string | null
          effect?: string
          financial_entry_id: string
          id?: string
          incident_id?: string | null
          notes?: string | null
          order_id?: string | null
          subcategory: string
        }
        Update: {
          allocated_value?: number
          block?: string
          created_at?: string
          created_by?: string | null
          effect?: string
          financial_entry_id?: string
          id?: string
          incident_id?: string | null
          notes?: string | null
          order_id?: string | null
          subcategory?: string
        }
        Relationships: [
          {
            foreignKeyName: "economic_financial_attributions_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_financial_attributions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "operational_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_financial_attributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_prediction_reconciliations: {
        Row: {
          comparison_snapshot: Json
          created_at: string
          created_by: string | null
          financial_entry_id: string | null
          financial_snapshot: Json
          id: string
          marketplace_settlement_id: string | null
          notes: string | null
          observed_snapshot: Json
          order_id: string | null
          pending_snapshot: Json
          prediction_snapshot_id: string
          reconciliation_version: number
          status: string
        }
        Insert: {
          comparison_snapshot?: Json
          created_at?: string
          created_by?: string | null
          financial_entry_id?: string | null
          financial_snapshot?: Json
          id?: string
          marketplace_settlement_id?: string | null
          notes?: string | null
          observed_snapshot?: Json
          order_id?: string | null
          pending_snapshot?: Json
          prediction_snapshot_id: string
          reconciliation_version: number
          status: string
        }
        Update: {
          comparison_snapshot?: Json
          created_at?: string
          created_by?: string | null
          financial_entry_id?: string | null
          financial_snapshot?: Json
          id?: string
          marketplace_settlement_id?: string | null
          notes?: string | null
          observed_snapshot?: Json
          order_id?: string | null
          pending_snapshot?: Json
          prediction_snapshot_id?: string
          reconciliation_version?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "economic_prediction_reconciliati_marketplace_settlement_id_fkey"
            columns: ["marketplace_settlement_id"]
            isOneToOne: false
            referencedRelation: "marketplace_settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_prediction_reconciliations_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_prediction_reconciliations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_prediction_reconciliations_prediction_snapshot_id_fkey"
            columns: ["prediction_snapshot_id"]
            isOneToOne: false
            referencedRelation: "economic_prediction_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_prediction_snapshots: {
        Row: {
          channel_account_id: string | null
          commercial_presentation_id: string | null
          confidence: string
          created_at: string
          created_by: string | null
          decision_note: string | null
          effective_at: string
          engine_key: string
          engine_version: string
          evidence_snapshot: Json
          id: string
          input_snapshot: Json
          marketplace: string
          marketplace_product_mapping_id: string | null
          pending_snapshot: Json
          product_id: string | null
          result_snapshot: Json
          rule_version: string | null
          rule_version_id: string | null
          snapshot_key: string
          snapshot_schema_version: string
          variant_id: string | null
        }
        Insert: {
          channel_account_id?: string | null
          commercial_presentation_id?: string | null
          confidence: string
          created_at?: string
          created_by?: string | null
          decision_note?: string | null
          effective_at: string
          engine_key: string
          engine_version: string
          evidence_snapshot?: Json
          id?: string
          input_snapshot: Json
          marketplace: string
          marketplace_product_mapping_id?: string | null
          pending_snapshot?: Json
          product_id?: string | null
          result_snapshot: Json
          rule_version?: string | null
          rule_version_id?: string | null
          snapshot_key?: string
          snapshot_schema_version?: string
          variant_id?: string | null
        }
        Update: {
          channel_account_id?: string | null
          commercial_presentation_id?: string | null
          confidence?: string
          created_at?: string
          created_by?: string | null
          decision_note?: string | null
          effective_at?: string
          engine_key?: string
          engine_version?: string
          evidence_snapshot?: Json
          id?: string
          input_snapshot?: Json
          marketplace?: string
          marketplace_product_mapping_id?: string | null
          pending_snapshot?: Json
          product_id?: string | null
          result_snapshot?: Json
          rule_version?: string | null
          rule_version_id?: string | null
          snapshot_key?: string
          snapshot_schema_version?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_prediction_snapshots_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_prediction_snapshots_commercial_presentation_id_fkey"
            columns: ["commercial_presentation_id"]
            isOneToOne: false
            referencedRelation: "commercial_presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_prediction_snapshots_marketplace_product_mapping__fkey"
            columns: ["marketplace_product_mapping_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_prediction_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_prediction_snapshots_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "economic_rule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_prediction_snapshots_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_rule_evidence: {
        Row: {
          created_at: string
          evidence_type: string
          id: string
          is_offer_specific: boolean
          marketplace_product_mapping_id: string | null
          observed_from: string | null
          observed_to: string | null
          payload: Json
          rule_version_id: string
          source_ref: string
        }
        Insert: {
          created_at?: string
          evidence_type: string
          id?: string
          is_offer_specific?: boolean
          marketplace_product_mapping_id?: string | null
          observed_from?: string | null
          observed_to?: string | null
          payload?: Json
          rule_version_id: string
          source_ref: string
        }
        Update: {
          created_at?: string
          evidence_type?: string
          id?: string
          is_offer_specific?: boolean
          marketplace_product_mapping_id?: string | null
          observed_from?: string | null
          observed_to?: string | null
          payload?: Json
          rule_version_id?: string
          source_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "economic_rule_evidence_marketplace_product_mapping_id_fkey"
            columns: ["marketplace_product_mapping_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_rule_evidence_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "economic_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_rule_versions: {
        Row: {
          channel_account_id: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          engine_key: string
          engine_version: string
          id: string
          marketplace: string
          marketplace_product_mapping_id: string | null
          parameters: Json
          rule_key: string
          rule_version: string
          source_summary: string | null
          status: string
          supersedes_rule_version_id: string | null
          updated_at: string
        }
        Insert: {
          channel_account_id?: string | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          engine_key: string
          engine_version: string
          id?: string
          marketplace: string
          marketplace_product_mapping_id?: string | null
          parameters?: Json
          rule_key: string
          rule_version: string
          source_summary?: string | null
          status?: string
          supersedes_rule_version_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_account_id?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          engine_key?: string
          engine_version?: string
          id?: string
          marketplace?: string
          marketplace_product_mapping_id?: string | null
          parameters?: Json
          rule_key?: string
          rule_version?: string
          source_summary?: string | null
          status?: string
          supersedes_rule_version_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "economic_rule_versions_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_rule_versions_marketplace_product_mapping_id_fkey"
            columns: ["marketplace_product_mapping_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_rule_versions_supersedes_rule_version_id_fkey"
            columns: ["supersedes_rule_version_id"]
            isOneToOne: false
            referencedRelation: "economic_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_number: string | null
          agency: string | null
          bank_name: string | null
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          account_id: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          category_id: string | null
          channel_account_id: string | null
          competence_date: string | null
          conciliated_at: string | null
          contact_id: string | null
          created_at: string
          description: string
          document_number: string | null
          due_date: string
          id: string
          import_external_id: string | null
          import_file_name: string | null
          import_file_type: string | null
          import_hash: string | null
          import_source: string | null
          imported_at: string | null
          imported_by: string | null
          is_conciliated: boolean
          issue_date: string | null
          lifecycle_status: string
          marketplace_account: string | null
          notes: string | null
          order_id: string | null
          original_due_date: string | null
          parent_entry_id: string | null
          payment_date: string | null
          payment_method: string | null
          platform_id: string | null
          purchase_installment_number: number | null
          purchase_order_id: string | null
          recurrence_day: number | null
          recurrence_end_date: string | null
          recurrence_sequence: number | null
          recurrence_series_id: string | null
          recurrence_type: string | null
          recurrence_use_business_days: boolean | null
          sales_channel: string | null
          type: string
          updated_at: string
          value: number
          value_paid: number
        }
        Insert: {
          account_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          category_id?: string | null
          channel_account_id?: string | null
          competence_date?: string | null
          conciliated_at?: string | null
          contact_id?: string | null
          created_at?: string
          description: string
          document_number?: string | null
          due_date: string
          id?: string
          import_external_id?: string | null
          import_file_name?: string | null
          import_file_type?: string | null
          import_hash?: string | null
          import_source?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_conciliated?: boolean
          issue_date?: string | null
          lifecycle_status?: string
          marketplace_account?: string | null
          notes?: string | null
          order_id?: string | null
          original_due_date?: string | null
          parent_entry_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          platform_id?: string | null
          purchase_installment_number?: number | null
          purchase_order_id?: string | null
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          recurrence_sequence?: number | null
          recurrence_series_id?: string | null
          recurrence_type?: string | null
          recurrence_use_business_days?: boolean | null
          sales_channel?: string | null
          type: string
          updated_at?: string
          value: number
          value_paid?: number
        }
        Update: {
          account_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          category_id?: string | null
          channel_account_id?: string | null
          competence_date?: string | null
          conciliated_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string
          document_number?: string | null
          due_date?: string
          id?: string
          import_external_id?: string | null
          import_file_name?: string | null
          import_file_type?: string | null
          import_hash?: string | null
          import_source?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_conciliated?: boolean
          issue_date?: string | null
          lifecycle_status?: string
          marketplace_account?: string | null
          notes?: string | null
          order_id?: string | null
          original_due_date?: string | null
          parent_entry_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          platform_id?: string | null
          purchase_installment_number?: number | null
          purchase_order_id?: string | null
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          recurrence_sequence?: number | null
          recurrence_series_id?: string | null
          recurrence_type?: string | null
          recurrence_use_business_days?: boolean | null
          sales_channel?: string | null
          type?: string
          updated_at?: string
          value?: number
          value_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_parent_entry_id_fkey"
            columns: ["parent_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_movements: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          entry_id: string
          id: string
          movement_date: string
          notes: string | null
          value: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_id: string
          id?: string
          movement_date?: string
          notes?: string | null
          value: number
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_id?: string
          id?: string
          movement_date?: string
          notes?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_order_links: {
        Row: {
          allocated_value: number
          created_at: string
          financial_entry_id: string
          id: string
          order_id: string
        }
        Insert: {
          allocated_value: number
          created_at?: string
          financial_entry_id: string
          id?: string
          order_id: string
        }
        Update: {
          allocated_value?: number
          created_at?: string
          financial_entry_id?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_order_links_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_order_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      glucodry_sealed_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_key: string
          id: string
          movement_type: string
          new_balance: number
          notes: string | null
          previous_balance: number
          reference_id: string | null
          reference_type: string
          sacks: number
          storage_location_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_key: string
          id?: string
          movement_type: string
          new_balance: number
          notes?: string | null
          previous_balance: number
          reference_id?: string | null
          reference_type: string
          sacks: number
          storage_location_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_key?: string
          id?: string
          movement_type?: string
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          reference_id?: string | null
          reference_type?: string
          sacks?: number
          storage_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "glucodry_sealed_events_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      glucodry_sealed_stock: {
        Row: {
          sacks: number
          storage_location_id: string
          updated_at: string
        }
        Insert: {
          sacks?: number
          storage_location_id: string
          updated_at?: string
        }
        Update: {
          sacks?: number
          storage_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "glucodry_sealed_stock_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: true
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      health_athlete_access: {
        Row: {
          access_role: string
          athlete_id: string
          can_manage_access: boolean
          can_read: boolean
          can_write: boolean
          created_at: string
          granted_at: string
          granted_by_auth_user_id: string
          id: string
          principal_auth_user_id: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          access_role: string
          athlete_id: string
          can_manage_access?: boolean
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          granted_at?: string
          granted_by_auth_user_id?: string
          id?: string
          principal_auth_user_id: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          access_role?: string
          athlete_id?: string
          can_manage_access?: boolean
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          granted_at?: string
          granted_by_auth_user_id?: string
          id?: string
          principal_auth_user_id?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_athlete_access_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_athlete_preferences: {
        Row: {
          athlete_id: string
          created_at: string
          default_location_id: string | null
          notes: string | null
          preferred_session_minutes: number | null
          preferred_sessions_per_week: number | null
          training_time_preference: string | null
          unit_system: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          default_location_id?: string | null
          notes?: string | null
          preferred_session_minutes?: number | null
          preferred_sessions_per_week?: number | null
          training_time_preference?: string | null
          unit_system?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          default_location_id?: string | null
          notes?: string | null
          preferred_session_minutes?: number | null
          preferred_sessions_per_week?: number | null
          training_time_preference?: string | null
          unit_system?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_athlete_preferences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_athlete_preferences_location_athlete_fkey"
            columns: ["default_location_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_training_locations"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_athlete_profiles: {
        Row: {
          athlete_id: string
          created_at: string
          date_of_birth: string | null
          dominant_side: string | null
          height_cm: number | null
          profile_notes: string | null
          training_experience_level: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          date_of_birth?: string | null
          dominant_side?: string | null
          height_cm?: number | null
          profile_notes?: string | null
          training_experience_level?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          date_of_birth?: string | null
          dominant_side?: string | null
          height_cm?: number | null
          profile_notes?: string | null
          training_experience_level?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_athlete_profiles_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_athletes: {
        Row: {
          auth_user_id: string | null
          created_at: string
          created_by_auth_user_id: string
          display_name: string
          id: string
          owner_auth_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string
          display_name: string
          id?: string
          owner_auth_user_id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string
          display_name?: string
          id?: string
          owner_auth_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_biomarker_aliases: {
        Row: {
          canonical_code: string
          created_at: string
          id: string
          mapping_confidence: string
          mapping_version: string
          normalized_alias: string
          provider_name: string | null
          reviewed_by_auth_user_id: string | null
        }
        Insert: {
          canonical_code: string
          created_at?: string
          id?: string
          mapping_confidence?: string
          mapping_version?: string
          normalized_alias: string
          provider_name?: string | null
          reviewed_by_auth_user_id?: string | null
        }
        Update: {
          canonical_code?: string
          created_at?: string
          id?: string
          mapping_confidence?: string
          mapping_version?: string
          normalized_alias?: string
          provider_name?: string | null
          reviewed_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_biomarker_aliases_canonical_code_fkey"
            columns: ["canonical_code"]
            isOneToOne: false
            referencedRelation: "health_biomarker_catalog"
            referencedColumns: ["canonical_code"]
          },
        ]
      }
      health_biomarker_catalog: {
        Row: {
          canonical_code: string
          category: string
          coding_version: string | null
          created_at: string
          display_name: string
          expected_value_type: string
          external_code: string | null
          external_coding_system: string | null
          status: string
          updated_at: string
        }
        Insert: {
          canonical_code: string
          category: string
          coding_version?: string | null
          created_at?: string
          display_name: string
          expected_value_type?: string
          external_code?: string | null
          external_coding_system?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          canonical_code?: string
          category?: string
          coding_version?: string | null
          created_at?: string
          display_name?: string
          expected_value_type?: string
          external_code?: string | null
          external_coding_system?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_biomarker_longitudinal_states: {
        Row: {
          algorithm_version: string
          as_of_date: string
          athlete_id: string
          canonical_code: string
          comparability_status: string
          comparison_unit: string | null
          computed_at: string
          confidence: string
          current_flag: string | null
          current_reference_text: string | null
          direction_status: string
          id: string
          latest_numeric_value: number | null
          latest_result_id: string | null
          observation_count: number
          previous_numeric_value: number | null
          previous_result_id: string | null
          reason_codes: string[]
        }
        Insert: {
          algorithm_version?: string
          as_of_date: string
          athlete_id: string
          canonical_code: string
          comparability_status: string
          comparison_unit?: string | null
          computed_at?: string
          confidence: string
          current_flag?: string | null
          current_reference_text?: string | null
          direction_status: string
          id?: string
          latest_numeric_value?: number | null
          latest_result_id?: string | null
          observation_count?: number
          previous_numeric_value?: number | null
          previous_result_id?: string | null
          reason_codes?: string[]
        }
        Update: {
          algorithm_version?: string
          as_of_date?: string
          athlete_id?: string
          canonical_code?: string
          comparability_status?: string
          comparison_unit?: string | null
          computed_at?: string
          confidence?: string
          current_flag?: string | null
          current_reference_text?: string | null
          direction_status?: string
          id?: string
          latest_numeric_value?: number | null
          latest_result_id?: string | null
          observation_count?: number
          previous_numeric_value?: number | null
          previous_result_id?: string | null
          reason_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "health_biomarker_longitudinal_states_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_biomarker_longitudinal_states_canonical_code_fkey"
            columns: ["canonical_code"]
            isOneToOne: false
            referencedRelation: "health_biomarker_catalog"
            referencedColumns: ["canonical_code"]
          },
          {
            foreignKeyName: "health_biomarker_longitudinal_states_latest_result_id_fkey"
            columns: ["latest_result_id"]
            isOneToOne: false
            referencedRelation: "health_biomarker_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_biomarker_longitudinal_states_previous_result_id_fkey"
            columns: ["previous_result_id"]
            isOneToOne: false
            referencedRelation: "health_biomarker_results"
            referencedColumns: ["id"]
          },
        ]
      }
      health_biomarker_results: {
        Row: {
          athlete_id: string
          canonical_code: string | null
          confidence: string
          created_at: string
          id: string
          lab_report_id: string
          method_text: string | null
          normalized_unit_ucum: string | null
          normalized_value: number | null
          notes: string | null
          numeric_value: number | null
          original_analyte_name: string
          original_flag: string | null
          original_reference_text: string | null
          original_result_text: string
          original_unit: string | null
          reference_high: number | null
          reference_low: number | null
        }
        Insert: {
          athlete_id: string
          canonical_code?: string | null
          confidence?: string
          created_at?: string
          id?: string
          lab_report_id: string
          method_text?: string | null
          normalized_unit_ucum?: string | null
          normalized_value?: number | null
          notes?: string | null
          numeric_value?: number | null
          original_analyte_name: string
          original_flag?: string | null
          original_reference_text?: string | null
          original_result_text: string
          original_unit?: string | null
          reference_high?: number | null
          reference_low?: number | null
        }
        Update: {
          athlete_id?: string
          canonical_code?: string | null
          confidence?: string
          created_at?: string
          id?: string
          lab_report_id?: string
          method_text?: string | null
          normalized_unit_ucum?: string | null
          normalized_value?: number | null
          notes?: string | null
          numeric_value?: number | null
          original_analyte_name?: string
          original_flag?: string | null
          original_reference_text?: string | null
          original_result_text?: string
          original_unit?: string | null
          reference_high?: number | null
          reference_low?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_biomarker_results_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_biomarker_results_canonical_code_fkey"
            columns: ["canonical_code"]
            isOneToOne: false
            referencedRelation: "health_biomarker_catalog"
            referencedColumns: ["canonical_code"]
          },
          {
            foreignKeyName: "health_biomarker_results_report_athlete_fkey"
            columns: ["lab_report_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_lab_reports"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_body_assessments: {
        Row: {
          athlete_id: string
          client_event_id: string | null
          conditions: Json | null
          confidence: string
          created_at: string
          created_by_auth_user_id: string | null
          data_source: string
          id: string
          notes: string | null
          observed_at: string
          observed_on: string
          status: string
          status_changed_at: string | null
          supersedes_assessment_id: string | null
          void_reason: string | null
        }
        Insert: {
          athlete_id: string
          client_event_id?: string | null
          conditions?: Json | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          id?: string
          notes?: string | null
          observed_at: string
          observed_on: string
          status?: string
          status_changed_at?: string | null
          supersedes_assessment_id?: string | null
          void_reason?: string | null
        }
        Update: {
          athlete_id?: string
          client_event_id?: string | null
          conditions?: Json | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          id?: string
          notes?: string | null
          observed_at?: string
          observed_on?: string
          status?: string
          status_changed_at?: string | null
          supersedes_assessment_id?: string | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_body_assessments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_body_assessments_supersedes_assessment_id_fkey"
            columns: ["supersedes_assessment_id"]
            isOneToOne: false
            referencedRelation: "health_body_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      health_body_measurements: {
        Row: {
          assessment_id: string
          athlete_id: string
          confidence: string
          created_at: string
          id: string
          method: string
          metric_code: string
          notes: string | null
          unit_code: string
          value: number
        }
        Insert: {
          assessment_id: string
          athlete_id: string
          confidence?: string
          created_at?: string
          id?: string
          method?: string
          metric_code: string
          notes?: string | null
          unit_code: string
          value: number
        }
        Update: {
          assessment_id?: string
          athlete_id?: string
          confidence?: string
          created_at?: string
          id?: string
          method?: string
          metric_code?: string
          notes?: string | null
          unit_code?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_body_measurements_assessment_athlete_fkey"
            columns: ["assessment_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_body_assessments"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_body_measurements_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_body_photo_sets: {
        Row: {
          assessment_id: string | null
          athlete_id: string
          captured_at: string
          captured_on: string
          conditions: Json | null
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          notes: string | null
          protocol_version: string
          status: string
          status_changed_at: string | null
          void_reason: string | null
        }
        Insert: {
          assessment_id?: string | null
          athlete_id: string
          captured_at?: string
          captured_on: string
          conditions?: Json | null
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          notes?: string | null
          protocol_version?: string
          status?: string
          status_changed_at?: string | null
          void_reason?: string | null
        }
        Update: {
          assessment_id?: string | null
          athlete_id?: string
          captured_at?: string
          captured_on?: string
          conditions?: Json | null
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          notes?: string | null
          protocol_version?: string
          status?: string
          status_changed_at?: string | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_body_photo_sets_assessment_athlete_fkey"
            columns: ["assessment_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_body_assessments"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_body_photo_sets_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_body_photos: {
        Row: {
          angle_code: string
          athlete_id: string
          capture_order: number
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          mime_type: string
          notes: string | null
          object_path: string
          photo_set_id: string
          status: string
        }
        Insert: {
          angle_code: string
          athlete_id: string
          capture_order: number
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          mime_type: string
          notes?: string | null
          object_path: string
          photo_set_id: string
          status?: string
        }
        Update: {
          angle_code?: string
          athlete_id?: string
          capture_order?: number
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          mime_type?: string
          notes?: string | null
          object_path?: string
          photo_set_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_body_photos_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_body_photos_set_athlete_fkey"
            columns: ["photo_set_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_body_photo_sets"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_body_rolling_states: {
        Row: {
          algorithm_version: string
          as_of_date: string
          athlete_id: string
          body_fat_change_pct: number | null
          body_fat_first_pct: number | null
          body_fat_latest_pct: number | null
          body_fat_observation_count: number
          computed_at: string
          confidence: string
          coverage_status: string
          id: string
          latest_bmi: number | null
          photo_set_count: number
          reason_codes: string[]
          waist_change_cm: number | null
          waist_first_cm: number | null
          waist_latest_cm: number | null
          waist_observation_count: number
          weight_change_kg: number | null
          weight_first_kg: number | null
          weight_latest_kg: number | null
          weight_method_count: number
          weight_observation_count: number
          weight_trend_kg_per_week: number | null
          window_days: number
          window_start_date: string
        }
        Insert: {
          algorithm_version?: string
          as_of_date: string
          athlete_id: string
          body_fat_change_pct?: number | null
          body_fat_first_pct?: number | null
          body_fat_latest_pct?: number | null
          body_fat_observation_count?: number
          computed_at?: string
          confidence: string
          coverage_status: string
          id?: string
          latest_bmi?: number | null
          photo_set_count?: number
          reason_codes?: string[]
          waist_change_cm?: number | null
          waist_first_cm?: number | null
          waist_latest_cm?: number | null
          waist_observation_count?: number
          weight_change_kg?: number | null
          weight_first_kg?: number | null
          weight_latest_kg?: number | null
          weight_method_count?: number
          weight_observation_count?: number
          weight_trend_kg_per_week?: number | null
          window_days: number
          window_start_date: string
        }
        Update: {
          algorithm_version?: string
          as_of_date?: string
          athlete_id?: string
          body_fat_change_pct?: number | null
          body_fat_first_pct?: number | null
          body_fat_latest_pct?: number | null
          body_fat_observation_count?: number
          computed_at?: string
          confidence?: string
          coverage_status?: string
          id?: string
          latest_bmi?: number | null
          photo_set_count?: number
          reason_codes?: string[]
          waist_change_cm?: number | null
          waist_first_cm?: number | null
          waist_latest_cm?: number | null
          waist_observation_count?: number
          weight_change_kg?: number | null
          weight_first_kg?: number | null
          weight_latest_kg?: number | null
          weight_method_count?: number
          weight_observation_count?: number
          weight_trend_kg_per_week?: number | null
          window_days?: number
          window_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_body_rolling_states_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_cch_queue_entries: {
        Row: {
          athlete_id: string
          blocked_reason: string | null
          created_at: string
          created_by_auth_user_id: string | null
          eligible_after: string | null
          id: string
          predecessor_entry_id: string | null
          program_version_id: string
          queue_position: number
          reason_codes: string[]
          session_template_id: string
          source: string
          state: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          blocked_reason?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          eligible_after?: string | null
          id?: string
          predecessor_entry_id?: string | null
          program_version_id: string
          queue_position: number
          reason_codes?: string[]
          session_template_id: string
          source?: string
          state?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          blocked_reason?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          eligible_after?: string | null
          id?: string
          predecessor_entry_id?: string | null
          program_version_id?: string
          queue_position?: number
          reason_codes?: string[]
          session_template_id?: string
          source?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_cch_queue_entries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_cch_queue_entries_predecessor_entry_id_fkey"
            columns: ["predecessor_entry_id"]
            isOneToOne: false
            referencedRelation: "health_cch_queue_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_cch_queue_template_athlete_fkey"
            columns: ["session_template_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_session_templates"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_cch_queue_version_athlete_fkey"
            columns: ["program_version_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_program_versions"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_clinical_document_extractions: {
        Row: {
          athlete_id: string
          confirmed_at: string | null
          confirmed_by_auth_user_id: string | null
          created_at: string
          created_by_auth_user_id: string | null
          document_id: string
          engine_provider: string | null
          engine_version: string | null
          error_message: string | null
          field_confidences: Json | null
          id: string
          rejected_at: string | null
          rejected_by_auth_user_id: string | null
          status: string
          structured_payload: Json | null
          updated_at: string
          warnings: Json | null
        }
        Insert: {
          athlete_id: string
          confirmed_at?: string | null
          confirmed_by_auth_user_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          document_id: string
          engine_provider?: string | null
          engine_version?: string | null
          error_message?: string | null
          field_confidences?: Json | null
          id?: string
          rejected_at?: string | null
          rejected_by_auth_user_id?: string | null
          status?: string
          structured_payload?: Json | null
          updated_at?: string
          warnings?: Json | null
        }
        Update: {
          athlete_id?: string
          confirmed_at?: string | null
          confirmed_by_auth_user_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          document_id?: string
          engine_provider?: string | null
          engine_version?: string | null
          error_message?: string | null
          field_confidences?: Json | null
          id?: string
          rejected_at?: string | null
          rejected_by_auth_user_id?: string | null
          status?: string
          structured_payload?: Json | null
          updated_at?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "health_clinical_document_extractions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_clinical_extractions_document_athlete_fkey"
            columns: ["document_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_clinical_documents"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_clinical_documents: {
        Row: {
          athlete_id: string
          created_at: string
          created_by_auth_user_id: string | null
          data_source: string
          document_date: string | null
          document_type: string
          id: string
          mime_type: string
          notes: string | null
          object_path: string
          original_filename: string
          provider_name: string | null
          sha256: string | null
          status: string
          status_changed_at: string | null
          supersedes_document_id: string | null
          void_reason: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          document_date?: string | null
          document_type: string
          id?: string
          mime_type: string
          notes?: string | null
          object_path: string
          original_filename: string
          provider_name?: string | null
          sha256?: string | null
          status?: string
          status_changed_at?: string | null
          supersedes_document_id?: string | null
          void_reason?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          document_date?: string | null
          document_type?: string
          id?: string
          mime_type?: string
          notes?: string | null
          object_path?: string
          original_filename?: string
          provider_name?: string | null
          sha256?: string | null
          status?: string
          status_changed_at?: string | null
          supersedes_document_id?: string | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_clinical_documents_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_clinical_documents_supersedes_document_id_fkey"
            columns: ["supersedes_document_id"]
            isOneToOne: false
            referencedRelation: "health_clinical_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      health_consents: {
        Row: {
          actor_auth_user_id: string
          athlete_id: string
          consent_type: string
          created_at: string
          decision: string
          details: Json | null
          id: string
          occurred_at: string
          policy_version: string
        }
        Insert: {
          actor_auth_user_id?: string
          athlete_id: string
          consent_type: string
          created_at?: string
          decision: string
          details?: Json | null
          id?: string
          occurred_at?: string
          policy_version: string
        }
        Update: {
          actor_auth_user_id?: string
          athlete_id?: string
          consent_type?: string
          created_at?: string
          decision?: string
          details?: Json | null
          id?: string
          occurred_at?: string
          policy_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_consents_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_declared_equipment: {
        Row: {
          athlete_id: string
          availability: string
          catalog_equipment_id: string | null
          category: string | null
          created_at: string
          created_by_auth_user_id: string
          display_name: string
          id: string
          location_id: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          availability?: string
          catalog_equipment_id?: string | null
          category?: string | null
          created_at?: string
          created_by_auth_user_id?: string
          display_name: string
          id?: string
          location_id?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          availability?: string
          catalog_equipment_id?: string | null
          category?: string | null
          created_at?: string
          created_by_auth_user_id?: string
          display_name?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_declared_equipment_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_declared_equipment_catalog_equipment_fkey"
            columns: ["catalog_equipment_id"]
            isOneToOne: false
            referencedRelation: "health_equipment_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_declared_equipment_location_athlete_fkey"
            columns: ["location_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_training_locations"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_equipment_catalog: {
        Row: {
          code: string
          created_at: string
          equipment_type: string
          id: string
          increment_profile: Json | null
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          equipment_type: string
          id?: string
          increment_profile?: Json | null
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          equipment_type?: string
          id?: string
          increment_profile?: Json | null
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      health_exercise_equipment: {
        Row: {
          created_at: string
          equipment_id: string
          exercise_id: string
          requirement_type: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          exercise_id: string
          requirement_type?: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          exercise_id?: string
          requirement_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_exercise_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "health_equipment_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_exercise_equipment_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "health_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      health_exercise_equivalences: {
        Row: {
          confidence: string
          created_at: string
          equivalence_type: string
          id: string
          notes: string | null
          source_exercise_id: string
          target_exercise_id: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          equivalence_type: string
          id?: string
          notes?: string | null
          source_exercise_id: string
          target_exercise_id: string
        }
        Update: {
          confidence?: string
          created_at?: string
          equivalence_type?: string
          id?: string
          notes?: string | null
          source_exercise_id?: string
          target_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_exercise_equivalences_source_exercise_id_fkey"
            columns: ["source_exercise_id"]
            isOneToOne: false
            referencedRelation: "health_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_exercise_equivalences_target_exercise_id_fkey"
            columns: ["target_exercise_id"]
            isOneToOne: false
            referencedRelation: "health_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      health_exercise_muscles: {
        Row: {
          contribution_weight: number | null
          created_at: string
          evidence_status: string
          exercise_id: string
          muscle_group_id: string
          notes: string | null
          role: string
        }
        Insert: {
          contribution_weight?: number | null
          created_at?: string
          evidence_status?: string
          exercise_id: string
          muscle_group_id: string
          notes?: string | null
          role: string
        }
        Update: {
          contribution_weight?: number | null
          created_at?: string
          evidence_status?: string
          exercise_id?: string
          muscle_group_id?: string
          notes?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_exercise_muscles_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "health_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_exercise_muscles_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "health_muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      health_exercises: {
        Row: {
          code: string
          created_at: string
          fatigue_cost: string | null
          id: string
          instructions: string | null
          is_active: boolean
          laterality: string
          movement_pattern: string
          name: string
          sort_order: number
          stability_demand: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          fatigue_cost?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          laterality?: string
          movement_pattern: string
          name: string
          sort_order?: number
          stability_demand?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          fatigue_cost?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          laterality?: string
          movement_pattern?: string
          name?: string
          sort_order?: number
          stability_demand?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      health_food_log_day_events: {
        Row: {
          athlete_id: string
          client_event_id: string | null
          created_by_auth_user_id: string | null
          event_type: string
          food_log_day_id: string
          id: string
          occurred_at: string
          payload: Json | null
          recorded_at: string
        }
        Insert: {
          athlete_id: string
          client_event_id?: string | null
          created_by_auth_user_id?: string | null
          event_type: string
          food_log_day_id: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          recorded_at?: string
        }
        Update: {
          athlete_id?: string
          client_event_id?: string | null
          created_by_auth_user_id?: string | null
          event_type?: string
          food_log_day_id?: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_food_log_day_events_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_food_log_day_events_day_athlete_fkey"
            columns: ["food_log_day_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_food_log_days"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_food_log_days: {
        Row: {
          athlete_id: string
          completed_at: string | null
          completeness_status: string
          completion_confirmed_by: string | null
          confidence: string
          confidence_reason_codes: string[]
          confidence_score: number | null
          created_at: string
          id: string
          log_date: string
          notes: string | null
          registration_level: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          completed_at?: string | null
          completeness_status?: string
          completion_confirmed_by?: string | null
          confidence?: string
          confidence_reason_codes?: string[]
          confidence_score?: number | null
          created_at?: string
          id?: string
          log_date: string
          notes?: string | null
          registration_level?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          completed_at?: string | null
          completeness_status?: string
          completion_confirmed_by?: string | null
          confidence?: string
          confidence_reason_codes?: string[]
          confidence_score?: number | null
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          registration_level?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_food_log_days_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_food_sources: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          is_active: boolean
          license_label: string | null
          name: string
          provider_type: string
          reference_url: string | null
          release_label: string | null
          source_code: string
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          license_label?: string | null
          name: string
          provider_type: string
          reference_url?: string | null
          release_label?: string | null
          source_code: string
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          license_label?: string | null
          name?: string
          provider_type?: string
          reference_url?: string | null
          release_label?: string | null
          source_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_foods: {
        Row: {
          basis_amount: number
          basis_unit: string
          brand: string | null
          canonical_name: string
          carbohydrate_g: number | null
          country_code: string | null
          created_at: string
          data_quality: string
          data_type: string | null
          energy_kcal: number | null
          fat_g: number | null
          fiber_g: number | null
          id: string
          is_active: boolean
          protein_g: number | null
          sodium_mg: number | null
          source_food_key: string
          source_id: string
          source_version: string | null
          updated_at: string
        }
        Insert: {
          basis_amount?: number
          basis_unit?: string
          brand?: string | null
          canonical_name: string
          carbohydrate_g?: number | null
          country_code?: string | null
          created_at?: string
          data_quality?: string
          data_type?: string | null
          energy_kcal?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          is_active?: boolean
          protein_g?: number | null
          sodium_mg?: number | null
          source_food_key: string
          source_id: string
          source_version?: string | null
          updated_at?: string
        }
        Update: {
          basis_amount?: number
          basis_unit?: string
          brand?: string | null
          canonical_name?: string
          carbohydrate_g?: number | null
          country_code?: string | null
          created_at?: string
          data_quality?: string
          data_type?: string | null
          energy_kcal?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          is_active?: boolean
          protein_g?: number | null
          sodium_mg?: number | null
          source_food_key?: string
          source_id?: string
          source_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_foods_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "health_food_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      health_goal_phases: {
        Row: {
          athlete_id: string
          created_at: string
          created_by_auth_user_id: string
          ends_on: string | null
          goal_id: string
          id: string
          objective_notes: string | null
          phase_type: string
          starts_on: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by_auth_user_id?: string
          ends_on?: string | null
          goal_id: string
          id?: string
          objective_notes?: string | null
          phase_type: string
          starts_on?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by_auth_user_id?: string
          ends_on?: string | null
          goal_id?: string
          id?: string
          objective_notes?: string | null
          phase_type?: string
          starts_on?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_goal_phases_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_goal_phases_goal_athlete_fkey"
            columns: ["goal_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_goals"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_goals: {
        Row: {
          athlete_id: string
          created_at: string
          created_by_auth_user_id: string
          goal_type: string
          id: string
          is_primary: boolean
          notes: string | null
          priority: number
          started_on: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by_auth_user_id?: string
          goal_type: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          priority?: number
          started_on?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by_auth_user_id?: string
          goal_type?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          priority?: number
          started_on?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_goals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_lab_reports: {
        Row: {
          athlete_id: string
          client_event_id: string | null
          collected_at: string | null
          collection_context: Json | null
          confidence: string
          created_at: string
          created_by_auth_user_id: string | null
          data_source: string
          document_id: string | null
          extraction_id: string | null
          fasting_status: string | null
          id: string
          laboratory_name: string | null
          notes: string | null
          resulted_at: string | null
          status: string
          status_changed_at: string | null
          supersedes_lab_report_id: string | null
          void_reason: string | null
        }
        Insert: {
          athlete_id: string
          client_event_id?: string | null
          collected_at?: string | null
          collection_context?: Json | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          document_id?: string | null
          extraction_id?: string | null
          fasting_status?: string | null
          id?: string
          laboratory_name?: string | null
          notes?: string | null
          resulted_at?: string | null
          status?: string
          status_changed_at?: string | null
          supersedes_lab_report_id?: string | null
          void_reason?: string | null
        }
        Update: {
          athlete_id?: string
          client_event_id?: string | null
          collected_at?: string | null
          collection_context?: Json | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          document_id?: string | null
          extraction_id?: string | null
          fasting_status?: string | null
          id?: string
          laboratory_name?: string | null
          notes?: string | null
          resulted_at?: string | null
          status?: string
          status_changed_at?: string | null
          supersedes_lab_report_id?: string | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_lab_reports_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_lab_reports_document_athlete_fkey"
            columns: ["document_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_clinical_documents"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_lab_reports_extraction_athlete_fkey"
            columns: ["extraction_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_clinical_document_extractions"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_lab_reports_supersedes_lab_report_id_fkey"
            columns: ["supersedes_lab_report_id"]
            isOneToOne: false
            referencedRelation: "health_lab_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      health_meal_item_events: {
        Row: {
          athlete_id: string
          client_event_id: string | null
          created_by_auth_user_id: string | null
          event_type: string
          id: string
          meal_item_id: string
          occurred_at: string
          payload: Json | null
          recorded_at: string
        }
        Insert: {
          athlete_id: string
          client_event_id?: string | null
          created_by_auth_user_id?: string | null
          event_type: string
          id?: string
          meal_item_id: string
          occurred_at?: string
          payload?: Json | null
          recorded_at?: string
        }
        Update: {
          athlete_id?: string
          client_event_id?: string | null
          created_by_auth_user_id?: string | null
          event_type?: string
          id?: string
          meal_item_id?: string
          occurred_at?: string
          payload?: Json | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_meal_item_events_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_meal_item_events_item_athlete_fkey"
            columns: ["meal_item_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_meal_items"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_meal_items: {
        Row: {
          athlete_id: string
          basis_amount_snapshot: number | null
          basis_unit_snapshot: string | null
          carbohydrate_g_snapshot: number | null
          confidence: string
          confidence_reason_codes: string[]
          confidence_score: number | null
          correction_reason: string | null
          created_at: string
          created_by_auth_user_id: string | null
          data_quality_snapshot: string | null
          data_source: string
          energy_kcal_snapshot: number | null
          estimation_method: string
          fat_g_snapshot: number | null
          fiber_g_snapshot: number | null
          food_id: string | null
          food_source_id_snapshot: string | null
          household_measure_text: string | null
          id: string
          item_name_snapshot: string
          meal_log_id: string
          preparation_state: string
          protein_g_snapshot: number | null
          quantity: number | null
          recipe_version_id: string | null
          sodium_mg_snapshot: number | null
          source_version_snapshot: string | null
          status: string
          supersedes_item_id: string | null
          unit_code: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          basis_amount_snapshot?: number | null
          basis_unit_snapshot?: string | null
          carbohydrate_g_snapshot?: number | null
          confidence?: string
          confidence_reason_codes?: string[]
          confidence_score?: number | null
          correction_reason?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          data_quality_snapshot?: string | null
          data_source: string
          energy_kcal_snapshot?: number | null
          estimation_method: string
          fat_g_snapshot?: number | null
          fiber_g_snapshot?: number | null
          food_id?: string | null
          food_source_id_snapshot?: string | null
          household_measure_text?: string | null
          id?: string
          item_name_snapshot: string
          meal_log_id: string
          preparation_state?: string
          protein_g_snapshot?: number | null
          quantity?: number | null
          recipe_version_id?: string | null
          sodium_mg_snapshot?: number | null
          source_version_snapshot?: string | null
          status?: string
          supersedes_item_id?: string | null
          unit_code?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          basis_amount_snapshot?: number | null
          basis_unit_snapshot?: string | null
          carbohydrate_g_snapshot?: number | null
          confidence?: string
          confidence_reason_codes?: string[]
          confidence_score?: number | null
          correction_reason?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          data_quality_snapshot?: string | null
          data_source?: string
          energy_kcal_snapshot?: number | null
          estimation_method?: string
          fat_g_snapshot?: number | null
          fiber_g_snapshot?: number | null
          food_id?: string | null
          food_source_id_snapshot?: string | null
          household_measure_text?: string | null
          id?: string
          item_name_snapshot?: string
          meal_log_id?: string
          preparation_state?: string
          protein_g_snapshot?: number | null
          quantity?: number | null
          recipe_version_id?: string | null
          sodium_mg_snapshot?: number | null
          source_version_snapshot?: string | null
          status?: string
          supersedes_item_id?: string | null
          unit_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_meal_items_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "health_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_meal_items_meal_athlete_fkey"
            columns: ["meal_log_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_meal_logs"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_meal_items_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "health_recipe_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_meal_items_supersedes_athlete_fkey"
            columns: ["supersedes_item_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_meal_items"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_meal_logs: {
        Row: {
          athlete_id: string
          created_at: string
          data_source: string
          food_log_day_id: string
          id: string
          meal_type: string
          notes: string | null
          occurred_at: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          data_source: string
          food_log_day_id: string
          id?: string
          meal_type?: string
          notes?: string | null
          occurred_at?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          data_source?: string
          food_log_day_id?: string
          id?: string
          meal_type?: string
          notes?: string | null
          occurred_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_meal_logs_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_meal_logs_day_athlete_fkey"
            columns: ["food_log_day_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_food_log_days"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_muscle_groups: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          region: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          region: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          region?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_muscle_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "health_muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      health_nutrition_daily_states: {
        Row: {
          algorithm_version: string
          athlete_id: string
          calculated_at: string
          carbohydrate_g_consumed: number | null
          carbohydrate_g_max_target: number | null
          carbohydrate_g_min_target: number | null
          carbohydrate_target_status: string
          carbohydrate_unknown_item_count: number
          completeness_status: string
          confidence: string
          confidence_score: number | null
          created_at: string
          energy_kcal_consumed: number | null
          energy_kcal_max_target: number | null
          energy_kcal_min_target: number | null
          energy_target_status: string
          energy_unknown_item_count: number
          fat_g_consumed: number | null
          fat_g_max_target: number | null
          fat_g_min_target: number | null
          fat_target_status: string
          fat_unknown_item_count: number
          fiber_g_consumed: number | null
          fiber_g_max_target: number | null
          fiber_g_min_target: number | null
          fiber_target_status: string
          fiber_unknown_item_count: number
          food_log_day_id: string | null
          id: string
          observed_item_count: number
          observed_meal_count: number
          parameter_set: Json
          plan_version_id: string | null
          protein_g_consumed: number | null
          protein_g_max_target: number | null
          protein_g_min_target: number | null
          protein_target_status: string
          protein_unknown_item_count: number
          reason_codes: string[]
          registration_level: string | null
          sodium_mg_consumed: number | null
          sodium_unknown_item_count: number
          state_date: string
          state_status: string
          target_id: string | null
          updated_at: string
        }
        Insert: {
          algorithm_version?: string
          athlete_id: string
          calculated_at?: string
          carbohydrate_g_consumed?: number | null
          carbohydrate_g_max_target?: number | null
          carbohydrate_g_min_target?: number | null
          carbohydrate_target_status?: string
          carbohydrate_unknown_item_count?: number
          completeness_status?: string
          confidence?: string
          confidence_score?: number | null
          created_at?: string
          energy_kcal_consumed?: number | null
          energy_kcal_max_target?: number | null
          energy_kcal_min_target?: number | null
          energy_target_status?: string
          energy_unknown_item_count?: number
          fat_g_consumed?: number | null
          fat_g_max_target?: number | null
          fat_g_min_target?: number | null
          fat_target_status?: string
          fat_unknown_item_count?: number
          fiber_g_consumed?: number | null
          fiber_g_max_target?: number | null
          fiber_g_min_target?: number | null
          fiber_target_status?: string
          fiber_unknown_item_count?: number
          food_log_day_id?: string | null
          id?: string
          observed_item_count?: number
          observed_meal_count?: number
          parameter_set?: Json
          plan_version_id?: string | null
          protein_g_consumed?: number | null
          protein_g_max_target?: number | null
          protein_g_min_target?: number | null
          protein_target_status?: string
          protein_unknown_item_count?: number
          reason_codes?: string[]
          registration_level?: string | null
          sodium_mg_consumed?: number | null
          sodium_unknown_item_count?: number
          state_date: string
          state_status?: string
          target_id?: string | null
          updated_at?: string
        }
        Update: {
          algorithm_version?: string
          athlete_id?: string
          calculated_at?: string
          carbohydrate_g_consumed?: number | null
          carbohydrate_g_max_target?: number | null
          carbohydrate_g_min_target?: number | null
          carbohydrate_target_status?: string
          carbohydrate_unknown_item_count?: number
          completeness_status?: string
          confidence?: string
          confidence_score?: number | null
          created_at?: string
          energy_kcal_consumed?: number | null
          energy_kcal_max_target?: number | null
          energy_kcal_min_target?: number | null
          energy_target_status?: string
          energy_unknown_item_count?: number
          fat_g_consumed?: number | null
          fat_g_max_target?: number | null
          fat_g_min_target?: number | null
          fat_target_status?: string
          fat_unknown_item_count?: number
          fiber_g_consumed?: number | null
          fiber_g_max_target?: number | null
          fiber_g_min_target?: number | null
          fiber_target_status?: string
          fiber_unknown_item_count?: number
          food_log_day_id?: string | null
          id?: string
          observed_item_count?: number
          observed_meal_count?: number
          parameter_set?: Json
          plan_version_id?: string | null
          protein_g_consumed?: number | null
          protein_g_max_target?: number | null
          protein_g_min_target?: number | null
          protein_target_status?: string
          protein_unknown_item_count?: number
          reason_codes?: string[]
          registration_level?: string | null
          sodium_mg_consumed?: number | null
          sodium_unknown_item_count?: number
          state_date?: string
          state_status?: string
          target_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_nutrition_daily_states_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_nutrition_daily_states_day_athlete_fkey"
            columns: ["food_log_day_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_food_log_days"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_nutrition_daily_states_plan_version_athlete_fkey"
            columns: ["plan_version_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_nutrition_plan_versions"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_nutrition_daily_states_target_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "health_nutrition_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      health_nutrition_decisions: {
        Row: {
          algorithm_version: string
          as_of_date: string
          athlete_id: string
          confidence: string
          created_at: string
          created_by_auth_user_id: string | null
          decision_class: string
          decision_code: string
          decision_status: string
          energy_comparable_day_count: number
          energy_target_adherence_ratio: number | null
          evidence_snapshot: Json
          id: string
          observed_day_count: number
          parameter_set: Json
          plan_adjustment_reason_codes: string[]
          plan_adjustment_status: string
          plan_version_id: string | null
          protein_comparable_day_count: number
          protein_target_adherence_ratio: number | null
          reason_codes: string[]
          record_status: string
          rolling_confidence: string
          rolling_coverage_status: string
          rolling_state_id: string
          strategy_type: string | null
          sufficient_day_count: number
          supersedes_decision_id: string | null
          target_domain: string
          window_days: number
        }
        Insert: {
          algorithm_version?: string
          as_of_date: string
          athlete_id: string
          confidence: string
          created_at?: string
          created_by_auth_user_id?: string | null
          decision_class: string
          decision_code: string
          decision_status: string
          energy_comparable_day_count?: number
          energy_target_adherence_ratio?: number | null
          evidence_snapshot: Json
          id?: string
          observed_day_count?: number
          parameter_set: Json
          plan_adjustment_reason_codes?: string[]
          plan_adjustment_status?: string
          plan_version_id?: string | null
          protein_comparable_day_count?: number
          protein_target_adherence_ratio?: number | null
          reason_codes?: string[]
          record_status?: string
          rolling_confidence: string
          rolling_coverage_status: string
          rolling_state_id: string
          strategy_type?: string | null
          sufficient_day_count?: number
          supersedes_decision_id?: string | null
          target_domain: string
          window_days: number
        }
        Update: {
          algorithm_version?: string
          as_of_date?: string
          athlete_id?: string
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          decision_class?: string
          decision_code?: string
          decision_status?: string
          energy_comparable_day_count?: number
          energy_target_adherence_ratio?: number | null
          evidence_snapshot?: Json
          id?: string
          observed_day_count?: number
          parameter_set?: Json
          plan_adjustment_reason_codes?: string[]
          plan_adjustment_status?: string
          plan_version_id?: string | null
          protein_comparable_day_count?: number
          protein_target_adherence_ratio?: number | null
          reason_codes?: string[]
          record_status?: string
          rolling_confidence?: string
          rolling_coverage_status?: string
          rolling_state_id?: string
          strategy_type?: string | null
          sufficient_day_count?: number
          supersedes_decision_id?: string | null
          target_domain?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_nutrition_decisions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_nutrition_decisions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "health_nutrition_plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_nutrition_decisions_rolling_state_id_fkey"
            columns: ["rolling_state_id"]
            isOneToOne: false
            referencedRelation: "health_nutrition_rolling_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_nutrition_decisions_supersedes_decision_id_fkey"
            columns: ["supersedes_decision_id"]
            isOneToOne: false
            referencedRelation: "health_nutrition_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      health_nutrition_plan_versions: {
        Row: {
          algorithm_version: string | null
          athlete_id: string
          created_at: string
          created_by_auth_user_id: string
          effective_from: string | null
          effective_to: string | null
          id: string
          parameter_set: Json | null
          plan_id: string
          published_at: string | null
          rationale: string | null
          status: string
          strategy_type: string
          title: string
          updated_at: string
          version_number: number
        }
        Insert: {
          algorithm_version?: string | null
          athlete_id: string
          created_at?: string
          created_by_auth_user_id?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          parameter_set?: Json | null
          plan_id: string
          published_at?: string | null
          rationale?: string | null
          status?: string
          strategy_type: string
          title: string
          updated_at?: string
          version_number: number
        }
        Update: {
          algorithm_version?: string | null
          athlete_id?: string
          created_at?: string
          created_by_auth_user_id?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          parameter_set?: Json | null
          plan_id?: string
          published_at?: string | null
          rationale?: string | null
          status?: string
          strategy_type?: string
          title?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_nutrition_plan_versions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_nutrition_plan_versions_plan_athlete_fkey"
            columns: ["plan_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_nutrition_plans"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_nutrition_plans: {
        Row: {
          athlete_id: string
          created_at: string
          created_by_auth_user_id: string
          current_version_id: string | null
          goal_id: string | null
          goal_phase_id: string | null
          id: string
          name: string
          notes: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by_auth_user_id?: string
          current_version_id?: string | null
          goal_id?: string | null
          goal_phase_id?: string | null
          id?: string
          name: string
          notes?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by_auth_user_id?: string
          current_version_id?: string | null
          goal_id?: string | null
          goal_phase_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_nutrition_plans_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_nutrition_plans_current_version_fkey"
            columns: ["current_version_id", "id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_nutrition_plan_versions"
            referencedColumns: ["id", "plan_id", "athlete_id"]
          },
          {
            foreignKeyName: "health_nutrition_plans_goal_athlete_fkey"
            columns: ["goal_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_goals"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_nutrition_plans_goal_phase_athlete_fkey"
            columns: ["goal_phase_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_goal_phases"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_nutrition_rolling_states: {
        Row: {
          algorithm_version: string
          athlete_id: string
          avg_carbohydrate_g: number | null
          avg_energy_kcal: number | null
          avg_fat_g: number | null
          avg_fiber_g: number | null
          avg_protein_g: number | null
          calculated_at: string
          calendar_day_count: number
          confidence: string
          coverage_status: string
          created_at: string
          energy_comparable_day_count: number
          energy_in_target_day_count: number
          energy_target_adherence_ratio: number | null
          id: string
          observation_coverage_ratio: number
          observed_day_count: number
          parameter_set: Json
          partial_day_count: number
          protein_comparable_day_count: number
          protein_in_target_day_count: number
          protein_target_adherence_ratio: number | null
          reason_codes: string[]
          sufficient_coverage_ratio: number
          sufficient_day_count: number
          unobserved_day_count: number
          updated_at: string
          window_days: number
          window_end_date: string
          window_start_date: string
        }
        Insert: {
          algorithm_version?: string
          athlete_id: string
          avg_carbohydrate_g?: number | null
          avg_energy_kcal?: number | null
          avg_fat_g?: number | null
          avg_fiber_g?: number | null
          avg_protein_g?: number | null
          calculated_at?: string
          calendar_day_count: number
          confidence?: string
          coverage_status?: string
          created_at?: string
          energy_comparable_day_count?: number
          energy_in_target_day_count?: number
          energy_target_adherence_ratio?: number | null
          id?: string
          observation_coverage_ratio?: number
          observed_day_count?: number
          parameter_set?: Json
          partial_day_count?: number
          protein_comparable_day_count?: number
          protein_in_target_day_count?: number
          protein_target_adherence_ratio?: number | null
          reason_codes?: string[]
          sufficient_coverage_ratio?: number
          sufficient_day_count?: number
          unobserved_day_count?: number
          updated_at?: string
          window_days: number
          window_end_date: string
          window_start_date: string
        }
        Update: {
          algorithm_version?: string
          athlete_id?: string
          avg_carbohydrate_g?: number | null
          avg_energy_kcal?: number | null
          avg_fat_g?: number | null
          avg_fiber_g?: number | null
          avg_protein_g?: number | null
          calculated_at?: string
          calendar_day_count?: number
          confidence?: string
          coverage_status?: string
          created_at?: string
          energy_comparable_day_count?: number
          energy_in_target_day_count?: number
          energy_target_adherence_ratio?: number | null
          id?: string
          observation_coverage_ratio?: number
          observed_day_count?: number
          parameter_set?: Json
          partial_day_count?: number
          protein_comparable_day_count?: number
          protein_in_target_day_count?: number
          protein_target_adherence_ratio?: number | null
          reason_codes?: string[]
          sufficient_coverage_ratio?: number
          sufficient_day_count?: number
          unobserved_day_count?: number
          updated_at?: string
          window_days?: number
          window_end_date?: string
          window_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_nutrition_rolling_states_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_nutrition_targets: {
        Row: {
          athlete_id: string
          carbohydrate_g_max: number | null
          carbohydrate_g_min: number | null
          created_at: string
          energy_kcal_max: number | null
          energy_kcal_min: number | null
          fat_g_max: number | null
          fat_g_min: number | null
          fiber_g_max: number | null
          fiber_g_min: number | null
          id: string
          notes: string | null
          plan_version_id: string
          protein_g_max: number | null
          protein_g_min: number | null
          target_basis: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          carbohydrate_g_max?: number | null
          carbohydrate_g_min?: number | null
          created_at?: string
          energy_kcal_max?: number | null
          energy_kcal_min?: number | null
          fat_g_max?: number | null
          fat_g_min?: number | null
          fiber_g_max?: number | null
          fiber_g_min?: number | null
          id?: string
          notes?: string | null
          plan_version_id: string
          protein_g_max?: number | null
          protein_g_min?: number | null
          target_basis?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          carbohydrate_g_max?: number | null
          carbohydrate_g_min?: number | null
          created_at?: string
          energy_kcal_max?: number | null
          energy_kcal_min?: number | null
          fat_g_max?: number | null
          fat_g_min?: number | null
          fiber_g_max?: number | null
          fiber_g_min?: number | null
          id?: string
          notes?: string | null
          plan_version_id?: string
          protein_g_max?: number | null
          protein_g_min?: number | null
          target_basis?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_nutrition_targets_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_nutrition_targets_plan_version_athlete_fkey"
            columns: ["plan_version_id", "athlete_id"]
            isOneToOne: true
            referencedRelation: "health_nutrition_plan_versions"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_program_muscle_priorities: {
        Row: {
          athlete_id: string
          created_at: string
          emphasis: string
          muscle_group_id: string
          notes: string | null
          priority_rank: number
          program_version_id: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          emphasis?: string
          muscle_group_id: string
          notes?: string | null
          priority_rank: number
          program_version_id: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          emphasis?: string
          muscle_group_id?: string
          notes?: string | null
          priority_rank?: number
          program_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_program_muscle_priorities_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_program_muscle_priorities_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "health_muscle_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_program_muscle_priorities_version_athlete_fkey"
            columns: ["program_version_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_program_versions"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_program_versions: {
        Row: {
          algorithm_version: string | null
          athlete_id: string
          created_at: string
          created_by_auth_user_id: string
          id: string
          parameter_set: Json | null
          program_id: string
          published_at: string | null
          rationale: string | null
          status: string
          title: string
          updated_at: string
          version_number: number
        }
        Insert: {
          algorithm_version?: string | null
          athlete_id: string
          created_at?: string
          created_by_auth_user_id?: string
          id?: string
          parameter_set?: Json | null
          program_id: string
          published_at?: string | null
          rationale?: string | null
          status?: string
          title: string
          updated_at?: string
          version_number: number
        }
        Update: {
          algorithm_version?: string | null
          athlete_id?: string
          created_at?: string
          created_by_auth_user_id?: string
          id?: string
          parameter_set?: Json | null
          program_id?: string
          published_at?: string | null
          rationale?: string | null
          status?: string
          title?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_program_versions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_program_versions_program_athlete_fkey"
            columns: ["program_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_programs"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_programs: {
        Row: {
          athlete_id: string
          created_at: string
          created_by_auth_user_id: string
          current_version_id: string | null
          goal_id: string | null
          goal_phase_id: string | null
          id: string
          name: string
          notes: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by_auth_user_id?: string
          current_version_id?: string | null
          goal_id?: string | null
          goal_phase_id?: string | null
          id?: string
          name: string
          notes?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by_auth_user_id?: string
          current_version_id?: string | null
          goal_id?: string | null
          goal_phase_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_programs_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_programs_current_version_fkey"
            columns: ["current_version_id", "id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_program_versions"
            referencedColumns: ["id", "program_id", "athlete_id"]
          },
          {
            foreignKeyName: "health_programs_goal_athlete_fkey"
            columns: ["goal_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_goals"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_programs_goal_phase_athlete_fkey"
            columns: ["goal_phase_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_goal_phases"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_recipe_ingredient_snapshots: {
        Row: {
          athlete_id: string | null
          basis_amount_snapshot: number | null
          basis_unit_snapshot: string | null
          carbohydrate_g_snapshot: number | null
          created_at: string
          data_quality_snapshot: string | null
          energy_kcal_snapshot: number | null
          fat_g_snapshot: number | null
          fiber_g_snapshot: number | null
          food_id: string
          food_name_snapshot: string
          food_source_id_snapshot: string | null
          id: string
          protein_g_snapshot: number | null
          quantity: number
          recipe_ingredient_id: string
          recipe_version_id: string
          sodium_mg_snapshot: number | null
          source_version_snapshot: string | null
          unit_code: string
        }
        Insert: {
          athlete_id?: string | null
          basis_amount_snapshot?: number | null
          basis_unit_snapshot?: string | null
          carbohydrate_g_snapshot?: number | null
          created_at?: string
          data_quality_snapshot?: string | null
          energy_kcal_snapshot?: number | null
          fat_g_snapshot?: number | null
          fiber_g_snapshot?: number | null
          food_id: string
          food_name_snapshot: string
          food_source_id_snapshot?: string | null
          id?: string
          protein_g_snapshot?: number | null
          quantity: number
          recipe_ingredient_id: string
          recipe_version_id: string
          sodium_mg_snapshot?: number | null
          source_version_snapshot?: string | null
          unit_code: string
        }
        Update: {
          athlete_id?: string | null
          basis_amount_snapshot?: number | null
          basis_unit_snapshot?: string | null
          carbohydrate_g_snapshot?: number | null
          created_at?: string
          data_quality_snapshot?: string | null
          energy_kcal_snapshot?: number | null
          fat_g_snapshot?: number | null
          fiber_g_snapshot?: number | null
          food_id?: string
          food_name_snapshot?: string
          food_source_id_snapshot?: string | null
          id?: string
          protein_g_snapshot?: number | null
          quantity?: number
          recipe_ingredient_id?: string
          recipe_version_id?: string
          sodium_mg_snapshot?: number | null
          source_version_snapshot?: string | null
          unit_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_recipe_ingredient_snapshots_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "health_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_recipe_ingredient_snapshots_recipe_ingredient_id_fkey"
            columns: ["recipe_ingredient_id"]
            isOneToOne: false
            referencedRelation: "health_recipe_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_recipe_ingredient_snapshots_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "health_recipe_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_recipe_ingredient_snapshots_version_ingredient_fkey"
            columns: ["recipe_ingredient_id", "recipe_version_id"]
            isOneToOne: false
            referencedRelation: "health_recipe_ingredients"
            referencedColumns: ["id", "recipe_version_id"]
          },
        ]
      }
      health_recipe_ingredients: {
        Row: {
          athlete_id: string | null
          created_at: string
          food_id: string
          id: string
          is_optional: boolean
          notes: string | null
          preparation_state: string
          quantity: number
          recipe_version_id: string
          sequence_order: number
          unit_code: string
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string
          food_id: string
          id?: string
          is_optional?: boolean
          notes?: string | null
          preparation_state?: string
          quantity: number
          recipe_version_id: string
          sequence_order: number
          unit_code: string
        }
        Update: {
          athlete_id?: string | null
          created_at?: string
          food_id?: string
          id?: string
          is_optional?: boolean
          notes?: string | null
          preparation_state?: string
          quantity?: number
          recipe_version_id?: string
          sequence_order?: number
          unit_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "health_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_recipe_ingredients_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "health_recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      health_recipe_nutrition_snapshots: {
        Row: {
          algorithm_version: string | null
          athlete_id: string | null
          basis_amount: number | null
          basis_unit: string | null
          calculated_at: string
          calculation_method: string
          carbohydrate_g: number | null
          confidence: string
          confidence_reason_codes: string[]
          created_at: string
          energy_kcal: number | null
          fat_g: number | null
          fiber_g: number | null
          id: string
          parameter_set: Json | null
          protein_g: number | null
          recipe_version_id: string
          sodium_mg: number | null
        }
        Insert: {
          algorithm_version?: string | null
          athlete_id?: string | null
          basis_amount?: number | null
          basis_unit?: string | null
          calculated_at?: string
          calculation_method?: string
          carbohydrate_g?: number | null
          confidence?: string
          confidence_reason_codes?: string[]
          created_at?: string
          energy_kcal?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          parameter_set?: Json | null
          protein_g?: number | null
          recipe_version_id: string
          sodium_mg?: number | null
        }
        Update: {
          algorithm_version?: string | null
          athlete_id?: string | null
          basis_amount?: number | null
          basis_unit?: string | null
          calculated_at?: string
          calculation_method?: string
          carbohydrate_g?: number | null
          confidence?: string
          confidence_reason_codes?: string[]
          created_at?: string
          energy_kcal?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          parameter_set?: Json | null
          protein_g?: number | null
          recipe_version_id?: string
          sodium_mg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_recipe_nutrition_snapshots_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: true
            referencedRelation: "health_recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      health_recipe_versions: {
        Row: {
          athlete_id: string | null
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          preparation_notes: string | null
          published_at: string | null
          recipe_id: string
          servings: number | null
          status: string
          title: string
          updated_at: string
          version_number: number
          yield_amount: number | null
          yield_unit: string | null
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          preparation_notes?: string | null
          published_at?: string | null
          recipe_id: string
          servings?: number | null
          status?: string
          title: string
          updated_at?: string
          version_number: number
          yield_amount?: number | null
          yield_unit?: string | null
        }
        Update: {
          athlete_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          preparation_notes?: string | null
          published_at?: string | null
          recipe_id?: string
          servings?: number | null
          status?: string
          title?: string
          updated_at?: string
          version_number?: number
          yield_amount?: number | null
          yield_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "health_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_recipes: {
        Row: {
          athlete_id: string | null
          created_at: string
          created_by_auth_user_id: string | null
          current_version_id: string | null
          id: string
          name: string
          owner_scope: string
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          current_version_id?: string | null
          id?: string
          name: string
          owner_scope?: string
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          current_version_id?: string | null
          id?: string
          name?: string
          owner_scope?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_recipes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_recipes_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "health_recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      health_recovery_checkins: {
        Row: {
          athlete_id: string
          checkin_event_id: string
          client_event_id: string | null
          confidence: string
          created_at: string
          created_by_auth_user_id: string | null
          data_source: string
          id: string
          metric_code: string
          observed_at: string
          observed_on: string
          raw_text: string | null
          scale_version: string
          status: string
          status_changed_at: string | null
          supersedes_checkin_id: string | null
          value_ordinal: number | null
          void_reason: string | null
        }
        Insert: {
          athlete_id: string
          checkin_event_id: string
          client_event_id?: string | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          id?: string
          metric_code: string
          observed_at: string
          observed_on: string
          raw_text?: string | null
          scale_version?: string
          status?: string
          status_changed_at?: string | null
          supersedes_checkin_id?: string | null
          value_ordinal?: number | null
          void_reason?: string | null
        }
        Update: {
          athlete_id?: string
          checkin_event_id?: string
          client_event_id?: string | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          id?: string
          metric_code?: string
          observed_at?: string
          observed_on?: string
          raw_text?: string | null
          scale_version?: string
          status?: string
          status_changed_at?: string | null
          supersedes_checkin_id?: string | null
          value_ordinal?: number | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_recovery_checkins_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_recovery_checkins_supersedes_checkin_id_fkey"
            columns: ["supersedes_checkin_id"]
            isOneToOne: false
            referencedRelation: "health_recovery_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      health_session_template_exercises: {
        Row: {
          athlete_id: string
          created_at: string
          exercise_id: string
          id: string
          is_optional: boolean
          planned_sets_max: number | null
          planned_sets_min: number | null
          prescription_notes: string | null
          reps_max: number | null
          reps_min: number | null
          rest_seconds: number | null
          rir_target: number | null
          sequence_order: number
          session_template_id: string
          substitution_group: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          exercise_id: string
          id?: string
          is_optional?: boolean
          planned_sets_max?: number | null
          planned_sets_min?: number | null
          prescription_notes?: string | null
          reps_max?: number | null
          reps_min?: number | null
          rest_seconds?: number | null
          rir_target?: number | null
          sequence_order: number
          session_template_id: string
          substitution_group?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          exercise_id?: string
          id?: string
          is_optional?: boolean
          planned_sets_max?: number | null
          planned_sets_min?: number | null
          prescription_notes?: string | null
          reps_max?: number | null
          reps_min?: number | null
          rest_seconds?: number | null
          rir_target?: number | null
          sequence_order?: number
          session_template_id?: string
          substitution_group?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_session_template_exercises_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_session_template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "health_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_session_template_exercises_template_athlete_fkey"
            columns: ["session_template_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_session_templates"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_session_templates: {
        Row: {
          athlete_id: string
          code: string
          created_at: string
          id: string
          name: string
          notes: string | null
          program_version_id: string
          sequence_order: number
          session_kind: string
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          code: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          program_version_id: string
          sequence_order: number
          session_kind?: string
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          program_version_id?: string
          sequence_order?: number
          session_kind?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_session_templates_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_session_templates_version_athlete_fkey"
            columns: ["program_version_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_program_versions"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_sleep_device_observations: {
        Row: {
          athlete_id: string
          client_event_id: string | null
          confidence: string
          created_at: string
          created_by_auth_user_id: string | null
          device_model: string | null
          external_id: string | null
          id: string
          metric_code: string
          numeric_value: number
          observed_at: string
          observed_on: string
          provider: string
          provider_algorithm_version: string | null
          raw_metadata: Json | null
          status: string
          status_changed_at: string | null
          unit_code: string
          void_reason: string | null
          window_end_at: string | null
          window_start_at: string | null
        }
        Insert: {
          athlete_id: string
          client_event_id?: string | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          device_model?: string | null
          external_id?: string | null
          id?: string
          metric_code: string
          numeric_value: number
          observed_at: string
          observed_on: string
          provider: string
          provider_algorithm_version?: string | null
          raw_metadata?: Json | null
          status?: string
          status_changed_at?: string | null
          unit_code: string
          void_reason?: string | null
          window_end_at?: string | null
          window_start_at?: string | null
        }
        Update: {
          athlete_id?: string
          client_event_id?: string | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          device_model?: string | null
          external_id?: string | null
          id?: string
          metric_code?: string
          numeric_value?: number
          observed_at?: string
          observed_on?: string
          provider?: string
          provider_algorithm_version?: string | null
          raw_metadata?: Json | null
          status?: string
          status_changed_at?: string | null
          unit_code?: string
          void_reason?: string | null
          window_end_at?: string | null
          window_start_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_sleep_device_observations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_sleep_periods: {
        Row: {
          athlete_id: string
          awake_during_period_minutes: number | null
          awakenings_count: number | null
          bed_at: string | null
          calculated_sleep_minutes: number | null
          calculated_time_in_bed_minutes: number | null
          client_event_id: string | null
          confidence: string
          created_at: string
          created_by_auth_user_id: string | null
          data_source: string
          declared_sleep_minutes: number | null
          final_wake_at: string | null
          id: string
          notes: string | null
          out_of_bed_at: string | null
          period_type: string
          sleep_date: string
          sleep_start_at: string | null
          status: string
          status_changed_at: string | null
          supersedes_sleep_period_id: string | null
          timezone: string | null
          void_reason: string | null
        }
        Insert: {
          athlete_id: string
          awake_during_period_minutes?: number | null
          awakenings_count?: number | null
          bed_at?: string | null
          calculated_sleep_minutes?: number | null
          calculated_time_in_bed_minutes?: number | null
          client_event_id?: string | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          declared_sleep_minutes?: number | null
          final_wake_at?: string | null
          id?: string
          notes?: string | null
          out_of_bed_at?: string | null
          period_type?: string
          sleep_date: string
          sleep_start_at?: string | null
          status?: string
          status_changed_at?: string | null
          supersedes_sleep_period_id?: string | null
          timezone?: string | null
          void_reason?: string | null
        }
        Update: {
          athlete_id?: string
          awake_during_period_minutes?: number | null
          awakenings_count?: number | null
          bed_at?: string | null
          calculated_sleep_minutes?: number | null
          calculated_time_in_bed_minutes?: number | null
          client_event_id?: string | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          declared_sleep_minutes?: number | null
          final_wake_at?: string | null
          id?: string
          notes?: string | null
          out_of_bed_at?: string | null
          period_type?: string
          sleep_date?: string
          sleep_start_at?: string | null
          status?: string
          status_changed_at?: string | null
          supersedes_sleep_period_id?: string | null
          timezone?: string | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_sleep_periods_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_sleep_periods_supersedes_sleep_period_id_fkey"
            columns: ["supersedes_sleep_period_id"]
            isOneToOne: false
            referencedRelation: "health_sleep_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      health_sleep_recovery_rolling_states: {
        Row: {
          algorithm_version: string
          as_of_date: string
          athlete_id: string
          average_fatigue: number | null
          average_readiness: number | null
          average_recovery: number | null
          average_sleep_minutes: number | null
          average_sleep_quality: number | null
          computed_at: string
          confidence: string
          fatigue_coverage: string
          fatigue_observed_days: number
          id: string
          readiness_coverage: string
          readiness_observed_days: number
          reason_codes: string[]
          recovery_coverage: string
          recovery_observed_days: number
          sleep_duration_coverage: string
          sleep_duration_observed_days: number
          sleep_duration_variability_minutes: number | null
          sleep_quality_coverage: string
          sleep_quality_observed_days: number
          sleep_timing_coverage: string
          sleep_timing_observed_days: number
          window_days: number
          window_start_date: string
        }
        Insert: {
          algorithm_version?: string
          as_of_date: string
          athlete_id: string
          average_fatigue?: number | null
          average_readiness?: number | null
          average_recovery?: number | null
          average_sleep_minutes?: number | null
          average_sleep_quality?: number | null
          computed_at?: string
          confidence: string
          fatigue_coverage: string
          fatigue_observed_days?: number
          id?: string
          readiness_coverage: string
          readiness_observed_days?: number
          reason_codes?: string[]
          recovery_coverage: string
          recovery_observed_days?: number
          sleep_duration_coverage: string
          sleep_duration_observed_days?: number
          sleep_duration_variability_minutes?: number | null
          sleep_quality_coverage: string
          sleep_quality_observed_days?: number
          sleep_timing_coverage: string
          sleep_timing_observed_days?: number
          window_days: number
          window_start_date: string
        }
        Update: {
          algorithm_version?: string
          as_of_date?: string
          athlete_id?: string
          average_fatigue?: number | null
          average_readiness?: number | null
          average_recovery?: number | null
          average_sleep_minutes?: number | null
          average_sleep_quality?: number | null
          computed_at?: string
          confidence?: string
          fatigue_coverage?: string
          fatigue_observed_days?: number
          id?: string
          readiness_coverage?: string
          readiness_observed_days?: number
          reason_codes?: string[]
          recovery_coverage?: string
          recovery_observed_days?: number
          sleep_duration_coverage?: string
          sleep_duration_observed_days?: number
          sleep_duration_variability_minutes?: number | null
          sleep_quality_coverage?: string
          sleep_quality_observed_days?: number
          sleep_timing_coverage?: string
          sleep_timing_observed_days?: number
          window_days?: number
          window_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_sleep_recovery_rolling_states_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_training_locations: {
        Row: {
          athlete_id: string
          created_at: string
          created_by_auth_user_id: string
          id: string
          is_primary: boolean
          location_type: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by_auth_user_id?: string
          id?: string
          is_primary?: boolean
          location_type?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by_auth_user_id?: string
          id?: string
          is_primary?: boolean
          location_type?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_training_locations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      health_vital_observations: {
        Row: {
          athlete_id: string
          client_event_id: string | null
          condition_text: string | null
          confidence: string
          created_at: string
          created_by_auth_user_id: string | null
          data_source: string
          device_text: string | null
          id: string
          metric_code: string
          numeric_value: number
          observed_at: string
          observed_on: string
          secondary_numeric_value: number | null
          status: string
          status_changed_at: string | null
          supersedes_vital_observation_id: string | null
          unit_code: string
          void_reason: string | null
        }
        Insert: {
          athlete_id: string
          client_event_id?: string | null
          condition_text?: string | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          device_text?: string | null
          id?: string
          metric_code: string
          numeric_value: number
          observed_at: string
          observed_on: string
          secondary_numeric_value?: number | null
          status?: string
          status_changed_at?: string | null
          supersedes_vital_observation_id?: string | null
          unit_code: string
          void_reason?: string | null
        }
        Update: {
          athlete_id?: string
          client_event_id?: string | null
          condition_text?: string | null
          confidence?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          data_source?: string
          device_text?: string | null
          id?: string
          metric_code?: string
          numeric_value?: number
          observed_at?: string
          observed_on?: string
          secondary_numeric_value?: number | null
          status?: string
          status_changed_at?: string | null
          supersedes_vital_observation_id?: string | null
          unit_code?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_vital_observations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_vital_observations_supersedes_vital_observation_id_fkey"
            columns: ["supersedes_vital_observation_id"]
            isOneToOne: false
            referencedRelation: "health_vital_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      health_workout_events: {
        Row: {
          athlete_id: string
          client_event_id: string
          created_by_auth_user_id: string | null
          event_type: string
          id: string
          occurred_at: string
          payload: Json | null
          recorded_at: string
          session_id: string
          source: string
          workout_exercise_id: string | null
          workout_set_id: string | null
        }
        Insert: {
          athlete_id: string
          client_event_id: string
          created_by_auth_user_id?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          recorded_at?: string
          session_id: string
          source?: string
          workout_exercise_id?: string | null
          workout_set_id?: string | null
        }
        Update: {
          athlete_id?: string
          client_event_id?: string
          created_by_auth_user_id?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          recorded_at?: string
          session_id?: string
          source?: string
          workout_exercise_id?: string | null
          workout_set_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_workout_events_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_workout_events_session_athlete_fkey"
            columns: ["session_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_workout_sessions"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_workout_events_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "health_workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_workout_events_workout_set_id_fkey"
            columns: ["workout_set_id"]
            isOneToOne: false
            referencedRelation: "health_workout_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      health_workout_exercises: {
        Row: {
          athlete_id: string
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          origin: string
          planned_reps_max: number | null
          planned_reps_min: number | null
          planned_rest_seconds: number | null
          planned_rir_target: number | null
          planned_sets_max: number | null
          planned_sets_min: number | null
          replaced_from_exercise_id: string | null
          sequence_order: number
          session_id: string
          status: string
          template_exercise_id: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          origin?: string
          planned_reps_max?: number | null
          planned_reps_min?: number | null
          planned_rest_seconds?: number | null
          planned_rir_target?: number | null
          planned_sets_max?: number | null
          planned_sets_min?: number | null
          replaced_from_exercise_id?: string | null
          sequence_order: number
          session_id: string
          status?: string
          template_exercise_id?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          origin?: string
          planned_reps_max?: number | null
          planned_reps_min?: number | null
          planned_rest_seconds?: number | null
          planned_rir_target?: number | null
          planned_sets_max?: number | null
          planned_sets_min?: number | null
          replaced_from_exercise_id?: string | null
          sequence_order?: number
          session_id?: string
          status?: string
          template_exercise_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_workout_exercises_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "health_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_workout_exercises_replaced_from_exercise_id_fkey"
            columns: ["replaced_from_exercise_id"]
            isOneToOne: false
            referencedRelation: "health_workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_workout_exercises_session_athlete_fkey"
            columns: ["session_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_workout_sessions"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_workout_exercises_template_exercise_id_fkey"
            columns: ["template_exercise_id"]
            isOneToOne: false
            referencedRelation: "health_session_template_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      health_workout_sessions: {
        Row: {
          athlete_id: string
          created_at: string
          created_by_auth_user_id: string
          ended_at: string | null
          id: string
          notes: string | null
          program_version_id: string | null
          queue_entry_id: string | null
          session_template_id: string | null
          source: string
          start_client_event_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by_auth_user_id?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          program_version_id?: string | null
          queue_entry_id?: string | null
          session_template_id?: string | null
          source?: string
          start_client_event_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by_auth_user_id?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          program_version_id?: string | null
          queue_entry_id?: string | null
          session_template_id?: string | null
          source?: string
          start_client_event_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_workout_sessions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_workout_sessions_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "health_cch_queue_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_workout_sessions_template_athlete_fkey"
            columns: ["session_template_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_session_templates"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "health_workout_sessions_version_athlete_fkey"
            columns: ["program_version_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_program_versions"
            referencedColumns: ["id", "athlete_id"]
          },
        ]
      }
      health_workout_sets: {
        Row: {
          athlete_id: string
          client_event_id: string
          completed_at: string | null
          created_at: string
          id: string
          load_unit: string
          load_value: number | null
          notes: string | null
          reps: number | null
          rest_seconds: number | null
          rir: number | null
          session_id: string
          set_number: number
          set_type: string
          status: string
          updated_at: string
          workout_exercise_id: string
        }
        Insert: {
          athlete_id: string
          client_event_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          load_unit?: string
          load_value?: number | null
          notes?: string | null
          reps?: number | null
          rest_seconds?: number | null
          rir?: number | null
          session_id: string
          set_number: number
          set_type?: string
          status?: string
          updated_at?: string
          workout_exercise_id: string
        }
        Update: {
          athlete_id?: string
          client_event_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          load_unit?: string
          load_value?: number | null
          notes?: string | null
          reps?: number | null
          rest_seconds?: number | null
          rir?: number | null
          session_id?: string
          set_number?: number
          set_type?: string
          status?: string
          updated_at?: string
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_workout_sets_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "health_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_workout_sets_exercise_session_athlete_fkey"
            columns: ["workout_exercise_id", "session_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "health_workout_exercises"
            referencedColumns: ["id", "session_id", "athlete_id"]
          },
        ]
      }
      inbox_entries: {
        Row: {
          attachments: Json
          content: string | null
          created_at: string
          decided_at: string | null
          decision: string | null
          entry_type: string
          estimated_minutes: number | null
          id: string
          linked_task_id: string | null
          media_path: string | null
          media_url: string | null
          planned_bucket: string | null
          related_node_id: string | null
          status: string
          updated_at: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          attachments?: Json
          content?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          entry_type: string
          estimated_minutes?: number | null
          id?: string
          linked_task_id?: string | null
          media_path?: string | null
          media_url?: string | null
          planned_bucket?: string | null
          related_node_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          attachments?: Json
          content?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          entry_type?: string
          estimated_minutes?: number | null
          id?: string
          linked_task_id?: string | null
          media_path?: string | null
          media_url?: string | null
          planned_bucket?: string | null
          related_node_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_entries_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_entries_related_node_id_fkey"
            columns: ["related_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhook_receipts: {
        Row: {
          created_at: string
          deduplication_key: string
          error_message: string | null
          event_type: string | null
          id: string
          processed_at: string | null
          processing_status: string
          provider_instance_ref: string | null
          provider_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deduplication_key: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          processed_at?: string | null
          processing_status?: string
          provider_instance_ref?: string | null
          provider_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deduplication_key?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          processed_at?: string | null
          processing_status?: string
          provider_instance_ref?: string | null
          provider_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          location: string
          location_id: string | null
          product_id: string
          quantity: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          id?: string
          location?: string
          location_id?: string | null
          product_id: string
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          location?: string
          location_id?: string | null
          product_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          event_key: string | null
          from_location: string | null
          id: string
          location: string | null
          movement_type: string
          new_balance: number
          notes: string | null
          previous_balance: number
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          to_location: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_key?: string | null
          from_location?: string | null
          id?: string
          location?: string | null
          movement_type: string
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          to_location?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_key?: string | null
          from_location?: string | null
          id?: string
          location?: string | null
          movement_type?: string
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          to_location?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          access_key: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          contact_id: string | null
          created_at: string
          customer_name: string | null
          id: string
          invoice_number: string | null
          invoice_type: string
          issue_date: string | null
          notes: string | null
          operation_nature: string | null
          order_id: string | null
          pdf_url: string | null
          status: string
          updated_at: string
          value: number
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          invoice_number?: string | null
          invoice_type?: string
          issue_date?: string | null
          notes?: string | null
          operation_nature?: string | null
          order_id?: string | null
          pdf_url?: string | null
          status?: string
          updated_at?: string
          value?: number
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          invoice_number?: string | null
          invoice_type?: string
          issue_date?: string | null
          notes?: string | null
          operation_nature?: string | null
          order_id?: string | null
          pdf_url?: string | null
          status?: string
          updated_at?: string
          value?: number
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maltodextrina_sealed_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_key: string
          id: string
          movement_type: string
          new_balance: number
          notes: string | null
          previous_balance: number
          reference_id: string
          reference_type: string
          sacks: number
          storage_location_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_key: string
          id?: string
          movement_type: string
          new_balance: number
          notes?: string | null
          previous_balance: number
          reference_id: string
          reference_type: string
          sacks: number
          storage_location_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_key?: string
          id?: string
          movement_type?: string
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          reference_id?: string
          reference_type?: string
          sacks?: number
          storage_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maltodextrina_sealed_events_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      maltodextrina_sealed_stock: {
        Row: {
          sacks: number
          storage_location_id: string
          updated_at: string
        }
        Insert: {
          sacks?: number
          storage_location_id: string
          updated_at?: string
        }
        Update: {
          sacks?: number
          storage_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maltodextrina_sealed_stock_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: true
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_product_mapping_items: {
        Row: {
          created_at: string
          id: string
          mapping_id: string
          physical_multiplier: number
          position: number
          product_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mapping_id: string
          physical_multiplier: number
          position?: number
          product_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mapping_id?: string
          physical_multiplier?: number
          position?: number
          product_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_product_mapping_items_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_product_mapping_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_product_mapping_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_product_mappings: {
        Row: {
          channel_account_id: string | null
          created_at: string
          external_item_id: string | null
          external_item_key: string
          external_model_id: string | null
          external_product_title: string | null
          external_variation: string | null
          id: string
          marketplace: string
          marketplace_account: string
          physical_multiplier: number
          product_id: string | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          channel_account_id?: string | null
          created_at?: string
          external_item_id?: string | null
          external_item_key: string
          external_model_id?: string | null
          external_product_title?: string | null
          external_variation?: string | null
          id?: string
          marketplace: string
          marketplace_account: string
          physical_multiplier?: number
          product_id?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          channel_account_id?: string | null
          created_at?: string
          external_item_id?: string | null
          external_item_key?: string
          external_model_id?: string | null
          external_product_title?: string | null
          external_variation?: string | null
          id?: string
          marketplace?: string
          marketplace_account?: string
          physical_multiplier?: number
          product_id?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_product_mappings_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_product_mappings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_raw_snapshots: {
        Row: {
          channel_account_id: string | null
          created_at: string
          endpoint: string
          environment: string
          external_entity_id: string
          external_entity_type: string
          id: string
          observed_at: string
          payload: Json
          payload_hash: string
          request_id: string | null
          source: string
        }
        Insert: {
          channel_account_id?: string | null
          created_at?: string
          endpoint: string
          environment: string
          external_entity_id: string
          external_entity_type: string
          id?: string
          observed_at?: string
          payload: Json
          payload_hash: string
          request_id?: string | null
          source: string
        }
        Update: {
          channel_account_id?: string | null
          created_at?: string
          endpoint?: string
          environment?: string
          external_entity_id?: string
          external_entity_type?: string
          id?: string
          observed_at?: string
          payload?: Json
          payload_hash?: string
          request_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_raw_snapshots_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_settlement_orders: {
        Row: {
          created_at: string
          fee_value: number
          gross_value: number
          id: string
          net_value: number
          order_id: string
          settlement_id: string
        }
        Insert: {
          created_at?: string
          fee_value?: number
          gross_value?: number
          id?: string
          net_value?: number
          order_id: string
          settlement_id: string
        }
        Update: {
          created_at?: string
          fee_value?: number
          gross_value?: number
          id?: string
          net_value?: number
          order_id?: string
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_settlement_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_settlement_orders_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "marketplace_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_settlements: {
        Row: {
          channel_account_id: string | null
          created_at: string
          fee_value: number
          financial_account_id: string | null
          gross_value: number
          id: string
          marketplace: string
          marketplace_account: string | null
          net_value: number
          notes: string | null
          platform_id: string | null
          settlement_date: string
          status: string
          updated_at: string
        }
        Insert: {
          channel_account_id?: string | null
          created_at?: string
          fee_value?: number
          financial_account_id?: string | null
          gross_value?: number
          id?: string
          marketplace: string
          marketplace_account?: string | null
          net_value?: number
          notes?: string | null
          platform_id?: string | null
          settlement_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          channel_account_id?: string | null
          created_at?: string
          fee_value?: number
          financial_account_id?: string | null
          gross_value?: number
          id?: string
          marketplace?: string
          marketplace_account?: string | null
          net_value?: number
          notes?: string | null
          platform_id?: string | null
          settlement_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_settlements_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_settlements_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_settlements_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_items: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          item_type: string
          meeting_id: string
          notes: string | null
          order_index: number
          owner_id: string | null
          status: string
          task_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          item_type?: string
          meeting_id: string
          notes?: string | null
          order_index?: number
          owner_id?: string | null
          status?: string
          task_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          item_type?: string
          meeting_id?: string
          notes?: string | null
          order_index?: number
          owner_id?: string | null
          status?: string
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          confirmed: boolean | null
          id: string
          meeting_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          confirmed?: boolean | null
          id?: string
          meeting_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          confirmed?: boolean | null
          id?: string
          meeting_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          decisions: string | null
          duration_minutes: number
          id: string
          location: string | null
          meeting_date: string
          notes: string | null
          objective: string | null
          owner_id: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decisions?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_date: string
          notes?: string | null
          objective?: string | null
          owner_id?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decisions?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_date?: string
          notes?: string | null
          objective?: string | null
          owner_id?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goals: {
        Row: {
          achieved_value: number
          created_at: string
          goal_type: string
          id: string
          month: number
          target_value: number
          updated_at: string
          user_id: string | null
          year: number
        }
        Insert: {
          achieved_value?: number
          created_at?: string
          goal_type: string
          id?: string
          month: number
          target_value?: number
          updated_at?: string
          user_id?: string | null
          year: number
        }
        Update: {
          achieved_value?: number
          created_at?: string
          goal_type?: string
          id?: string
          month?: number
          target_value?: number
          updated_at?: string
          user_id?: string | null
          year?: number
        }
        Relationships: []
      }
      nodes: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_visible: boolean
          media_urls: Json | null
          node_type: string | null
          order_index: number
          parent_id: string | null
          responsible_user_id: string | null
          title: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_visible?: boolean
          media_urls?: Json | null
          node_type?: string | null
          order_index?: number
          parent_id?: string | null
          responsible_user_id?: string | null
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_visible?: boolean
          media_urls?: Json | null
          node_type?: string | null
          order_index?: number
          parent_id?: string | null
          responsible_user_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      on_hold_log: {
        Row: {
          action: string
          created_at: string
          id: string
          previous_data: Json | null
          task_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          previous_data?: Json | null
          task_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          previous_data?: Json | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "on_hold_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_incidents: {
        Row: {
          applied_quantity: number
          area: string
          created_at: string
          created_by: string | null
          description: string | null
          event_key: string | null
          expected_quantity: number | null
          id: string
          incident_type: string
          metadata: Json
          pending_quantity: number
          product_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source_id: string | null
          source_item_id: string | null
          source_type: string | null
          status: string
          title: string
          unit: string | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          applied_quantity?: number
          area: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_key?: string | null
          expected_quantity?: number | null
          id?: string
          incident_type: string
          metadata?: Json
          pending_quantity?: number
          product_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_id?: string | null
          source_item_id?: string | null
          source_type?: string | null
          status?: string
          title: string
          unit?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          applied_quantity?: number
          area?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_key?: string | null
          expected_quantity?: number | null
          id?: string
          incident_type?: string
          metadata?: Json
          pending_quantity?: number
          product_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_id?: string | null
          source_item_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
          unit?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_incidents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_incidents_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_type: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          mime_type: string | null
          order_id: string
          source: string | null
          storage_bucket: string | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_type: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          order_id: string
          source?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_type?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          order_id?: string
          source?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          commercial_conversion_factor: number | null
          commercial_group_id: string | null
          commercial_presentation_id: string | null
          commercial_presentation_name: string | null
          commercial_quantity: number | null
          commercial_unit_label: string | null
          id: string
          notes: string | null
          order_id: string
          physical_unit_label: string | null
          product_id: string
          quantity: number
          unit_price: number | null
          variant_id: string | null
        }
        Insert: {
          commercial_conversion_factor?: number | null
          commercial_group_id?: string | null
          commercial_presentation_id?: string | null
          commercial_presentation_name?: string | null
          commercial_quantity?: number | null
          commercial_unit_label?: string | null
          id?: string
          notes?: string | null
          order_id: string
          physical_unit_label?: string | null
          product_id: string
          quantity?: number
          unit_price?: number | null
          variant_id?: string | null
        }
        Update: {
          commercial_conversion_factor?: number | null
          commercial_group_id?: string | null
          commercial_presentation_id?: string | null
          commercial_presentation_name?: string | null
          commercial_quantity?: number | null
          commercial_unit_label?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          physical_unit_label?: string | null
          product_id?: string
          quantity?: number
          unit_price?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_commercial_presentation_id_fkey"
            columns: ["commercial_presentation_id"]
            isOneToOne: false
            referencedRelation: "commercial_presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_separation: {
        Row: {
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          first_printed_at: string | null
          first_printed_by: string | null
          id: string
          logistics_mode: string | null
          operational_destination: string | null
          order_id: string
          print_count: number
          separation_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          first_printed_at?: string | null
          first_printed_by?: string | null
          id?: string
          logistics_mode?: string | null
          operational_destination?: string | null
          order_id: string
          print_count?: number
          separation_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          first_printed_at?: string | null
          first_printed_by?: string | null
          id?: string
          logistics_mode?: string | null
          operational_destination?: string | null
          order_id?: string
          print_count?: number
          separation_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_separation_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel: string | null
          channel_account_id: string | null
          contact_id: string | null
          created_at: string
          customer_contact: string | null
          customer_name: string | null
          deleted_at: string | null
          delivery_date: string | null
          delivery_snapshot: Json
          discount_amount: number
          due_date: string | null
          financial_account_id: string | null
          financial_due_date: string | null
          id: string
          internal_order_number: string
          logistics_mode: string | null
          marketplace_account: string | null
          marketplace_metadata: Json
          notes: string | null
          operational_destination: string | null
          operational_destination_details: Json
          operational_status: string
          order_date: string
          order_number: string | null
          order_type: string
          payment_method: string | null
          payment_status: string
          production_date: string | null
          production_notes: string | null
          sale_origin: string | null
          sale_request_key: string | null
          shipping_amount: number
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          channel?: string | null
          channel_account_id?: string | null
          contact_id?: string | null
          created_at?: string
          customer_contact?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          delivery_snapshot?: Json
          discount_amount?: number
          due_date?: string | null
          financial_account_id?: string | null
          financial_due_date?: string | null
          id?: string
          internal_order_number: string
          logistics_mode?: string | null
          marketplace_account?: string | null
          marketplace_metadata?: Json
          notes?: string | null
          operational_destination?: string | null
          operational_destination_details?: Json
          operational_status?: string
          order_date?: string
          order_number?: string | null
          order_type?: string
          payment_method?: string | null
          payment_status?: string
          production_date?: string | null
          production_notes?: string | null
          sale_origin?: string | null
          sale_request_key?: string | null
          shipping_amount?: number
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          channel?: string | null
          channel_account_id?: string | null
          contact_id?: string | null
          created_at?: string
          customer_contact?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          delivery_snapshot?: Json
          discount_amount?: number
          due_date?: string | null
          financial_account_id?: string | null
          financial_due_date?: string | null
          id?: string
          internal_order_number?: string
          logistics_mode?: string | null
          marketplace_account?: string | null
          marketplace_metadata?: Json
          notes?: string | null
          operational_destination?: string | null
          operational_destination_details?: Json
          operational_status?: string
          order_date?: string
          order_number?: string | null
          order_type?: string
          payment_method?: string | null
          payment_status?: string
          production_date?: string | null
          production_notes?: string | null
          sale_origin?: string | null
          sale_request_key?: string | null
          shipping_amount?: number
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      p2_four_open_attestations: {
        Row: {
          attested_at: string
          attested_by: string
          container_count: number
          event_key: string
          evidence_note: string
          family: string
          id: string
          opening_action: string
          physical_confirmation: boolean
          result: Json
          source_event_key: string
          storage_location_id: string
        }
        Insert: {
          attested_at?: string
          attested_by: string
          container_count: number
          event_key: string
          evidence_note: string
          family: string
          id?: string
          opening_action: string
          physical_confirmation: boolean
          result?: Json
          source_event_key: string
          storage_location_id: string
        }
        Update: {
          attested_at?: string
          attested_by?: string
          container_count?: number
          event_key?: string
          evidence_note?: string
          family?: string
          id?: string
          opening_action?: string
          physical_confirmation?: boolean
          result?: Json
          source_event_key?: string
          storage_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2_four_open_attestations_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      p2_four_sealed_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_key: string
          id: string
          new_balance: number
          operation: string
          physical_evidence_reference: string
          physical_state: string
          previous_balance: number
          product_id: string
          reference_id: string
          reference_type: string
          storage_location_id: string
          units: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_key: string
          id?: string
          new_balance: number
          operation: string
          physical_evidence_reference: string
          physical_state: string
          previous_balance: number
          product_id: string
          reference_id: string
          reference_type: string
          storage_location_id: string
          units: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_key?: string
          id?: string
          new_balance?: number
          operation?: string
          physical_evidence_reference?: string
          physical_state?: string
          previous_balance?: number
          product_id?: string
          reference_id?: string
          reference_type?: string
          storage_location_id?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "p2_four_sealed_events_product_id_storage_location_id_physi_fkey"
            columns: ["product_id", "storage_location_id", "physical_state"]
            isOneToOne: false
            referencedRelation: "p2_four_sealed_stock"
            referencedColumns: [
              "product_id",
              "storage_location_id",
              "physical_state",
            ]
          },
        ]
      }
      p2_four_sealed_stock: {
        Row: {
          physical_state: string
          product_id: string
          storage_location_id: string
          units: number
          updated_at: string
        }
        Insert: {
          physical_state: string
          product_id: string
          storage_location_id: string
          units?: number
          updated_at?: string
        }
        Update: {
          physical_state?: string
          product_id?: string
          storage_location_id?: string
          units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2_four_sealed_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2_four_sealed_stock_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          channel_data: Json | null
          channels: Json | null
          checklist: Json | null
          content: string | null
          created_at: string
          id: string
          media_urls: Json | null
          node_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          channel_data?: Json | null
          channels?: Json | null
          checklist?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          media_urls?: Json | null
          node_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          channel_data?: Json | null
          channels?: Json | null
          checklist?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          media_urls?: Json | null
          node_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      price_channels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      price_fee_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      price_param_fees: {
        Row: {
          created_at: string
          fee_field_id: string
          id: string
          param_id: string
          value: number
        }
        Insert: {
          created_at?: string
          fee_field_id: string
          id?: string
          param_id: string
          value?: number
        }
        Update: {
          created_at?: string
          fee_field_id?: string
          id?: string
          param_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_param_fees_fee_field_id_fkey"
            columns: ["fee_field_id"]
            isOneToOne: false
            referencedRelation: "price_fee_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_param_fees_param_id_fkey"
            columns: ["param_id"]
            isOneToOne: false
            referencedRelation: "price_params"
            referencedColumns: ["id"]
          },
        ]
      }
      price_param_history: {
        Row: {
          changed_at: string
          id: string
          notes: string | null
          param_id: string
          snapshot: Json
        }
        Insert: {
          changed_at?: string
          id?: string
          notes?: string | null
          param_id: string
          snapshot: Json
        }
        Update: {
          changed_at?: string
          id?: string
          notes?: string | null
          param_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "price_param_history_param_id_fkey"
            columns: ["param_id"]
            isOneToOne: false
            referencedRelation: "price_params"
            referencedColumns: ["id"]
          },
        ]
      }
      price_params: {
        Row: {
          channel_id: string
          created_at: string
          extra_fee_pct: number
          id: string
          is_active: boolean
          name: string
          packaging_cost: number
          payment_fee_pct: number
          platform_fee_pct: number
          shipping_cost: number
          store_id: string | null
          target_margin_pct: number
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          extra_fee_pct?: number
          id?: string
          is_active?: boolean
          name: string
          packaging_cost?: number
          payment_fee_pct?: number
          platform_fee_pct?: number
          shipping_cost?: number
          store_id?: string | null
          target_margin_pct?: number
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          extra_fee_pct?: number
          id?: string
          is_active?: boolean
          name?: string
          packaging_cost?: number
          payment_fee_pct?: number
          platform_fee_pct?: number
          shipping_cost?: number
          store_id?: string | null
          target_margin_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_params_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "price_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_params_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "price_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      price_simulation_items: {
        Row: {
          created_at: string
          id: string
          order_index: number
          pack_cost: number
          pack_qty: number
          product_name: string
          simulation_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          pack_cost?: number
          pack_qty?: number
          product_name: string
          simulation_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          pack_cost?: number
          pack_qty?: number
          product_name?: string
          simulation_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_simulation_items_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "price_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      price_simulations: {
        Row: {
          created_at: string
          id: string
          name: string
          param_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          param_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          param_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_simulations_param_id_fkey"
            columns: ["param_id"]
            isOneToOne: false
            referencedRelation: "price_params"
            referencedColumns: ["id"]
          },
        ]
      }
      price_stores: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_stores_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "price_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          unit: string
          updated_at: string
          value_per_unit: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          unit?: string
          updated_at?: string
          value_per_unit?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          unit?: string
          updated_at?: string
          value_per_unit?: number
        }
        Relationships: []
      }
      product_batch_recipe_items: {
        Row: {
          component_label: string
          component_product_id: string | null
          component_variant_id: string | null
          created_at: string
          id: string
          mapping_status: string
          notes: string | null
          qty: number | null
          recipe_id: string
          relation: string
          unit: string | null
        }
        Insert: {
          component_label: string
          component_product_id?: string | null
          component_variant_id?: string | null
          created_at?: string
          id?: string
          mapping_status?: string
          notes?: string | null
          qty?: number | null
          recipe_id: string
          relation?: string
          unit?: string | null
        }
        Update: {
          component_label?: string
          component_product_id?: string | null
          component_variant_id?: string | null
          created_at?: string
          id?: string
          mapping_status?: string
          notes?: string | null
          qty?: number | null
          recipe_id?: string
          relation?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_batch_recipe_items_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batch_recipe_items_component_variant_id_fkey"
            columns: ["component_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batch_recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "product_batch_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batch_recipes: {
        Row: {
          batch_output_qty: number | null
          batch_output_unit: string
          code: string
          created_at: string
          id: string
          name: string
          notes: string | null
          output_product_id: string
          output_variant_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_output_qty?: number | null
          batch_output_unit?: string
          code: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          output_product_id: string
          output_variant_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_output_qty?: number | null
          batch_output_unit?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          output_product_id?: string
          output_variant_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batch_recipes_output_product_id_fkey"
            columns: ["output_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batch_recipes_output_variant_id_fkey"
            columns: ["output_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          attribute_schema: Json
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          attribute_schema?: Json
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          attribute_schema?: Json
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_components: {
        Row: {
          component_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          product_variant_id: string | null
          qty_per_unit: number
          variant_id: string | null
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          product_variant_id?: string | null
          qty_per_unit?: number
          variant_id?: string | null
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          product_variant_id?: string | null
          qty_per_unit?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_optional_costs: {
        Row: {
          cost_per_unit: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          product_id: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          product_id: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_optional_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_processes: {
        Row: {
          cost_per_unit: number
          created_at: string
          id: string
          is_active: boolean
          is_required: boolean
          process_id: string
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          process_id: string
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          process_id?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_processes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_processes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          cost_override: number | null
          created_at: string
          height_cm: number | null
          id: string
          is_active: boolean
          length_cm: number | null
          price_override: number | null
          product_id: string
          sku: string
          unit: string | null
          updated_at: string
          variant_name: string
          weight_g: number | null
          width_cm: number | null
        }
        Insert: {
          attributes?: Json
          cost_override?: number | null
          created_at?: string
          height_cm?: number | null
          id?: string
          is_active?: boolean
          length_cm?: number | null
          price_override?: number | null
          product_id: string
          sku: string
          unit?: string | null
          updated_at?: string
          variant_name: string
          weight_g?: number | null
          width_cm?: number | null
        }
        Update: {
          attributes?: Json
          cost_override?: number | null
          created_at?: string
          height_cm?: number | null
          id?: string
          is_active?: boolean
          length_cm?: number | null
          price_override?: number | null
          product_id?: string
          sku?: string
          unit?: string | null
          updated_at?: string
          variant_name?: string
          weight_g?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_closing_financial_entries: {
        Row: {
          closing_id: string
          created_at: string
          employee_name: string
          financial_entry_id: string
          id: string
        }
        Insert: {
          closing_id: string
          created_at?: string
          employee_name: string
          financial_entry_id: string
          id?: string
        }
        Update: {
          closing_id?: string
          created_at?: string
          employee_name?: string
          financial_entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_closing_financial_entries_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "production_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_closing_financial_entries_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: true
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      production_closing_items: {
        Row: {
          closing_id: string
          employee_name: string
          employee_user_id: string | null
          id: string
          process_id: string | null
          process_name_snapshot: string | null
          total_quantity: number
          total_value: number
        }
        Insert: {
          closing_id: string
          employee_name: string
          employee_user_id?: string | null
          id?: string
          process_id?: string | null
          process_name_snapshot?: string | null
          total_quantity?: number
          total_value?: number
        }
        Update: {
          closing_id?: string
          employee_name?: string
          employee_user_id?: string | null
          id?: string
          process_id?: string | null
          process_name_snapshot?: string | null
          total_quantity?: number
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_closing_items_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "production_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_closing_items_employee_user_id_fkey"
            columns: ["employee_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_closing_items_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_closing_sources: {
        Row: {
          closing_id: string
          created_at: string
          employee_name: string
          employee_user_id: string | null
          id: string
          process_id: string | null
          process_name_snapshot: string
          quantity: number
          source_date: string
          source_id: string
          source_type: string
          total_value: number
        }
        Insert: {
          closing_id: string
          created_at?: string
          employee_name: string
          employee_user_id?: string | null
          id?: string
          process_id?: string | null
          process_name_snapshot: string
          quantity?: number
          source_date: string
          source_id: string
          source_type: string
          total_value?: number
        }
        Update: {
          closing_id?: string
          created_at?: string
          employee_name?: string
          employee_user_id?: string | null
          id?: string
          process_id?: string | null
          process_name_snapshot?: string
          quantity?: number
          source_date?: string
          source_id?: string
          source_type?: string
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_closing_sources_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "production_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_closing_sources_employee_user_id_fkey"
            columns: ["employee_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_closing_sources_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_closings: {
        Row: {
          closed_at: string | null
          created_at: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: string
          total_value: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: string
          total_value?: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          total_value?: number
        }
        Relationships: []
      }
      production_entries: {
        Row: {
          created_at: string
          date: string
          employee_name: string
          id: string
          notes: string | null
          period: string
          process_id: string
          production_order_id: string
          production_order_item_id: string | null
          quantity: number
          total_value: number | null
          updated_at: string
          value_per_unit: number
        }
        Insert: {
          created_at?: string
          date?: string
          employee_name: string
          id?: string
          notes?: string | null
          period?: string
          process_id: string
          production_order_id: string
          production_order_item_id?: string | null
          quantity?: number
          total_value?: number | null
          updated_at?: string
          value_per_unit?: number
        }
        Update: {
          created_at?: string
          date?: string
          employee_name?: string
          id?: string
          notes?: string | null
          period?: string
          process_id?: string
          production_order_id?: string
          production_order_item_id?: string | null
          quantity?: number
          total_value?: number | null
          updated_at?: string
          value_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_entries_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_production_order_item_id_fkey"
            columns: ["production_order_item_id"]
            isOneToOne: false
            referencedRelation: "production_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      production_fact_consumptions: {
        Row: {
          adjustment_status: string
          component_id: string
          created_at: string
          id: string
          production_fact_id: string
          qty_per_unit_snapshot: number
          quantity_applied: number
          quantity_consumed: number
          unit_snapshot: string | null
          variant_id: string | null
        }
        Insert: {
          adjustment_status?: string
          component_id: string
          created_at?: string
          id?: string
          production_fact_id: string
          qty_per_unit_snapshot: number
          quantity_applied?: number
          quantity_consumed: number
          unit_snapshot?: string | null
          variant_id?: string | null
        }
        Update: {
          adjustment_status?: string
          component_id?: string
          created_at?: string
          id?: string
          production_fact_id?: string
          qty_per_unit_snapshot?: number
          quantity_applied?: number
          quantity_consumed?: number
          unit_snapshot?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_fact_consumptions_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_fact_consumptions_production_fact_id_fkey"
            columns: ["production_fact_id"]
            isOneToOne: false
            referencedRelation: "production_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_fact_consumptions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_fact_process_entries: {
        Row: {
          created_at: string
          id: string
          occurred_at: string
          operator_name: string
          operator_user_id: string | null
          process_id: string
          production_fact_id: string
          quantity: number
          total_value: number
          updated_at: string
          value_per_unit_snapshot: number
        }
        Insert: {
          created_at?: string
          id?: string
          occurred_at?: string
          operator_name: string
          operator_user_id?: string | null
          process_id: string
          production_fact_id: string
          quantity: number
          total_value?: number
          updated_at?: string
          value_per_unit_snapshot?: number
        }
        Update: {
          created_at?: string
          id?: string
          occurred_at?: string
          operator_name?: string
          operator_user_id?: string | null
          process_id?: string
          production_fact_id?: string
          quantity?: number
          total_value?: number
          updated_at?: string
          value_per_unit_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_fact_process_entries_operator_user_id_fkey"
            columns: ["operator_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_fact_process_entries_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_fact_process_entries_production_fact_id_fkey"
            columns: ["production_fact_id"]
            isOneToOne: false
            referencedRelation: "production_facts"
            referencedColumns: ["id"]
          },
        ]
      }
      production_facts: {
        Row: {
          correction_of_id: string | null
          created_at: string
          created_by: string | null
          event_key: string
          id: string
          location: string
          location_id: string | null
          occurred_at: string
          operator_name: string | null
          operator_user_id: string | null
          product_id: string
          production_order_id: string | null
          quantity: number
          reversal_of_id: string | null
          source: string
          status: string
          variant_id: string | null
        }
        Insert: {
          correction_of_id?: string | null
          created_at?: string
          created_by?: string | null
          event_key: string
          id?: string
          location?: string
          location_id?: string | null
          occurred_at?: string
          operator_name?: string | null
          operator_user_id?: string | null
          product_id: string
          production_order_id?: string | null
          quantity: number
          reversal_of_id?: string | null
          source?: string
          status?: string
          variant_id?: string | null
        }
        Update: {
          correction_of_id?: string | null
          created_at?: string
          created_by?: string | null
          event_key?: string
          id?: string
          location?: string
          location_id?: string | null
          occurred_at?: string
          operator_name?: string | null
          operator_user_id?: string | null
          product_id?: string
          production_order_id?: string | null
          quantity?: number
          reversal_of_id?: string | null
          source?: string
          status?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_facts_correction_of_id_fkey"
            columns: ["correction_of_id"]
            isOneToOne: false
            referencedRelation: "production_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_facts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_facts_operator_user_id_fkey"
            columns: ["operator_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_facts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_facts_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_facts_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "production_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_facts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          created_at: string
          date: string
          employee_name: string
          id: string
          notes: string | null
          order_id: string | null
          period: string
          process: string
          product_id: string | null
          quantity: number
          updated_at: string
          warnings: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          employee_name: string
          id?: string
          notes?: string | null
          order_id?: string | null
          period?: string
          process: string
          product_id?: string | null
          quantity?: number
          updated_at?: string
          warnings?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          employee_name?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          period?: string
          process?: string
          product_id?: string | null
          quantity?: number
          updated_at?: string
          warnings?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_demands: {
        Row: {
          created_at: string
          demand_quantity_snapshot: number
          id: string
          order_id: string
          order_reference_snapshot: string | null
          product_id: string
          production_order_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          demand_quantity_snapshot: number
          id?: string
          order_id: string
          order_reference_snapshot?: string | null
          product_id: string
          production_order_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          demand_quantity_snapshot?: number
          id?: string
          order_id?: string
          order_reference_snapshot?: string | null
          product_id?: string
          production_order_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_order_demands_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_demands_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_demands_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_demands_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_items: {
        Row: {
          created_at: string
          id: string
          planned_quantity: number
          produced_quantity: number
          product_id: string
          production_order_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          planned_quantity: number
          produced_quantity?: number
          product_id: string
          production_order_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          planned_quantity?: number
          produced_quantity?: number
          product_id?: string
          production_order_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_items_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_processes: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          process_id: string
          production_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          process_id: string
          production_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          process_id?: string
          production_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_order_processes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_processes_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          batch_code: string | null
          completed_at: string | null
          consolidated_quantity: number
          created_at: string
          id: string
          internal_production_number: string | null
          notes: string | null
          order_number: string | null
          physical_flow_mode: string
          product_id: string | null
          scheduled_date: string | null
          source_order_id: string | null
          status: string
          target_quantity: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          batch_code?: string | null
          completed_at?: string | null
          consolidated_quantity?: number
          created_at?: string
          id?: string
          internal_production_number?: string | null
          notes?: string | null
          order_number?: string | null
          physical_flow_mode?: string
          product_id?: string | null
          scheduled_date?: string | null
          source_order_id?: string | null
          status?: string
          target_quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          batch_code?: string | null
          completed_at?: string | null
          consolidated_quantity?: number
          created_at?: string
          id?: string
          internal_production_number?: string | null
          notes?: string | null
          order_number?: string | null
          physical_flow_mode?: string
          product_id?: string | null
          scheduled_date?: string | null
          source_order_id?: string | null
          status?: string
          target_quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json | null
          category: string | null
          cost: number | null
          cover_image_url: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          expiry_days: number | null
          family_id: string | null
          height_cm: number | null
          id: string
          is_active: boolean
          is_intermediate: boolean
          is_manufactured: boolean
          is_purchased: boolean
          length_cm: number | null
          media_urls: Json | null
          min_stock: number | null
          name: string
          price: number | null
          sku: string
          unit: string | null
          updated_at: string
          variation_mode: string
          weight_g: number | null
          width_cm: number | null
        }
        Insert: {
          attributes?: Json | null
          category?: string | null
          cost?: number | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expiry_days?: number | null
          family_id?: string | null
          height_cm?: number | null
          id?: string
          is_active?: boolean
          is_intermediate?: boolean
          is_manufactured?: boolean
          is_purchased?: boolean
          length_cm?: number | null
          media_urls?: Json | null
          min_stock?: number | null
          name: string
          price?: number | null
          sku: string
          unit?: string | null
          updated_at?: string
          variation_mode?: string
          weight_g?: number | null
          width_cm?: number | null
        }
        Update: {
          attributes?: Json | null
          category?: string | null
          cost?: number | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expiry_days?: number | null
          family_id?: string | null
          height_cm?: number | null
          id?: string
          is_active?: boolean
          is_intermediate?: boolean
          is_manufactured?: boolean
          is_purchased?: boolean
          length_cm?: number | null
          media_urls?: Json | null
          min_stock?: number | null
          name?: string
          price?: number | null
          sku?: string
          unit?: string | null
          updated_at?: string
          variation_mode?: string
          weight_g?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_documents: {
        Row: {
          access_key: string | null
          created_at: string
          document_date: string | null
          document_number: string | null
          document_series: string | null
          document_type: string
          extracted_data: Json | null
          extraction_status: string
          file_name: string
          file_size: number | null
          id: string
          issuer_document: string | null
          mime_type: string | null
          notes: string | null
          purchase_order_id: string
          purchase_receipt_id: string | null
          source: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          access_key?: string | null
          created_at?: string
          document_date?: string | null
          document_number?: string | null
          document_series?: string | null
          document_type?: string
          extracted_data?: Json | null
          extraction_status?: string
          file_name: string
          file_size?: number | null
          id?: string
          issuer_document?: string | null
          mime_type?: string | null
          notes?: string | null
          purchase_order_id: string
          purchase_receipt_id?: string | null
          source?: string
          storage_bucket?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          access_key?: string | null
          created_at?: string
          document_date?: string | null
          document_number?: string | null
          document_series?: string | null
          document_type?: string
          extracted_data?: Json | null
          extraction_status?: string
          file_name?: string
          file_size?: number | null
          id?: string
          issuer_document?: string | null
          mime_type?: string | null
          notes?: string | null
          purchase_order_id?: string
          purchase_receipt_id?: string | null
          source?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_documents_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_documents_purchase_receipt_id_fkey"
            columns: ["purchase_receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_final_closure_items: {
        Row: {
          not_delivered_qty: number
          ordered_qty: number
          purchase_order_id: string
          purchase_order_item_id: string
          received_qty: number
          unit_price: number
        }
        Insert: {
          not_delivered_qty: number
          ordered_qty: number
          purchase_order_id: string
          purchase_order_item_id: string
          received_qty: number
          unit_price: number
        }
        Update: {
          not_delivered_qty?: number
          ordered_qty?: number
          purchase_order_id?: string
          purchase_order_item_id?: string
          received_qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_final_closure_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_final_closures"
            referencedColumns: ["purchase_order_id"]
          },
          {
            foreignKeyName: "purchase_final_closure_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: true
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_final_closures: {
        Row: {
          created_at: string
          created_by: string | null
          effective_amount: number
          purchase_order_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_amount: number
          purchase_order_id: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_amount?: number
          purchase_order_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_final_closures_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: true
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          conversion_factor: number
          created_at: string
          id: string
          ordered_purchase_qty: number
          planning_context: Json | null
          planning_source: string | null
          presentation_snapshot: Json
          product_id: string
          purchase_order_id: string
          purchase_presentation_id: string | null
          purchase_unit_label: string
          stock_unit_label: string
          unit_price: number | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          conversion_factor: number
          created_at?: string
          id?: string
          ordered_purchase_qty: number
          planning_context?: Json | null
          planning_source?: string | null
          presentation_snapshot: Json
          product_id: string
          purchase_order_id: string
          purchase_presentation_id?: string | null
          purchase_unit_label: string
          stock_unit_label: string
          unit_price?: number | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          conversion_factor?: number
          created_at?: string
          id?: string
          ordered_purchase_qty?: number
          planning_context?: Json | null
          planning_source?: string | null
          presentation_snapshot?: Json
          product_id?: string
          purchase_order_id?: string
          purchase_presentation_id?: string | null
          purchase_unit_label?: string
          stock_unit_label?: string
          unit_price?: number | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_presentation_id_fkey"
            columns: ["purchase_presentation_id"]
            isOneToOne: false
            referencedRelation: "purchase_presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          billed_at: string | null
          billing_status: string
          created_at: string
          expected_at: string | null
          freight_amount: number
          id: string
          internal_purchase_number: string | null
          notes: string | null
          ordered_at: string | null
          status: string
          supplier_contact_id: string
          updated_at: string
        }
        Insert: {
          billed_at?: string | null
          billing_status?: string
          created_at?: string
          expected_at?: string | null
          freight_amount?: number
          id?: string
          internal_purchase_number?: string | null
          notes?: string | null
          ordered_at?: string | null
          status?: string
          supplier_contact_id: string
          updated_at?: string
        }
        Update: {
          billed_at?: string | null
          billing_status?: string
          created_at?: string
          expected_at?: string | null
          freight_amount?: number
          id?: string
          internal_purchase_number?: string | null
          notes?: string | null
          ordered_at?: string | null
          status?: string
          supplier_contact_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_presentations: {
        Row: {
          conversion_factor: number
          created_at: string
          id: string
          is_active: boolean
          is_approximate: boolean
          name: string
          notes: string | null
          product_id: string
          purchase_unit_label: string
          stock_unit_label: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          conversion_factor: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_approximate?: boolean
          name: string
          notes?: string | null
          product_id: string
          purchase_unit_label: string
          stock_unit_label: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          conversion_factor?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_approximate?: boolean
          name?: string
          notes?: string | null
          product_id?: string
          purchase_unit_label?: string
          stock_unit_label?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_presentations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_presentations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_items: {
        Row: {
          created_at: string
          id: string
          operational_received_qty: number
          purchase_order_item_id: string
          purchase_receipt_id: string
          received_purchase_qty: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operational_received_qty: number
          purchase_order_item_id: string
          purchase_receipt_id: string
          received_purchase_qty: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operational_received_qty?: number
          purchase_order_item_id?: string
          purchase_receipt_id?: string
          received_purchase_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_purchase_receipt_id_fkey"
            columns: ["purchase_receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          notes: string | null
          purchase_order_id: string
          received_at: string | null
          status: string
          storage_location_id: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id: string
          received_at?: string | null
          status?: string
          storage_location_id: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
          received_at?: string | null
          status?: string
          storage_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_replenishment_policies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_preferred: boolean
          lead_time_days: number
          notes: string | null
          product_id: string
          safety_days: number
          supplier_contact_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_preferred?: boolean
          lead_time_days?: number
          notes?: string | null
          product_id: string
          safety_days?: number
          supplier_contact_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_preferred?: boolean
          lead_time_days?: number
          notes?: string | null
          product_id?: string
          safety_days?: number
          supplier_contact_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_replenishment_policies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_replenishment_policies_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_replenishment_policies_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_blocks: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          alert_offset_minutes: number
          assigned_user_id: string | null
          block_type: string
          checklist: Json
          completion_criterion: string | null
          created_at: string
          date: string
          destination_path: string | null
          duration_minutes: number
          focus: string | null
          generated_by_id: string | null
          generated_by_type: string | null
          generated_instance_id: string | null
          id: string
          is_active: boolean
          module_key: string | null
          mt_id: string | null
          node_id: string | null
          notes: string | null
          planned_end: string | null
          planned_start: string | null
          recurrence: string | null
          recurrence_parent_id: string | null
          recurrence_series_id: string | null
          snooze_until: string | null
          source_id: string | null
          source_type: string | null
          status: string
          task_id: string | null
          template_id: string | null
          title: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          alert_offset_minutes?: number
          assigned_user_id?: string | null
          block_type?: string
          checklist?: Json
          completion_criterion?: string | null
          created_at?: string
          date?: string
          destination_path?: string | null
          duration_minutes?: number
          focus?: string | null
          generated_by_id?: string | null
          generated_by_type?: string | null
          generated_instance_id?: string | null
          id?: string
          is_active?: boolean
          module_key?: string | null
          mt_id?: string | null
          node_id?: string | null
          notes?: string | null
          planned_end?: string | null
          planned_start?: string | null
          recurrence?: string | null
          recurrence_parent_id?: string | null
          recurrence_series_id?: string | null
          snooze_until?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          task_id?: string | null
          template_id?: string | null
          title: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          alert_offset_minutes?: number
          assigned_user_id?: string | null
          block_type?: string
          checklist?: Json
          completion_criterion?: string | null
          created_at?: string
          date?: string
          destination_path?: string | null
          duration_minutes?: number
          focus?: string | null
          generated_by_id?: string | null
          generated_by_type?: string | null
          generated_instance_id?: string | null
          id?: string
          is_active?: boolean
          module_key?: string | null
          mt_id?: string | null
          node_id?: string | null
          notes?: string | null
          planned_end?: string | null
          planned_start?: string | null
          recurrence?: string | null
          recurrence_parent_id?: string | null
          recurrence_series_id?: string | null
          snooze_until?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          task_id?: string | null
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_blocks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_blocks_mt_id_fkey"
            columns: ["mt_id"]
            isOneToOne: false
            referencedRelation: "routine_mts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_blocks_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_blocks_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "routine_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_blocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_blocks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_mts: {
        Row: {
          area: string
          blocks: Json
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          order_index: number
          priority_modules: string[]
          target_role: string | null
          updated_at: string
        }
        Insert: {
          area: string
          blocks?: Json
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          order_index?: number
          priority_modules?: string[]
          target_role?: string | null
          updated_at?: string
        }
        Update: {
          area?: string
          blocks?: Json
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          order_index?: number
          priority_modules?: string[]
          target_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      routine_prefs: {
        Row: {
          breaks: Json | null
          capacity_targets: Json | null
          created_at: string
          default_template_id: string | null
          id: string
          updated_at: string
          work_hours_end: string
          work_hours_start: string
        }
        Insert: {
          breaks?: Json | null
          capacity_targets?: Json | null
          created_at?: string
          default_template_id?: string | null
          id?: string
          updated_at?: string
          work_hours_end?: string
          work_hours_start?: string
        }
        Update: {
          breaks?: Json | null
          capacity_targets?: Json | null
          created_at?: string
          default_template_id?: string | null
          id?: string
          updated_at?: string
          work_hours_end?: string
          work_hours_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_prefs_default_template_id_fkey"
            columns: ["default_template_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_stats: {
        Row: {
          atendimento_min: number
          context_switches: number
          created_at: string
          date: string
          deep_work_min: number
          done_min: number
          id: string
          planned_min: number
        }
        Insert: {
          atendimento_min?: number
          context_switches?: number
          created_at?: string
          date: string
          deep_work_min?: number
          done_min?: number
          id?: string
          planned_min?: number
        }
        Update: {
          atendimento_min?: number
          context_switches?: number
          created_at?: string
          date?: string
          deep_work_min?: number
          done_min?: number
          id?: string
          planned_min?: number
        }
        Relationships: []
      }
      routine_templates: {
        Row: {
          block_type: string
          created_at: string
          duration_minutes: number
          focus: string | null
          id: string
          is_active: boolean
          node_id: string | null
          order_index: number
          start_time: string | null
          title: string
        }
        Insert: {
          block_type?: string
          created_at?: string
          duration_minutes?: number
          focus?: string | null
          id?: string
          is_active?: boolean
          node_id?: string | null
          order_index?: number
          start_time?: string | null
          title: string
        }
        Update: {
          block_type?: string
          created_at?: string
          duration_minutes?: number
          focus?: string | null
          id?: string
          is_active?: boolean
          node_id?: string | null
          order_index?: number
          start_time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_templates_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      seasonal_days: {
        Row: {
          auto_task_templates: Json | null
          auto_tasks: boolean
          color: string
          created_at: string
          day: number | null
          end_day: number | null
          end_month: number | null
          id: string
          importance: number
          is_active: boolean
          month: number | null
          name: string
          notes: string | null
          nth_occurrence: number | null
          prep_days: number
          recurrence_type: string
          reminders: Json | null
          updated_at: string
          weekday: number | null
        }
        Insert: {
          auto_task_templates?: Json | null
          auto_tasks?: boolean
          color?: string
          created_at?: string
          day?: number | null
          end_day?: number | null
          end_month?: number | null
          id?: string
          importance?: number
          is_active?: boolean
          month?: number | null
          name: string
          notes?: string | null
          nth_occurrence?: number | null
          prep_days?: number
          recurrence_type?: string
          reminders?: Json | null
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          auto_task_templates?: Json | null
          auto_tasks?: boolean
          color?: string
          created_at?: string
          day?: number | null
          end_day?: number | null
          end_month?: number | null
          id?: string
          importance?: number
          is_active?: boolean
          month?: number | null
          name?: string
          notes?: string | null
          nth_occurrence?: number | null
          prep_days?: number
          recurrence_type?: string
          reminders?: Json | null
          updated_at?: string
          weekday?: number | null
        }
        Relationships: []
      }
      service_ai_logs: {
        Row: {
          ai_suggested_response: string | null
          approved_response: string | null
          conversation_id: string | null
          conversation_result: string | null
          created_at: string
          id: string
          intent_detected: string | null
          interaction_type: string | null
          message_id: string | null
          platform_id: string | null
        }
        Insert: {
          ai_suggested_response?: string | null
          approved_response?: string | null
          conversation_id?: string | null
          conversation_result?: string | null
          created_at?: string
          id?: string
          intent_detected?: string | null
          interaction_type?: string | null
          message_id?: string | null
          platform_id?: string | null
        }
        Update: {
          ai_suggested_response?: string | null
          approved_response?: string | null
          conversation_id?: string | null
          conversation_result?: string | null
          created_at?: string
          id?: string
          intent_detected?: string | null
          interaction_type?: string | null
          message_id?: string | null
          platform_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_ai_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "service_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ai_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "service_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ai_logs_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      service_conversations: {
        Row: {
          assigned_to: string | null
          attendance_state: string | null
          auto_reply_enabled: boolean
          channel: string
          contact_avatar_url: string | null
          contact_handle: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string
          funnel_stage: string
          id: string
          last_inbound_at: string | null
          last_message_at: string
          last_message_preview: string | null
          last_outbound_at: string | null
          needs_reply: boolean
          platform_id: string | null
          resolved_at: string | null
          return_at: string | null
          sales_channels: Json | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attendance_state?: string | null
          auto_reply_enabled?: boolean
          channel?: string
          contact_avatar_url?: string | null
          contact_handle?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          funnel_stage?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string
          last_message_preview?: string | null
          last_outbound_at?: string | null
          needs_reply?: boolean
          platform_id?: string | null
          resolved_at?: string | null
          return_at?: string | null
          sales_channels?: Json | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attendance_state?: string | null
          auto_reply_enabled?: boolean
          channel?: string
          contact_avatar_url?: string | null
          contact_handle?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          funnel_stage?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string
          last_message_preview?: string | null
          last_outbound_at?: string | null
          needs_reply?: boolean
          platform_id?: string | null
          resolved_at?: string | null
          return_at?: string | null
          sales_channels?: Json | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_conversations_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      service_messages: {
        Row: {
          ai_approved: boolean | null
          content: string
          conversation_id: string
          created_at: string
          delivery_status: string | null
          direction: string | null
          error_code: string | null
          external_message_id: string | null
          id: string
          intent_detected: string | null
          is_ai_suggested: boolean
          logged_to_history: boolean
          media_caption: string | null
          media_filename: string | null
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          provider_instance_ref: string | null
          provider_name: string | null
          provider_timestamp: string | null
          sender: string
          source: string | null
        }
        Insert: {
          ai_approved?: boolean | null
          content: string
          conversation_id: string
          created_at?: string
          delivery_status?: string | null
          direction?: string | null
          error_code?: string | null
          external_message_id?: string | null
          id?: string
          intent_detected?: string | null
          is_ai_suggested?: boolean
          logged_to_history?: boolean
          media_caption?: string | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          provider_instance_ref?: string | null
          provider_name?: string | null
          provider_timestamp?: string | null
          sender?: string
          source?: string | null
        }
        Update: {
          ai_approved?: boolean | null
          content?: string
          conversation_id?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string | null
          error_code?: string | null
          external_message_id?: string | null
          id?: string
          intent_detected?: string | null
          is_ai_suggested?: boolean
          logged_to_history?: boolean
          media_caption?: string | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          provider_instance_ref?: string | null
          provider_name?: string | null
          provider_timestamp?: string | null
          sender?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "service_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_cells: {
        Row: {
          cell_type: string
          col_index: number
          created_at: string
          format: Json | null
          formula: string | null
          id: string
          row_index: number
          sheet_id: string
          tab_id: string | null
          updated_at: string
          value: string | null
        }
        Insert: {
          cell_type?: string
          col_index: number
          created_at?: string
          format?: Json | null
          formula?: string | null
          id?: string
          row_index: number
          sheet_id: string
          tab_id?: string | null
          updated_at?: string
          value?: string | null
        }
        Update: {
          cell_type?: string
          col_index?: number
          created_at?: string
          format?: Json | null
          formula?: string | null
          id?: string
          row_index?: number
          sheet_id?: string
          tab_id?: string | null
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sheet_cells_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_cells_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "sheet_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_tabs: {
        Row: {
          col_widths: Json | null
          created_at: string
          frozen_cols: number
          frozen_rows: number
          id: string
          order_index: number
          row_heights: Json | null
          sheet_id: string
          title: string
          updated_at: string
        }
        Insert: {
          col_widths?: Json | null
          created_at?: string
          frozen_cols?: number
          frozen_rows?: number
          id?: string
          order_index?: number
          row_heights?: Json | null
          sheet_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          col_widths?: Json | null
          created_at?: string
          frozen_cols?: number
          frozen_rows?: number
          id?: string
          order_index?: number
          row_heights?: Json | null
          sheet_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_tabs_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      sheets: {
        Row: {
          col_widths: Json | null
          created_at: string
          deleted_at: string | null
          frozen_cols: number
          frozen_rows: number
          id: string
          node_id: string | null
          row_heights: Json | null
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          col_widths?: Json | null
          created_at?: string
          deleted_at?: string | null
          frozen_cols?: number
          frozen_rows?: number
          id?: string
          node_id?: string | null
          row_heights?: Json | null
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          col_widths?: Json | null
          created_at?: string
          deleted_at?: string | null
          frozen_cols?: number
          frozen_rows?: number
          id?: string
          node_id?: string | null
          row_heights?: Json | null
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheets_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheets_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_cycle_orders: {
        Row: {
          channel_account_id: string
          last_checked_at: string
          last_code: string
          order_sn: string
          state: string
        }
        Insert: {
          channel_account_id: string
          last_checked_at?: string
          last_code?: string
          order_sn: string
          state?: string
        }
        Update: {
          channel_account_id?: string
          last_checked_at?: string
          last_code?: string
          order_sn?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopee_cycle_orders_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_cycle_state: {
        Row: {
          candidate_order_sn: string | null
          channel_account_id: string
          cursor: string | null
          halted_code: string | null
          lease_expires_at: string | null
          lease_id: string | null
          time_from: number
          time_to: number
          updated_at: string
        }
        Insert: {
          candidate_order_sn?: string | null
          channel_account_id: string
          cursor?: string | null
          halted_code?: string | null
          lease_expires_at?: string | null
          lease_id?: string | null
          time_from: number
          time_to: number
          updated_at?: string
        }
        Update: {
          candidate_order_sn?: string | null
          channel_account_id?: string
          cursor?: string | null
          halted_code?: string | null
          lease_expires_at?: string | null
          lease_id?: string | null
          time_from?: number
          time_to?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopee_cycle_state_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: true
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_logistics_read_state: {
        Row: {
          channel_account_id: string
          observed_at: string
          order_sn: string
          reason: string | null
          state: string
        }
        Insert: {
          channel_account_id: string
          observed_at?: string
          order_sn: string
          reason?: string | null
          state: string
        }
        Update: {
          channel_account_id?: string
          observed_at?: string
          order_sn?: string
          reason?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopee_logistics_read_state_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_oauth_connections: {
        Row: {
          access_token_ciphertext: string
          access_token_expires_at: string | null
          authorization_expires_at: string | null
          channel_account_id: string
          created_at: string
          environment: string
          id: string
          last_authenticated_at: string
          last_refreshed_at: string | null
          main_account_id: number | null
          merchant_id: number | null
          partner_id: number
          refresh_token_ciphertext: string
          refresh_token_expires_at: string | null
          region: string | null
          shop_id: number | null
          shop_name: string | null
          shop_status: string | null
          updated_at: string
        }
        Insert: {
          access_token_ciphertext: string
          access_token_expires_at?: string | null
          authorization_expires_at?: string | null
          channel_account_id: string
          created_at?: string
          environment: string
          id?: string
          last_authenticated_at?: string
          last_refreshed_at?: string | null
          main_account_id?: number | null
          merchant_id?: number | null
          partner_id: number
          refresh_token_ciphertext: string
          refresh_token_expires_at?: string | null
          region?: string | null
          shop_id?: number | null
          shop_name?: string | null
          shop_status?: string | null
          updated_at?: string
        }
        Update: {
          access_token_ciphertext?: string
          access_token_expires_at?: string | null
          authorization_expires_at?: string | null
          channel_account_id?: string
          created_at?: string
          environment?: string
          id?: string
          last_authenticated_at?: string
          last_refreshed_at?: string | null
          main_account_id?: number | null
          merchant_id?: number | null
          partner_id?: number
          refresh_token_ciphertext?: string
          refresh_token_expires_at?: string | null
          region?: string | null
          shop_id?: number | null
          shop_name?: string | null
          shop_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopee_oauth_connections_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_oauth_states: {
        Row: {
          channel_account_id: string
          created_at: string
          environment: string
          expires_at: string
          id: string
          state_hash: string
          used_at: string | null
        }
        Insert: {
          channel_account_id: string
          created_at?: string
          environment: string
          expires_at: string
          id?: string
          state_hash: string
          used_at?: string | null
        }
        Update: {
          channel_account_id?: string
          created_at?: string
          environment?: string
          expires_at?: string
          id?: string
          state_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopee_oauth_states_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_review_login_attempts: {
        Row: {
          attempt_key: string
          id: string
          occurred_at: string
          outcome: string
        }
        Insert: {
          attempt_key: string
          id?: string
          occurred_at?: string
          outcome?: string
        }
        Update: {
          attempt_key?: string
          id?: string
          occurred_at?: string
          outcome?: string
        }
        Relationships: []
      }
      shopee_review_portal_control: {
        Row: {
          enabled: boolean
          expires_at: string | null
          id: boolean
          session_version: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          expires_at?: string | null
          id?: boolean
          session_version?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          expires_at?: string | null
          id?: boolean
          session_version?: number
          updated_at?: string
        }
        Relationships: []
      }
      shopee_review_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          session_version: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          session_version: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          session_version?: number
        }
        Relationships: []
      }
      shopee_shipping_arrangement_attempts: {
        Row: {
          channel_account_id: string
          claimed_at: string
          id: string
          operation: string
          order_id: string
          order_sn: string
          outcome_source: string | null
          package_number: string
          request_hash: string
          resolved_at: string | null
          shop_id: number
          state: string
        }
        Insert: {
          channel_account_id: string
          claimed_at?: string
          id?: string
          operation?: string
          order_id: string
          order_sn: string
          outcome_source?: string | null
          package_number: string
          request_hash: string
          resolved_at?: string | null
          shop_id: number
          state?: string
        }
        Update: {
          channel_account_id?: string
          claimed_at?: string
          id?: string
          operation?: string
          order_id?: string
          order_sn?: string
          outcome_source?: string | null
          package_number?: string
          request_hash?: string
          resolved_at?: string | null
          shop_id?: number
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopee_shipping_arrangement_attempts_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopee_shipping_arrangement_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_shipping_document_attempts: {
        Row: {
          channel_account_id: string
          claimed_at: string
          document_type: string
          id: string
          operation: string
          order_id: string
          order_sn: string
          outcome_source: string | null
          package_number: string
          request_hash: string
          resolved_at: string | null
          shop_id: number
          state: string
        }
        Insert: {
          channel_account_id: string
          claimed_at?: string
          document_type: string
          id?: string
          operation?: string
          order_id: string
          order_sn: string
          outcome_source?: string | null
          package_number: string
          request_hash: string
          resolved_at?: string | null
          shop_id: number
          state?: string
        }
        Update: {
          channel_account_id?: string
          claimed_at?: string
          document_type?: string
          id?: string
          operation?: string
          order_id?: string
          order_sn?: string
          outcome_source?: string | null
          package_number?: string
          request_hash?: string
          resolved_at?: string | null
          shop_id?: number
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopee_shipping_document_attempts_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopee_shipping_document_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      supplier_catalog_items: {
        Row: {
          brand: string | null
          created_at: string
          declared_content_qty: number | null
          declared_content_unit: string | null
          id: string
          is_active: boolean
          normalized_name: string | null
          notes: string | null
          original_description: string
          presentation_label: string | null
          product_id: string | null
          purchase_presentation_id: string | null
          purchase_unit_label: string | null
          status: string
          supplier_code: string | null
          supplier_contact_id: string
          supplier_document_id: string | null
          supply_group_id: string | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          declared_content_qty?: number | null
          declared_content_unit?: string | null
          id?: string
          is_active?: boolean
          normalized_name?: string | null
          notes?: string | null
          original_description: string
          presentation_label?: string | null
          product_id?: string | null
          purchase_presentation_id?: string | null
          purchase_unit_label?: string | null
          status?: string
          supplier_code?: string | null
          supplier_contact_id: string
          supplier_document_id?: string | null
          supply_group_id?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          declared_content_qty?: number | null
          declared_content_unit?: string | null
          id?: string
          is_active?: boolean
          normalized_name?: string | null
          notes?: string | null
          original_description?: string
          presentation_label?: string | null
          product_id?: string | null
          purchase_presentation_id?: string | null
          purchase_unit_label?: string | null
          status?: string
          supplier_code?: string | null
          supplier_contact_id?: string
          supplier_document_id?: string | null
          supply_group_id?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_items_purchase_presentation_id_fkey"
            columns: ["purchase_presentation_id"]
            isOneToOne: false
            referencedRelation: "purchase_presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_items_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_items_supplier_document_id_fkey"
            columns: ["supplier_document_id"]
            isOneToOne: false
            referencedRelation: "supplier_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_items_supply_group_id_fkey"
            columns: ["supply_group_id"]
            isOneToOne: false
            referencedRelation: "supply_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_delivery_schedules: {
        Row: {
          created_at: string
          cutoff_days_before: number
          cutoff_time: string
          id: string
          is_active: boolean
          notes: string | null
          supplier_contact_id: string
          timezone: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          cutoff_days_before?: number
          cutoff_time?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          supplier_contact_id: string
          timezone?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          cutoff_days_before?: number
          cutoff_time?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          supplier_contact_id?: string
          timezone?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_delivery_schedules_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          created_at: string
          document_date: string | null
          document_type: string
          extracted_data: Json | null
          extraction_status: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          source: string
          storage_bucket: string
          storage_path: string
          supersedes_document_id: string | null
          supplier_contact_id: string
          updated_at: string
          uploaded_by: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          document_date?: string | null
          document_type?: string
          extracted_data?: Json | null
          extraction_status?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          source?: string
          storage_bucket?: string
          storage_path: string
          supersedes_document_id?: string | null
          supplier_contact_id: string
          updated_at?: string
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          document_date?: string | null
          document_type?: string
          extracted_data?: Json | null
          extraction_status?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          source?: string
          storage_bucket?: string
          storage_path?: string
          supersedes_document_id?: string | null
          supplier_contact_id?: string
          updated_at?: string
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_supersedes_document_id_fkey"
            columns: ["supersedes_document_id"]
            isOneToOne: false
            referencedRelation: "supplier_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_procurement_profiles: {
        Row: {
          created_at: string
          discard_reason: string | null
          freight_terms: string | null
          general_min_order_amount: number | null
          last_contact_at: string | null
          lifecycle_status: string
          next_action_at: string | null
          next_action_text: string | null
          notes: string | null
          source: string | null
          supplier_contact_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discard_reason?: string | null
          freight_terms?: string | null
          general_min_order_amount?: number | null
          last_contact_at?: string | null
          lifecycle_status?: string
          next_action_at?: string | null
          next_action_text?: string | null
          notes?: string | null
          source?: string | null
          supplier_contact_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discard_reason?: string | null
          freight_terms?: string | null
          general_min_order_amount?: number | null
          last_contact_at?: string | null
          lifecycle_status?: string
          next_action_at?: string | null
          next_action_text?: string | null
          notes?: string | null
          source?: string | null
          supplier_contact_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_procurement_profiles_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_group_product_links: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          product_id: string
          supply_group_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id: string
          supply_group_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id?: string
          supply_group_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_group_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_group_product_links_supply_group_id_fkey"
            columns: ["supply_group_id"]
            isOneToOne: false
            referencedRelation: "supply_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_group_product_links_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_groups: {
        Row: {
          comparison_unit: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          comparison_unit?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          comparison_unit?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      task_merge_history: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          merged_data: Json
          merged_task_ids: string[]
          target_task_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          merged_data: Json
          merged_task_ids: string[]
          target_task_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          merged_data?: Json
          merged_task_ids?: string[]
          target_task_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          active_time_entry_id: string | null
          assigned_to: string | null
          checklist: Json | null
          contact_id: string | null
          created_at: string
          deleted_at: string | null
          dependency_id: string | null
          description: string | null
          due_date: string | null
          id: string
          media_urls: Json | null
          node_id: string
          on_hold: boolean
          on_hold_channel: string | null
          on_hold_created_at: string | null
          on_hold_deadline: string | null
          on_hold_note: string | null
          on_hold_who: string | null
          order_index: number
          progress: number
          scheduled_date: string | null
          scheduled_time: string | null
          source: string | null
          status: string
          title: string
          updated_at: string
          use_checklist_progress: boolean | null
        }
        Insert: {
          active_time_entry_id?: string | null
          assigned_to?: string | null
          checklist?: Json | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dependency_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          media_urls?: Json | null
          node_id: string
          on_hold?: boolean
          on_hold_channel?: string | null
          on_hold_created_at?: string | null
          on_hold_deadline?: string | null
          on_hold_note?: string | null
          on_hold_who?: string | null
          order_index?: number
          progress?: number
          scheduled_date?: string | null
          scheduled_time?: string | null
          source?: string | null
          status?: string
          title: string
          updated_at?: string
          use_checklist_progress?: boolean | null
        }
        Update: {
          active_time_entry_id?: string | null
          assigned_to?: string | null
          checklist?: Json | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dependency_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          media_urls?: Json | null
          node_id?: string
          on_hold?: boolean
          on_hold_channel?: string | null
          on_hold_created_at?: string | null
          on_hold_deadline?: string | null
          on_hold_note?: string | null
          on_hold_who?: string | null
          order_index?: number
          progress?: number
          scheduled_date?: string | null
          scheduled_time?: string | null
          source?: string | null
          status?: string
          title?: string
          updated_at?: string
          use_checklist_progress?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_dependency_id_fkey"
            columns: ["dependency_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          entry_type: string
          id: string
          node_id: string | null
          notes: string | null
          started_at: string
          task_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          entry_type?: string
          id?: string
          node_id?: string | null
          notes?: string | null
          started_at: string
          task_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          entry_type?: string
          id?: string
          node_id?: string | null
          notes?: string | null
          started_at?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      timer_state: {
        Row: {
          id: string
          last_update: string
          remaining_seconds: number
          status: string
        }
        Insert: {
          id?: string
          last_update?: string
          remaining_seconds?: number
          status?: string
        }
        Update: {
          id?: string
          last_update?: string
          remaining_seconds?: number
          status?: string
        }
        Relationships: []
      }
      trufa_pack_sealed_events: {
        Row: {
          actor_id: string
          created_at: string
          direction: string
          event_key: string
          id: string
          packs: number
          packs_after: number
          packs_before: number
          reference_id: string
          storage_location_id: string
          units_after: number
          units_before: number
          variant_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          direction: string
          event_key: string
          id?: string
          packs: number
          packs_after: number
          packs_before: number
          reference_id: string
          storage_location_id: string
          units_after: number
          units_before: number
          variant_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          direction?: string
          event_key?: string
          id?: string
          packs?: number
          packs_after?: number
          packs_before?: number
          reference_id?: string
          storage_location_id?: string
          units_after?: number
          units_before?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trufa_pack_sealed_events_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trufa_pack_sealed_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      trufa_pack_sealed_stock: {
        Row: {
          packs: number
          storage_location_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          packs?: number
          storage_location_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          packs?: number
          storage_location_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trufa_pack_sealed_stock_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trufa_pack_sealed_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_integrations: {
        Row: {
          connection_status: string
          created_at: string
          id: string
          instance_reference: string
          is_enabled: boolean
          last_checked_at: string | null
          last_error: string | null
          last_webhook_at: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          connection_status?: string
          created_at?: string
          id?: string
          instance_reference: string
          is_enabled?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          last_webhook_at?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          connection_status?: string
          created_at?: string
          id?: string
          instance_reference?: string
          is_enabled?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          last_webhook_at?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      wizard_steps: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          module_route: string | null
          order_index: number
          step_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          module_route?: string | null
          order_index?: number
          step_key: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          module_route?: string | null
          order_index?: number
          step_key?: string
        }
        Relationships: []
      }
      workflow_plans: {
        Row: {
          completed_at: string | null
          created_at: string
          current_task_id: string | null
          focus_queue_ids: string[]
          id: string
          priority_task_ids: string[]
          selected_task_ids: string[]
          updated_at: string
          user_id: string | null
          week_start: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_task_id?: string | null
          focus_queue_ids?: string[]
          id?: string
          priority_task_ids?: string[]
          selected_task_ids?: string[]
          updated_at?: string
          user_id?: string | null
          week_start: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_task_id?: string | null
          focus_queue_ids?: string[]
          id?: string
          priority_task_ids?: string[]
          selected_task_ids?: string[]
          updated_at?: string
          user_id?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_plans_current_task_id_fkey"
            columns: ["current_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_shopee_cycle: {
        Args: { p_channel_account_id: string }
        Returns: Json
      }
      amendoim_convert_physical_stock: {
        Args: {
          p_confirmed: boolean
          p_direction: string
          p_event_key: string
          p_location_id: string
          p_sacks: number
        }
        Returns: Json
      }
      amendoim_move_sealed_internal: {
        Args: {
          p_delta: number
          p_event_key: string
          p_location_id: string
          p_notes: string
          p_ref_id: string
          p_ref_type: string
        }
        Returns: undefined
      }
      apply_order_stock_event: {
        Args: { p_event: string; p_order_id: string }
        Returns: Json
      }
      apply_product_catalog_import: {
        Args: { p_products?: Json; p_variants?: Json }
        Returns: Json
      }
      approve_campaign: {
        Args: { _campaign_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          authenticated_identity_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          idea_id: string
          metric_name: string
          metric_unit: string
          objective: string
          owner_user_id: string
          status: string
          success_definition: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaign_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_operational_incident_manager: { Args: never; Returns: undefined }
      assert_physical_identity: {
        Args: { p_context: string; p_product_id: string; p_variant_id: string }
        Returns: undefined
      }
      assert_procurement_supplier_contact: {
        Args: { p_context: string; p_supplier_contact_id: string }
        Returns: undefined
      }
      assert_production_closing_manager: { Args: never; Returns: undefined }
      attach_production_fact_process: {
        Args: {
          p_operator_name?: string
          p_operator_user_id?: string
          p_process_id: string
          p_production_fact_id: string
        }
        Returns: Json
      }
      cancel_purchase_with_financial_entries: {
        Args: { p_purchase_order_id: string; p_reason?: string }
        Returns: Json
      }
      chocolate_move_sealed_internal: {
        Args: {
          p_delta: number
          p_event_key: string
          p_location_id: string
          p_notes: string
          p_ref_id: string
          p_ref_type: string
          p_variant_id: string
        }
        Returns: undefined
      }
      claim_shopee_shipping_arrangement: {
        Args: {
          p_channel_account_id: string
          p_order_sn: string
          p_package_number: string
          p_request_hash: string
          p_shop_id: number
        }
        Returns: Json
      }
      claim_shopee_shipping_document: {
        Args: {
          p_channel_account_id: string
          p_document_type: string
          p_order_sn: string
          p_package_number: string
          p_request_hash: string
          p_shop_id: number
        }
        Returns: Json
      }
      complete_campaign: {
        Args: { _campaign_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          authenticated_identity_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          idea_id: string
          metric_name: string
          metric_unit: string
          objective: string
          owner_user_id: string
          status: string
          success_definition: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaign_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_production_order: {
        Args: { p_finished_location?: string; p_production_order_id: string }
        Returns: Json
      }
      complete_production_order_legacy: {
        Args: { p_finished_location?: string; p_production_order_id: string }
        Returns: Json
      }
      complete_shopee_review_login_attempt: {
        Args: { p_attempt_id: string; p_outcome: string }
        Returns: undefined
      }
      confirm_campaign_execution: {
        Args: { _execution_id: string }
        Returns: {
          campaign_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          id: string
          planned_at: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaign_executions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_production_closing: {
        Args: { p_closing_id: string; p_due_date: string }
        Returns: Json
      }
      confirm_purchase_order: {
        Args: { p_purchase_order_id: string }
        Returns: Json
      }
      confirm_purchase_receipt: {
        Args: { p_receipt_id: string }
        Returns: Json
      }
      confirm_purchase_receipt_unguarded_01b: {
        Args: { p_receipt_id: string }
        Returns: Json
      }
      confirm_purchase_with_financial_entries: {
        Args: { p_installments: Json; p_purchase_order_id: string }
        Returns: Json
      }
      consume_shopee_review_login_attempt: {
        Args: {
          p_attempt_key: string
          p_max_attempts: number
          p_window_seconds: number
        }
        Returns: Json
      }
      convert_biscuit_closed_box_stock: {
        Args: {
          p_boxes: number
          p_confirmed: boolean
          p_direction: string
          p_event_key: string
          p_location: string
          p_packages: number
          p_unit_variant_id: string
        }
        Returns: Json
      }
      correct_production_fact: {
        Args: {
          p_occurred_at: string
          p_production_fact_id: string
          p_quantity: number
          p_reason: string
        }
        Returns: Json
      }
      create_economic_prediction_reconciliation: {
        Args: {
          p_comparison_snapshot: Json
          p_financial_entry_id: string
          p_financial_snapshot: Json
          p_marketplace_settlement_id: string
          p_notes?: string
          p_observed_snapshot: Json
          p_order_id: string
          p_pending_snapshot: Json
          p_prediction_snapshot_id: string
          p_status: string
        }
        Returns: string
      }
      create_production_closing: {
        Args: { p_end_date: string; p_notes?: string; p_start_date: string }
        Returns: Json
      }
      create_shopee_api_order: {
        Args: { p_items: Json; p_order: Json }
        Returns: Json
      }
      create_unified_sale: {
        Args: { p_items: Json; p_order: Json }
        Returns: Json
      }
      create_unified_sale_unguarded_01b: {
        Args: { p_items: Json; p_order: Json }
        Returns: Json
      }
      current_app_user_id: { Args: never; Returns: string }
      current_app_user_role: { Args: never; Returns: string }
      delete_production_closing: {
        Args: { p_closing_id: string }
        Returns: Json
      }
      ensure_amendoim_production_material: {
        Args: {
          p_ref_type?: string
          p_reference_id: string
          p_required_g: number
        }
        Returns: number
      }
      ensure_chocolate_production_material: {
        Args: {
          p_ref_type?: string
          p_reference_id: string
          p_required_g: number
          p_variant_id: string
        }
        Returns: number
      }
      ensure_portogel_production_material: {
        Args: { p_production_fact_id: string; p_required_g: number }
        Returns: number
      }
      ensure_trufa_pack_production_material: {
        Args: {
          v_ref: string
          v_ref_type: string
          v_required: number
          v_variant: string
        }
        Returns: undefined
      }
      finalize_order_separation: { Args: { p_order_id: string }; Returns: Json }
      finalize_order_separation_unguarded_01b: {
        Args: { p_order_id: string }
        Returns: Json
      }
      finalize_partial_purchase: {
        Args: { p_id: string; p_reason: string }
        Returns: Json
      }
      finish_shopee_cycle: {
        Args: {
          p_candidate_order_sn: string
          p_channel_account_id: string
          p_code: string
          p_lease_id: string
          p_outcome: string
          p_page: Json
        }
        Returns: Json
      }
      get_purchase_price_reference: {
        Args: {
          p_conversion_factor: number
          p_product_id: string
          p_purchase_presentation_id: string
          p_purchase_unit_label: string
          p_supplier_contact_id: string
          p_variant_id: string
        }
        Returns: number
      }
      get_supplier_delivery_plan: {
        Args: { p_reference_time?: string; p_supplier_contact_id: string }
        Returns: Json
      }
      glucodry_convert_physical_stock: {
        Args: {
          p_confirmed: boolean
          p_direction: string
          p_event_key: string
          p_location_id: string
          p_sacks: number
        }
        Returns: Json
      }
      glucodry_move_sealed_internal: {
        Args: {
          p_delta: number
          p_event_key: string
          p_location_id: string
          p_notes: string
          p_reference_id: string
          p_reference_type: string
        }
        Returns: undefined
      }
      health_can_manage_athlete_access: {
        Args: { p_athlete_id: string }
        Returns: boolean
      }
      health_can_read_athlete: {
        Args: { p_athlete_id: string }
        Returns: boolean
      }
      health_can_write_athlete: {
        Args: { p_athlete_id: string }
        Returns: boolean
      }
      health_m3_create_program_draft: {
        Args: { p_athlete_id: string; p_name: string }
        Returns: {
          program_id: string
          program_version_id: string
        }[]
      }
      health_m3_publish_program_version: {
        Args: { p_program_version_id: string }
        Returns: {
          program_id: string
          queued_count: number
        }[]
      }
      health_m4_add_exercise: {
        Args: {
          p_client_event_id: string
          p_exercise_id: string
          p_session_id: string
        }
        Returns: string
      }
      health_m4_complete_workout: {
        Args: { p_client_event_id: string; p_session_id: string }
        Returns: string
      }
      health_m4_log_set: {
        Args: {
          p_client_event_id: string
          p_load_unit: string
          p_load_value: number
          p_reps: number
          p_rest_seconds?: number
          p_rir: number
          p_session_id: string
          p_set_number: number
          p_set_type: string
          p_workout_exercise_id: string
        }
        Returns: string
      }
      health_m4_replace_exercise: {
        Args: {
          p_client_event_id: string
          p_replacement_exercise_id: string
          p_workout_exercise_id: string
        }
        Returns: string
      }
      health_m4_skip_exercise: {
        Args: { p_client_event_id: string; p_workout_exercise_id: string }
        Returns: string
      }
      health_m4_start_workout: {
        Args: { p_client_event_id: string; p_queue_entry_id: string }
        Returns: string
      }
      health_m4_update_set: {
        Args: {
          p_client_event_id: string
          p_load_unit: string
          p_load_value: number
          p_reps: number
          p_rest_seconds?: number
          p_rir: number
          p_set_id: string
        }
        Returns: string
      }
      health_m5_complete_food_log_day: {
        Args: { p_client_event_id?: string; p_day_id: string }
        Returns: string
      }
      health_m5_correct_meal_item: {
        Args: {
          p_client_event_id: string
          p_confidence?: string
          p_correction_reason?: string
          p_data_source?: string
          p_estimation_method?: string
          p_food_id?: string
          p_household_measure_text?: string
          p_item_name: string
          p_original_item_id: string
          p_preparation_state?: string
          p_quantity?: number
          p_recipe_version_id?: string
          p_unit_code?: string
        }
        Returns: string
      }
      health_m5_create_nutrition_plan_draft: {
        Args: {
          p_athlete_id: string
          p_goal_id?: string
          p_goal_phase_id?: string
          p_name: string
          p_strategy_type?: string
          p_title?: string
        }
        Returns: {
          plan_id: string
          plan_version_id: string
        }[]
      }
      health_m5_create_recipe_draft: {
        Args: { p_athlete_id: string; p_name: string; p_title?: string }
        Returns: {
          recipe_id: string
          recipe_version_id: string
        }[]
      }
      health_m5_log_meal_item: {
        Args: {
          p_client_event_id: string
          p_confidence?: string
          p_data_source?: string
          p_estimation_method?: string
          p_food_id?: string
          p_household_measure_text?: string
          p_item_name: string
          p_meal_log_id: string
          p_preparation_state?: string
          p_quantity?: number
          p_recipe_version_id?: string
          p_unit_code?: string
        }
        Returns: string
      }
      health_m5_publish_nutrition_plan_version: {
        Args: { p_plan_version_id: string }
        Returns: {
          plan_id: string
          published_version_id: string
        }[]
      }
      health_m5_publish_recipe_version: {
        Args: { p_recipe_version_id: string }
        Returns: {
          published_version_id: string
          recipe_id: string
        }[]
      }
      health_m5_reopen_food_log_day: {
        Args: { p_client_event_id?: string; p_day_id: string }
        Returns: string
      }
      health_m5_void_meal_item: {
        Args: {
          p_client_event_id: string
          p_item_id: string
          p_reason?: string
        }
        Returns: string
      }
      health_m6_refresh_daily_state: {
        Args: { p_athlete_id: string; p_state_date: string }
        Returns: string
      }
      health_m6_refresh_rolling_state: {
        Args: {
          p_athlete_id: string
          p_window_days?: number
          p_window_end_date: string
        }
        Returns: string
      }
      health_m6_target_status: {
        Args: { p_max: number; p_min: number; p_value: number }
        Returns: string
      }
      health_m7_evaluate_nutrition_decision: {
        Args: {
          p_as_of_date: string
          p_athlete_id: string
          p_window_days?: number
        }
        Returns: string
      }
      health_m8_record_body_assessment: {
        Args: {
          p_athlete_id: string
          p_client_event_id: string
          p_conditions?: Json
          p_confidence?: string
          p_data_source?: string
          p_measurements: Json
          p_notes?: string
          p_observed_at: string
          p_observed_on: string
          p_supersedes_assessment_id?: string
        }
        Returns: string
      }
      health_m8_refresh_body_state: {
        Args: {
          p_as_of_date: string
          p_athlete_id: string
          p_window_days?: number
        }
        Returns: string
      }
      health_m8_register_body_photo_set: {
        Args: {
          p_assessment_id?: string
          p_athlete_id: string
          p_captured_at: string
          p_captured_on: string
          p_conditions?: Json
          p_notes?: string
          p_photo_set_id: string
          p_photos: Json
        }
        Returns: string
      }
      health_m8_void_body_assessment: {
        Args: { p_assessment_id: string; p_reason: string }
        Returns: string
      }
      health_m8_void_body_photo_set: {
        Args: { p_photo_set_id: string; p_reason: string }
        Returns: string
      }
      health_m9_confirm_clinical_extraction: {
        Args: { p_extraction_id: string }
        Returns: string
      }
      health_m9_record_device_observations: {
        Args: { p_athlete_id: string; p_observations: Json }
        Returns: number
      }
      health_m9_record_lab_report: {
        Args: {
          p_athlete_id: string
          p_client_event_id: string
          p_collected_at?: string
          p_collection_context?: Json
          p_confidence?: string
          p_data_source?: string
          p_document_id?: string
          p_extraction_id?: string
          p_fasting_status?: string
          p_laboratory_name?: string
          p_notes?: string
          p_resulted_at?: string
          p_results: Json
          p_supersedes_lab_report_id?: string
        }
        Returns: string
      }
      health_m9_record_recovery_checkin: {
        Args: {
          p_athlete_id: string
          p_checkin_event_id: string
          p_client_event_id?: string
          p_confidence?: string
          p_data_source?: string
          p_metric_code: string
          p_observed_at: string
          p_observed_on: string
          p_raw_text?: string
          p_supersedes_checkin_id?: string
          p_value_ordinal?: number
        }
        Returns: string
      }
      health_m9_record_sleep_period: {
        Args: {
          p_athlete_id: string
          p_awake_during_period_minutes?: number
          p_awakenings_count?: number
          p_bed_at?: string
          p_client_event_id?: string
          p_confidence?: string
          p_data_source?: string
          p_declared_sleep_minutes?: number
          p_final_wake_at?: string
          p_notes?: string
          p_out_of_bed_at?: string
          p_period_type?: string
          p_sleep_date: string
          p_sleep_start_at?: string
          p_supersedes_sleep_period_id?: string
          p_timezone?: string
        }
        Returns: string
      }
      health_m9_record_vital_observation: {
        Args: {
          p_athlete_id: string
          p_client_event_id: string
          p_condition_text: string
          p_confidence: string
          p_data_source: string
          p_device_text: string
          p_metric_code: string
          p_numeric_value: number
          p_observed_at: string
          p_observed_on: string
          p_secondary_numeric_value: number
          p_supersedes_vital_observation_id: string
          p_unit_code: string
        }
        Returns: string
      }
      health_m9_refresh_biomarker_state: {
        Args: { p_as_of_date: string; p_athlete_id: string }
        Returns: number
      }
      health_m9_refresh_sleep_recovery_state: {
        Args: {
          p_as_of_date: string
          p_athlete_id: string
          p_window_days: number
        }
        Returns: string
      }
      health_m9_register_clinical_document: {
        Args: {
          p_athlete_id: string
          p_data_source: string
          p_document_date: string
          p_document_id: string
          p_document_type: string
          p_mime_type: string
          p_notes: string
          p_object_path: string
          p_original_filename: string
          p_provider_name: string
          p_sha256: string
        }
        Returns: string
      }
      health_m9_reject_clinical_extraction: {
        Args: { p_extraction_id: string; p_reason: string }
        Returns: string
      }
      health_m9_stage_clinical_extraction: {
        Args: {
          p_document_id: string
          p_engine_provider?: string
          p_engine_version?: string
          p_error_message?: string
          p_extraction_id: string
          p_field_confidences?: Json
          p_status: string
          p_structured_payload?: Json
          p_warnings?: Json
        }
        Returns: string
      }
      health_m9_void_clinical_document: {
        Args: { p_document_id: string; p_reason: string }
        Returns: string
      }
      health_m9_void_device_observation: {
        Args: { p_observation_id: string; p_reason: string }
        Returns: string
      }
      health_m9_void_lab_report: {
        Args: { p_lab_report_id: string; p_reason: string }
        Returns: string
      }
      health_m9_void_recovery_checkin: {
        Args: { p_checkin_id: string; p_reason: string }
        Returns: string
      }
      health_m9_void_sleep_period: {
        Args: { p_reason: string; p_sleep_period_id: string }
        Returns: string
      }
      health_m9_void_vital_observation: {
        Args: { p_reason: string; p_vital_observation_id: string }
        Returns: string
      }
      import_shopee_order_with_stock: {
        Args: { p_items: Json; p_order: Json }
        Returns: Json
      }
      import_shopee_order_with_stock_unguarded_01b: {
        Args: { p_items: Json; p_order: Json }
        Returns: Json
      }
      link_order_to_existing_financial_entry: {
        Args: {
          p_description: string
          p_financial_entry_id: string
          p_notes: string
          p_order_id: string
          p_value: number
        }
        Returns: string
      }
      link_order_to_existing_financial_entry_unguarded_01b: {
        Args: {
          p_allocated_value: number
          p_entry_id: string
          p_marketplace_account?: string
          p_order_id: string
          p_sales_channel: string
        }
        Returns: string
      }
      maltodextrina_convert_physical_stock: {
        Args: {
          p_confirmed: boolean
          p_direction: string
          p_event_key: string
          p_location_id: string
          p_sacks: number
        }
        Returns: Json
      }
      maltodextrina_move_sealed_internal: {
        Args: {
          p_delta: number
          p_event_key: string
          p_location_id: string
          p_notes: string
          p_reference_id: string
          p_reference_type: string
        }
        Returns: undefined
      }
      map_contact_to_conv_funnel: { Args: { _status: string }; Returns: string }
      map_conv_to_contact_funnel: { Args: { _stage: string }; Returns: string }
      mark_order_separation_printed: {
        Args: { p_order_id: string }
        Returns: Json
      }
      mark_order_separation_printed_unguarded_01b: {
        Args: { p_order_id: string }
        Returns: {
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          first_printed_at: string | null
          first_printed_by: string | null
          id: string
          logistics_mode: string | null
          operational_destination: string | null
          order_id: string
          print_count: number
          separation_status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_separation"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      merge_contacts: {
        Args: { _duplicate_id: string; _primary_id: string }
        Returns: Json
      }
      normalize_br_phone: { Args: { _raw: string }; Returns: string }
      owns_campaign: { Args: { _campaign_id: string }; Returns: boolean }
      p2_four_apply_internal: {
        Args: {
          p_action: string
          p_count: number
          p_event_key: string
          p_evidence_reference: string
          p_family: string
          p_location_id: string
          p_presentation_id?: string
          p_reference_id: string
          p_reference_type: string
        }
        Returns: Json
      }
      p2_four_assert_generic_inventory_safe: {
        Args: { p_presentation_id?: string; p_product_id: string }
        Returns: undefined
      }
      p2_four_attest_and_open: {
        Args: {
          p_action: string
          p_count: number
          p_event_key: string
          p_evidence_note: string
          p_family: string
          p_location_id: string
          p_physical_confirmation: boolean
        }
        Returns: Json
      }
      p2_four_dispatch_adapter_candidate: {
        Args: {
          p_commercial_count: number
          p_operational_grams: number
          p_order_id: string
          p_order_item_id: string
          p_presentation_id: string
          p_product_id: string
          p_variant_id: string
        }
        Returns: Json
      }
      p2_four_receipt_adapter_candidate: {
        Args: {
          p_location_id: string
          p_operational_grams: number
          p_presentation_id: string
          p_product_id: string
          p_purchase_count: number
          p_receipt_id: string
          p_receipt_item_id: string
          p_variant_id: string
        }
        Returns: Json
      }
      physical_identity_has_operational_usage: {
        Args: { p_product_id: string; p_variant_id: string }
        Returns: boolean
      }
      plan_production_need: {
        Args: {
          p_order_demands?: Json
          p_product_id: string
          p_quantity: number
          p_scheduled_date?: string
          p_variant_id: string
        }
        Returns: Json
      }
      recalculate_contact_payment_metrics: {
        Args: { p_contact_id: string }
        Returns: undefined
      }
      recalculate_production_order_item: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      recalculate_purchase_order_receiving_status: {
        Args: { p_purchase_order_id: string }
        Returns: string
      }
      reconcile_crm_campaign_recipient: {
        Args: { p_recipient_id: string; p_service_message_id: string }
        Returns: Json
      }
      reconcile_marketplace_settlement: {
        Args: { p_entry_ids: string[]; p_payload: Json }
        Returns: string
      }
      reconcile_operational_incident: {
        Args: { p_incident_id: string; p_resolution_note?: string }
        Returns: Json
      }
      reconcile_production_fact_materials: {
        Args: { p_production_fact_id: string }
        Returns: Json
      }
      record_manual_inventory_movement: {
        Args: {
          p_event_key: string
          p_location: string
          p_notes: string
          p_operation: string
          p_product_id: string
          p_quantity: number
          p_to_location: string
          p_variant_id: string
        }
        Returns: Json
      }
      refresh_production_closing_financial_status: {
        Args: { p_closing_id: string }
        Returns: string
      }
      register_intermediate_batch_fact: {
        Args: {
          p_event_key: string
          p_location?: string
          p_occurred_at?: string
          p_output_quantity: number
          p_recipe_id: string
        }
        Returns: Json
      }
      register_production_fact: {
        Args: {
          p_event_key: string
          p_location?: string
          p_occurred_at?: string
          p_operator_name?: string
          p_operator_user_id?: string
          p_product_id: string
          p_production_order_id?: string
          p_quantity: number
          p_variant_id: string
        }
        Returns: Json
      }
      register_purchase_billing: {
        Args: { p_installments: Json; p_purchase_order_id: string }
        Returns: Json
      }
      register_purchase_invoice_billing: {
        Args: {
          p_installments: Json
          p_invoice_date: string
          p_purchase_order_id: string
        }
        Returns: Json
      }
      regularize_purchase_invoice_values: {
        Args: {
          p_access_key: string
          p_installments: Json
          p_invoice_date: string
          p_invoice_number: string
          p_invoice_series: string
          p_item_prices: Json
          p_purchase_order_id: string
          p_reason: string
        }
        Returns: Json
      }
      report_operational_incident: {
        Args: {
          p_applied_quantity?: number
          p_area: string
          p_description?: string
          p_expected_quantity?: number
          p_incident_type: string
          p_metadata?: Json
          p_product_id?: string
          p_source_id?: string
          p_source_type?: string
          p_title: string
          p_unit?: string
          p_variant_id?: string
        }
        Returns: Json
      }
      resolve_shopee_shipping_arrangement: {
        Args: {
          p_attempt_id: string
          p_outcome: string
          p_request_hash: string
        }
        Returns: Json
      }
      resolve_shopee_shipping_document: {
        Args: {
          p_attempt_id: string
          p_outcome: string
          p_request_hash: string
        }
        Returns: Json
      }
      reverse_production_fact: {
        Args: { p_production_fact_id: string; p_reason: string }
        Returns: Json
      }
      set_order_operational_status: {
        Args: { p_order_id: string; p_status: string }
        Returns: Json
      }
      set_order_operational_status_unguarded_01b: {
        Args: { p_order_id: string; p_status: string }
        Returns: Json
      }
      set_product_processes: {
        Args: {
          p_process_ids: string[]
          p_product_id: string
          p_variant_id: string
        }
        Returns: Json
      }
      transition_order_status_with_stock: {
        Args: { p_order_id: string; p_status: string }
        Returns: Json
      }
      transition_order_status_with_stock_unguarded_01b: {
        Args: { p_order_id: string; p_status: string }
        Returns: Json
      }
      trufa_pack_convert_physical_stock: {
        Args: {
          p_direction: string
          p_event_key: string
          p_location_id: string
          p_packs: number
          p_physically_confirmed: boolean
          p_variant_id: string
        }
        Returns: Json
      }
      trufa_pack_move_internal: {
        Args: {
          v_delta: number
          v_direction: string
          v_key: string
          v_location: string
          v_ref: string
          v_variant: string
        }
        Returns: undefined
      }
      upsert_purchase_replenishment_policy: {
        Args: {
          p_is_active?: boolean
          p_is_preferred?: boolean
          p_lead_time_days: number
          p_notes?: string
          p_product_id: string
          p_safety_days: number
          p_supplier_contact_id: string
          p_variant_id: string
        }
        Returns: Json
      }
      validate_production_closing_integrity: {
        Args: { p_closing_id: string }
        Returns: Json
      }
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
