import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { isOnline, onConnectionChange, getPendingTransactions, markTransactionSynced, deleteTransaction, PendingTransaction } from '../lib/offline';
import { supabase } from '../lib/supabase';

interface OfflineContextType {
  isOnline: boolean;
  hasPendingTransactions: boolean;
  pendingCount: number;
  syncPending: () => Promise<{ synced: number; failed: number }>;
  isSyncing: boolean;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider = ({ children }: { children: ReactNode }) => {
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const updatePendingCount = useCallback(async () => {
    try {
      const pending = await getPendingTransactions();
      setPendingCount(pending.filter(t => !t.synced).length);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    updatePendingCount();
    onConnectionChange((isOnlineNow) => {
      setOnline(isOnlineNow);
      if (isOnlineNow) {
        setTimeout(updatePendingCount, 500);
      }
    });
  }, [updatePendingCount]);

  const syncPending = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (isSyncing || !online) return { synced: 0, failed: 0 };

    setIsSyncing(true);
    let synced = 0;
    let failed = 0;

    try {
      const pending = await getPendingTransactions();
      const unsynced = pending.filter(t => !t.synced);

      for (const transaction of unsynced) {
        try {
          const { error: saleError } = await supabase.from('sales').insert([{
            sale_number: transaction.sale_number,
            cashier_id: transaction.cashier_id,
            total_amount: transaction.total_amount,
            payment_method: transaction.payment_method,
            status: 'completed',
          }]).select().single();

          if (saleError) {
            failed++;
            continue;
          }

          const saleItems = transaction.items;
          const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);

          if (itemsError) {
            failed++;
            continue;
          }

          for (const item of transaction.items) {
            const { error: stockError } = await supabase
              .from('products')
              .update({ stock_quantity: supabase.sql`stock_quantity - ${item.quantity}` })
              .eq('id', item.product_id);

            if (stockError) {
              failed++;
              continue;
            }
          }

          await markTransactionSynced(transaction.id!);
          synced++;
        } catch {
          failed++;
        }
      }

      await updatePendingCount();
    } catch {
      // silent
    } finally {
      setIsSyncing(false);
    }

    return { synced, failed };
  }, [online, isSyncing, updatePendingCount]);

  useEffect(() => {
    if (online && pendingCount > 0) {
      const timeout = setTimeout(() => syncPending(), 2000);
      return () => clearTimeout(timeout);
    }
  }, [online, pendingCount, syncPending]);

  return (
    <OfflineContext.Provider value={{
      isOnline: online,
      hasPendingTransactions: pendingCount > 0,
      pendingCount,
      syncPending,
      isSyncing,
    }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) throw new Error('useOffline must be used within OfflineProvider');
  return context;
};
