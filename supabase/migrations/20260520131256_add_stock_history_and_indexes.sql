/*
  # Add performance indexes and stock_history table

  1. New Tables
    - `stock_history` - Detailed stock movement history with full traceability
      - product_id, movement_type (sale/restock/adjustment/physical_count/return)
      - quantity_before, quantity_after, difference
      - reference_id (links to sale/restock), performed_by, notes

  2. Indexes
    - audit_logs: created_at, action, entity_type
    - customers: phone, loyalty_tier
    - loyalty_points: customer_id
    - customer_purchases: customer_id, sale_id
    - sales: created_at, payment_method, status
    - sale_items: product_id, sale_id
    - stock_history: product_id, created_at, movement_type
    - alerts: is_read, product_id

  3. Security
    - Enable RLS on stock_history
    - Policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS stock_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('sale', 'restock', 'adjustment', 'physical_count', 'return')),
  quantity_before int NOT NULL DEFAULT 0,
  quantity_after int NOT NULL DEFAULT 0,
  difference int NOT NULL DEFAULT 0,
  reference_id uuid,
  performed_by uuid REFERENCES users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_history_type ON stock_history(movement_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(loyalty_tier);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer ON loyalty_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_purchases_customer ON customer_purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_purchases_sale ON customer_purchases(sale_id);

CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_payment ON sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_product ON alerts(product_id);

ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stock history"
  ON stock_history FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated users can insert stock history"
  ON stock_history FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);
