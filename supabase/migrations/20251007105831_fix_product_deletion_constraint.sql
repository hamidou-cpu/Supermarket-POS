/*
  # Fix Product Deletion Constraint

  1. Changes
    - Modify the foreign key constraint on sale_items.product_id
    - Change from ON DELETE RESTRICT to ON DELETE SET NULL
    - This allows products to be deleted while preserving sale history
    - The product_name field in sale_items will maintain the historical record
  
  2. Security
    - No changes to RLS policies
    - Maintains data integrity by keeping product_name for historical reference

  3. Important Notes
    - Products can now be deleted even if they appear in past sales
    - Sale items will keep the product name and price information
    - The product_id will be set to NULL when a product is deleted
*/

-- Drop the existing foreign key constraint
ALTER TABLE sale_items
DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;

-- Add the new foreign key constraint with ON DELETE SET NULL
ALTER TABLE sale_items
ADD CONSTRAINT sale_items_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES products(id)
ON DELETE SET NULL;

-- Make product_id nullable to support the SET NULL behavior
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' 
    AND column_name = 'product_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE sale_items ALTER COLUMN product_id DROP NOT NULL;
  END IF;
END $$;
