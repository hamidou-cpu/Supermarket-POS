import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          full_name: string;
          role: 'admin' | 'cashier';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          full_name: string;
          role?: 'admin' | 'cashier';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          full_name?: string;
          role?: 'admin' | 'cashier';
          created_at?: string;
          updated_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          status: string | null;
          category: string | null;
          rating: number | null;
          created_at: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          barcode: string;
          category_id: string | null;
          supplier_id: string | null;
          purchase_price: number;
          selling_price: number;
          stock_quantity: number;
          min_stock_level: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          movement_type: 'in' | 'out';
          quantity: number;
          reference: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
      };
      stock_history: {
        Row: {
          id: string;
          product_id: string;
          movement_type: 'sale' | 'restock' | 'adjustment' | 'physical_count' | 'return';
          quantity_before: number;
          quantity_after: number;
          difference: number;
          reference_id: string | null;
          performed_by: string | null;
          notes: string | null;
          created_at: string;
        };
      };
      sales: {
        Row: {
          id: string;
          sale_number: string;
          cashier_id: string;
          total_amount: number;
          payment_method: 'cash' | 'card' | 'mobile';
          status: 'completed' | 'cancelled';
          created_at: string;
        };
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          purchase_price: number;
          subtotal: number;
          created_at: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          user_id: string;
          product_id: string | null;
          alert_type: 'low_stock' | 'overstock' | 'expiring';
          message: string;
          is_read: boolean | null;
          created_at: string;
          acknowledged_at: string | null;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'payment';
          entity_type: string;
          entity_id: string | null;
          changes: Record<string, any> | null;
          ip_address: string | null;
          user_agent: string | null;
          status: 'success' | 'failure';
          error_message: string | null;
          created_at: string;
        };
      };
      customers: {
        Row: {
          id: string;
          phone: string;
          full_name: string;
          email: string | null;
          total_purchases: number;
          total_amount_spent: number;
          loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
          last_purchase_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      loyalty_points: {
        Row: {
          id: string;
          customer_id: string;
          points_balance: number;
          points_earned: number;
          points_redeemed: number;
          last_activity: string;
          created_at: string;
        };
      };
      customer_purchases: {
        Row: {
          id: string;
          customer_id: string;
          sale_id: string;
          amount: number;
          points_earned: number;
          purchase_date: string;
        };
      };
    };
  };
}