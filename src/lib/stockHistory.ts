import { supabase } from './supabase';
import { getCurrentUser } from './auth';

export const recordStockMovement = async (
  productId: string,
  quantityBefore: number,
  quantityAfter: number,
  movementType: 'sale' | 'restock' | 'adjustment' | 'physical_count' | 'return',
  referenceId?: string,
  notes?: string
) => {
  try {
    const currentUser = getCurrentUser();

    await supabase.from('stock_history').insert({
      product_id: productId,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      difference: quantityAfter - quantityBefore,
      movement_type: movementType,
      reference_id: referenceId || null,
      notes,
      performed_by: currentUser?.id || null,
    });
  } catch (error) {
    console.error('Error recording stock movement:', error);
  }
};

export const getProductStockHistory = async (productId: string, limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('stock_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching stock history:', error);
    return [];
  }
};

export const getStockMovementsSummary = async (productId: string, days = 30) => {
  try {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const { data, error } = await supabase
      .from('stock_history')
      .select('movement_type, quantity_before, quantity_after, difference')
      .eq('product_id', productId)
      .gte('created_at', dateFrom.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const summary = {
      sales: 0,
      restocks: 0,
      adjustments: 0,
      totalSoldQty: 0,
      totalRestockedQty: 0,
    };

    data?.forEach((movement: any) => {
      switch (movement.movement_type) {
        case 'sale':
          summary.sales++;
          summary.totalSoldQty += Math.abs(movement.difference || (movement.quantity_before - movement.quantity_after));
          break;
        case 'restock':
          summary.restocks++;
          summary.totalRestockedQty += Math.abs(movement.difference || (movement.quantity_after - movement.quantity_before));
          break;
        case 'adjustment':
          summary.adjustments++;
          break;
      }
    });

    return summary;
  } catch (error) {
    console.error('Error calculating stock movements:', error);
    return { sales: 0, restocks: 0, adjustments: 0, totalSoldQty: 0, totalRestockedQty: 0 };
  }
};
