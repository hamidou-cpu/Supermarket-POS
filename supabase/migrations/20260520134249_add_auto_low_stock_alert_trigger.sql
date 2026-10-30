/*
  # Auto-generate low stock alerts via database trigger

  1. Problem
    - Alerts are never created automatically when stock drops below min_stock_level
    - The alerts table stays empty even when products have negative stock
    - The LowStockAlerts component only reads from the alerts table

  2. Solution
    - Create a trigger function that checks stock after every sale or stock update
    - Automatically inserts an alert when stock_quantity < min_stock_level
    - Avoid duplicate alerts: only insert if no unread alert exists for that product
    - Also create a trigger on products UPDATE to catch manual stock changes

  3. Security
    - Trigger runs as SECURITY DEFINER (bypasses RLS for inserts into alerts)
    - Only creates alerts, never deletes or modifies existing ones
*/

-- Function to check and create low stock alerts
CREATE OR REPLACE FUNCTION check_low_stock_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if stock_quantity or min_stock_level changed
  IF NEW.stock_quantity < NEW.min_stock_level THEN
    -- Insert alert only if no unread alert exists for this product
    INSERT INTO alerts (user_id, product_id, alert_type, message, is_read)
    SELECT 
      COALESCE(
        (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
        '00000000-0000-0000-0000-000000000000'::uuid
      ),
      NEW.id,
      'low_stock',
      CASE 
        WHEN NEW.stock_quantity <= 0 THEN 'RUPTURE DE STOCK: ' || NEW.name || ' - Quantite: ' || NEW.stock_quantity || ' (Seuil min: ' || NEW.min_stock_level || ')'
        ELSE 'Stock faible: ' || NEW.name || ' - Quantite: ' || NEW.stock_quantity || ' (Seuil min: ' || NEW.min_stock_level || ')'
      END,
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM alerts 
      WHERE alerts.product_id = NEW.id 
      AND alerts.alert_type = 'low_stock' 
      AND alerts.is_read = false
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on products table (after UPDATE to stock_quantity)
DROP TRIGGER IF EXISTS trigger_check_low_stock ON products;
CREATE TRIGGER trigger_check_low_stock
  AFTER UPDATE OF stock_quantity, min_stock_level ON products
  FOR EACH ROW
  EXECUTE FUNCTION check_low_stock_alert();

-- Trigger on products table (after INSERT for new products already below threshold)
DROP TRIGGER IF EXISTS trigger_check_low_stock_insert ON products;
CREATE TRIGGER trigger_check_low_stock_insert
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION check_low_stock_alert();

-- Backfill: Create alerts for all existing products already below min_stock_level
INSERT INTO alerts (user_id, product_id, alert_type, message, is_read)
SELECT 
  COALESCE(
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  p.id,
  'low_stock',
  CASE 
    WHEN p.stock_quantity <= 0 THEN 'RUPTURE DE STOCK: ' || p.name || ' - Quantite: ' || p.stock_quantity || ' (Seuil min: ' || p.min_stock_level || ')'
    ELSE 'Stock faible: ' || p.name || ' - Quantite: ' || p.stock_quantity || ' (Seuil min: ' || p.min_stock_level || ')'
  END,
  false
FROM products p
WHERE p.stock_quantity < p.min_stock_level
AND NOT EXISTS (
  SELECT 1 FROM alerts a 
  WHERE a.product_id = p.id 
  AND a.alert_type = 'low_stock'
);
