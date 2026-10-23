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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          created_at: string
          district: string | null
          id: string
          is_default: boolean
          label: string | null
          line1: string
          line2: string | null
          phone: string | null
          postal_code: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          line1: string
          line2?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          line1?: string
          line2?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          created_at: string
          cta_href: string | null
          cta_label: string | null
          ends_at: string | null
          id: string
          image_path: string | null
          is_active: boolean
          slot: string
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          slot: string
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          slot?: string
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          hero_blurb: string | null
          hero_eyebrow: string | null
          hero_headline: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hero_blurb?: string | null
          hero_eyebrow?: string | null
          hero_headline?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hero_blurb?: string | null
          hero_eyebrow?: string | null
          hero_headline?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_grades: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      device_models: {
        Row: {
          created_at: string
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          series: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          image_path?: string | null
          is_active?: boolean
          name: string
          series?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          series?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      featured_products: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          position: number
          product_id: string
          slot: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          product_id: string
          slot?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          product_id?: string
          slot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          delta: number
          entry_seq: number
          id: string
          note: string | null
          order_id: string | null
          product_id: string
          quantity_after: number | null
          quantity_before: number | null
          reason: string
          request_id: string | null
          txid: unknown
          variant_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delta: number
          entry_seq?: never
          id?: string
          note?: string | null
          order_id?: string | null
          product_id: string
          quantity_after?: number | null
          quantity_before?: number | null
          reason: string
          request_id?: string | null
          txid?: unknown
          variant_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delta?: number
          entry_seq?: never
          id?: string
          note?: string | null
          order_id?: string | null
          product_id?: string
          quantity_after?: number | null
          quantity_before?: number | null
          reason?: string
          request_id?: string | null
          txid?: unknown
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
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
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          base_unit_price_cents: number | null
          condition_grade_snapshot: string | null
          condition_snapshot: string | null
          created_at: string
          id: string
          image_path_snapshot: string | null
          line_total_cents: number
          order_id: string
          price_id: string | null
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          tier_code_snapshot: string
          unit_price_cents: number
          variant_id: string | null
          variant_label_snapshot: string | null
          warranty_label_snapshot: string | null
          warranty_months_snapshot: number | null
          warranty_option_id: string | null
          warranty_price_cents_snapshot: number
        }
        Insert: {
          base_unit_price_cents?: number | null
          condition_grade_snapshot?: string | null
          condition_snapshot?: string | null
          created_at?: string
          id?: string
          image_path_snapshot?: string | null
          line_total_cents: number
          order_id: string
          price_id?: string | null
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          tier_code_snapshot: string
          unit_price_cents: number
          variant_id?: string | null
          variant_label_snapshot?: string | null
          warranty_label_snapshot?: string | null
          warranty_months_snapshot?: number | null
          warranty_option_id?: string | null
          warranty_price_cents_snapshot?: number
        }
        Update: {
          base_unit_price_cents?: number | null
          condition_grade_snapshot?: string | null
          condition_snapshot?: string | null
          created_at?: string
          id?: string
          image_path_snapshot?: string | null
          line_total_cents?: number
          order_id?: string
          price_id?: string | null
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          tier_code_snapshot?: string
          unit_price_cents?: number
          variant_id?: string | null
          variant_label_snapshot?: string | null
          warranty_label_snapshot?: string | null
          warranty_months_snapshot?: number | null
          warranty_option_id?: string | null
          warranty_price_cents_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "my_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "product_prices"
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
          {
            foreignKeyName: "order_items_warranty_option_id_fkey"
            columns: ["warranty_option_id"]
            isOneToOne: false
            referencedRelation: "product_warranty_options"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          customer_type_at_purchase: string
          delivery_cents: number
          discount_cents: number
          id: string
          notes: string | null
          order_number: string
          placed_at: string
          profile_id: string
          shipping_address: Json | null
          status: string
          subtotal_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_type_at_purchase: string
          delivery_cents?: number
          discount_cents?: number
          id?: string
          notes?: string | null
          order_number: string
          placed_at?: string
          profile_id: string
          shipping_address?: Json | null
          status?: string
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          customer_type_at_purchase?: string
          delivery_cents?: number
          discount_cents?: number
          id?: string
          notes?: string | null
          order_number?: string
          placed_at?: string
          profile_id?: string
          shipping_address?: Json | null
          status?: string
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_type_at_purchase_fkey"
            columns: ["customer_type_at_purchase"]
            isOneToOne: false
            referencedRelation: "price_tiers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          order_id: string
          provider: string
          provider_ref: string | null
          raw: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          order_id: string
          provider: string
          provider_ref?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          order_id?: string
          provider?: string
          provider_ref?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      price_tiers: {
        Row: {
          code: string
          created_at: string
          is_public: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_public?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_public?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_compatibility: {
        Row: {
          device_model_id: string | null
          id: string
          label: string
          part_kind: string | null
          position: number
          product_id: string
        }
        Insert: {
          device_model_id?: string | null
          id?: string
          label: string
          part_kind?: string | null
          position?: number
          product_id: string
        }
        Update: {
          device_model_id?: string | null
          id?: string
          label?: string
          part_kind?: string | null
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_compatibility_device_model_id_fkey"
            columns: ["device_model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_conditions: {
        Row: {
          accessories_included: string | null
          battery_health: number | null
          condition: string
          condition_grade_id: string | null
          created_at: string
          cycle_count: number | null
          device_notes: string | null
          id: string
          physical_condition: string | null
          product_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          accessories_included?: string | null
          battery_health?: number | null
          condition: string
          condition_grade_id?: string | null
          created_at?: string
          cycle_count?: number | null
          device_notes?: string | null
          id?: string
          physical_condition?: string | null
          product_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          accessories_included?: string | null
          battery_health?: number | null
          condition?: string
          condition_grade_id?: string | null
          created_at?: string
          cycle_count?: number | null
          device_notes?: string | null
          id?: string
          physical_condition?: string | null
          product_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_conditions_condition_grade_id_fkey"
            columns: ["condition_grade_id"]
            isOneToOne: false
            referencedRelation: "condition_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_conditions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_conditions_variant_fk"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          is_primary: boolean
          path: string
          position: number
          product_id: string
          storage_bucket: string | null
          variant_id: string | null
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          path: string
          position?: number
          product_id: string
          storage_bucket?: string | null
          variant_id?: string | null
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          path?: string
          position?: number
          product_id?: string
          storage_bucket?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_fk"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
        ]
      }
      product_prices: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          min_qty: number
          price_cents: number
          product_id: string
          starts_at: string
          tier_code: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          min_qty?: number
          price_cents: number
          product_id: string
          starts_at?: string
          tier_code: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          min_qty?: number
          price_cents?: number
          product_id?: string
          starts_at?: string
          tier_code?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_tier_code_fkey"
            columns: ["tier_code"]
            isOneToOne: false
            referencedRelation: "price_tiers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "product_prices_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specs: {
        Row: {
          id: string
          label: string
          position: number
          product_id: string
          value: string
        }
        Insert: {
          id?: string
          label: string
          position?: number
          product_id: string
          value: string
        }
        Update: {
          id?: string
          label?: string
          position?: number
          product_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          color_code: string | null
          created_at: string
          id: string
          legacy_key: string | null
          name: string
          product_id: string
          sort_order: number
          stock: number | null
          storage: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          color_code?: string | null
          created_at?: string
          id?: string
          legacy_key?: string | null
          name: string
          product_id: string
          sort_order?: number
          stock?: number | null
          storage?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          color_code?: string | null
          created_at?: string
          id?: string
          legacy_key?: string | null
          name?: string
          product_id?: string
          sort_order?: number
          stock?: number | null
          storage?: string | null
          updated_at?: string
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
      product_warranty_options: {
        Row: {
          additional_price_cents: number
          created_at: string
          display_order: number
          duration_months: number
          id: string
          is_default: boolean
          is_enabled: boolean
          plan_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          additional_price_cents?: number
          created_at?: string
          display_order?: number
          duration_months: number
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          plan_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          additional_price_cents?: number
          created_at?: string
          display_order?: number
          duration_months?: number
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          plan_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_warranty_options_plan_fk"
            columns: ["plan_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_warranty_plans"
            referencedColumns: ["id", "product_id"]
          },
          {
            foreignKeyName: "product_warranty_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_warranty_plans: {
        Row: {
          created_at: string
          id: string
          product_id: string
          updated_at: string
          variant_id: string | null
          warranty_covered: string[]
          warranty_description: string | null
          warranty_duration: string | null
          warranty_excluded: string[]
          warranty_months: number | null
          warranty_title: string | null
          warranty_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
          variant_id?: string | null
          warranty_covered?: string[]
          warranty_description?: string | null
          warranty_duration?: string | null
          warranty_excluded?: string[]
          warranty_months?: number | null
          warranty_title?: string | null
          warranty_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
          variant_id?: string | null
          warranty_covered?: string[]
          warranty_description?: string | null
          warranty_duration?: string | null
          warranty_excluded?: string[]
          warranty_months?: number | null
          warranty_title?: string | null
          warranty_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_warranty_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_warranty_plans_variant_fk"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
        ]
      }
      products: {
        Row: {
          accessories_included: string | null
          battery_health: number | null
          category_id: string
          condition: string
          condition_grade_id: string | null
          created_at: string
          cycle_count: number | null
          description: string
          device_notes: string | null
          id: string
          is_active: boolean
          is_new: boolean
          lifecycle_status: string | null
          model: string | null
          name: string
          physical_condition: string | null
          rating: number | null
          reviews_count: number
          sort_order: number
          stock: number
          subcategory: string
          updated_at: string
          warranty_coverage: string | null
          warranty_covered: string[]
          warranty_description: string | null
          warranty_duration: string | null
          warranty_excluded: string[]
          warranty_months: number | null
          warranty_status: string | null
          warranty_text: string | null
          warranty_title: string | null
          warranty_type: string
        }
        Insert: {
          accessories_included?: string | null
          battery_health?: number | null
          category_id: string
          condition?: string
          condition_grade_id?: string | null
          created_at?: string
          cycle_count?: number | null
          description?: string
          device_notes?: string | null
          id: string
          is_active?: boolean
          is_new?: boolean
          lifecycle_status?: string | null
          model?: string | null
          name: string
          physical_condition?: string | null
          rating?: number | null
          reviews_count?: number
          sort_order?: number
          stock?: number
          subcategory: string
          updated_at?: string
          warranty_coverage?: string | null
          warranty_covered?: string[]
          warranty_description?: string | null
          warranty_duration?: string | null
          warranty_excluded?: string[]
          warranty_months?: number | null
          warranty_status?: string | null
          warranty_text?: string | null
          warranty_title?: string | null
          warranty_type?: string
        }
        Update: {
          accessories_included?: string | null
          battery_health?: number | null
          category_id?: string
          condition?: string
          condition_grade_id?: string | null
          created_at?: string
          cycle_count?: number | null
          description?: string
          device_notes?: string | null
          id?: string
          is_active?: boolean
          is_new?: boolean
          lifecycle_status?: string | null
          model?: string | null
          name?: string
          physical_condition?: string | null
          rating?: number | null
          reviews_count?: number
          sort_order?: number
          stock?: number
          subcategory?: string
          updated_at?: string
          warranty_coverage?: string | null
          warranty_covered?: string[]
          warranty_description?: string | null
          warranty_duration?: string | null
          warranty_excluded?: string[]
          warranty_months?: number | null
          warranty_status?: string | null
          warranty_text?: string | null
          warranty_title?: string | null
          warranty_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_condition_grade_id_fkey"
            columns: ["condition_grade_id"]
            isOneToOne: false
            referencedRelation: "condition_grades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          customer_type: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          vip_approved_at: string | null
          vip_approved_by: string | null
          vip_expires_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          customer_type?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          vip_approved_at?: string | null
          vip_approved_by?: string | null
          vip_expires_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          customer_type?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          vip_approved_at?: string | null
          vip_approved_by?: string | null
          vip_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_customer_type_fkey"
            columns: ["customer_type"]
            isOneToOne: false
            referencedRelation: "price_tiers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "profiles_vip_approved_by_fkey"
            columns: ["vip_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          address: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          description: string | null
          email: string | null
          id: boolean
          is_open: boolean
          maintenance_mode: boolean
          opening_hours: string | null
          retail_enabled: boolean
          show_banners: boolean
          show_featured_products: boolean
          show_new_arrivals: boolean
          show_stock_status: boolean
          store_name: string
          updated_at: string
          updated_by: string | null
          whatsapp_number: string | null
          wholesale_enabled: boolean
        }
        Insert: {
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          id?: boolean
          is_open?: boolean
          maintenance_mode?: boolean
          opening_hours?: string | null
          retail_enabled?: boolean
          show_banners?: boolean
          show_featured_products?: boolean
          show_new_arrivals?: boolean
          show_stock_status?: boolean
          store_name?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string | null
          wholesale_enabled?: boolean
        }
        Update: {
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          id?: boolean
          is_open?: boolean
          maintenance_mode?: boolean
          opening_hours?: string | null
          retail_enabled?: boolean
          show_banners?: boolean
          show_featured_products?: boolean
          show_new_arrivals?: boolean
          show_stock_status?: boolean
          store_name?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string | null
          wholesale_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          profile_id: string
          role: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          profile_id: string
          role: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_access_request_notes: {
        Row: {
          admin_notes: string
          request_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_notes: string
          request_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_notes?: string
          request_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_access_request_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "wholesale_access_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_access_request_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_access_requests: {
        Row: {
          admin_updated_at: string | null
          admin_updated_by: string | null
          assistance_requested_at: string | null
          business_name: string
          business_registration: string | null
          business_type: string | null
          contact_phone: string | null
          created_at: string
          customer_values: Json | null
          id: string
          message: string | null
          monthly_volume: string | null
          profile_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          admin_updated_at?: string | null
          admin_updated_by?: string | null
          assistance_requested_at?: string | null
          business_name?: string
          business_registration?: string | null
          business_type?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_values?: Json | null
          id?: string
          message?: string | null
          monthly_volume?: string | null
          profile_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_updated_at?: string | null
          admin_updated_by?: string | null
          assistance_requested_at?: string | null
          business_name?: string
          business_registration?: string | null
          business_type?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_values?: Json | null
          id?: string
          message?: string | null
          monthly_volume?: string | null
          profile_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_access_requests_admin_updated_by_fkey"
            columns: ["admin_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_access_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string
          product_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      my_effective_prices: {
        Row: {
          min_qty: number | null
          price_cents: number | null
          product_id: string | null
          tier_code: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_tier_code_fkey"
            columns: ["tier_code"]
            isOneToOne: false
            referencedRelation: "price_tiers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "product_prices_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      my_prices: {
        Row: {
          id: string | null
          min_qty: number | null
          price_cents: number | null
          product_id: string | null
          tier_code: string | null
          variant_id: string | null
        }
        Insert: {
          id?: string | null
          min_qty?: number | null
          price_cents?: number | null
          product_id?: string | null
          tier_code?: string | null
          variant_id?: string | null
        }
        Update: {
          id?: string | null
          min_qty?: number | null
          price_cents?: number | null
          product_id?: string | null
          tier_code?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_tier_code_fkey"
            columns: ["tier_code"]
            isOneToOne: false
            referencedRelation: "price_tiers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "product_prices_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_review_wholesale_request: {
        Args: { p_note?: string; p_request_id: string; p_status: string }
        Returns: {
          admin_updated_at: string | null
          admin_updated_by: string | null
          assistance_requested_at: string | null
          business_name: string
          business_registration: string | null
          business_type: string | null
          contact_phone: string | null
          created_at: string
          customer_values: Json | null
          id: string
          message: string | null
          monthly_volume: string | null
          profile_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "wholesale_access_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_customer_type: {
        Args: {
          p_customer_type: string
          p_expires_at?: string
          p_profile_id: string
        }
        Returns: {
          avatar_url: string | null
          created_at: string
          customer_type: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          vip_approved_at: string | null
          vip_approved_by: string | null
          vip_expires_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_price: {
        Args: {
          p_min_qty?: number
          p_price_cents?: number
          p_product_id: string
          p_starts_at?: string
          p_tier_code?: string
          p_variant_id?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          min_qty: number
          price_cents: number
          product_id: string
          starts_at: string
          tier_code: string
          updated_at: string
          variant_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "product_prices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_stock: {
        Args: {
          p_expected_quantity: number
          p_new_quantity: number
          p_note: string
          p_product_id: string
          p_reason: string
          p_request_id: string
          p_variant_id: string
        }
        Returns: Json
      }
      admin_update_wholesale_request: {
        Args: { p_admin_notes?: string; p_fields?: Json; p_request_id: string }
        Returns: {
          admin_updated_at: string | null
          admin_updated_by: string | null
          assistance_requested_at: string | null
          business_name: string
          business_registration: string | null
          business_type: string | null
          contact_phone: string | null
          created_at: string
          customer_values: Json | null
          id: string
          message: string | null
          monthly_volume: string | null
          profile_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "wholesale_access_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      customer_save_wholesale_application: {
        Args: { p_action: string; p_fields: Json }
        Returns: {
          admin_updated_at: string | null
          admin_updated_by: string | null
          assistance_requested_at: string | null
          business_name: string
          business_registration: string | null
          business_type: string | null
          contact_phone: string | null
          created_at: string
          customer_values: Json | null
          id: string
          message: string | null
          monthly_volume: string | null
          profile_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "wholesale_access_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      place_order: { Args: { p_lines: Json; p_notes?: string }; Returns: Json }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

