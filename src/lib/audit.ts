import { supabase } from './supabase';
import { getCurrentUser } from './auth';

export interface AuditLog {
  action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'payment';
  entity_type: string;
  entity_id?: string;
  changes?: Record<string, any>;
  status: 'success' | 'failure';
  error_message?: string;
}

export const auditLog = async (log: AuditLog) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const userAgent = navigator.userAgent;

    await supabase.from('audit_logs').insert({
      user_id: currentUser.id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id || null,
      changes: log.changes || {},
      user_agent: userAgent,
      status: log.status,
      error_message: log.error_message || null,
    });
  } catch (error) {
    console.error('Error logging audit:', error);
  }
};

export const logSale = async (saleId: string, totalAmount: number, itemCount: number, paymentMethod: string, status: 'success' | 'failure' = 'success', error?: string) => {
  await auditLog({
    action: 'payment',
    entity_type: 'sale',
    entity_id: saleId,
    changes: {
      total_amount: totalAmount,
      item_count: itemCount,
      payment_method: paymentMethod,
    },
    status,
    error_message: error,
  });
};

export const logProductChange = async (productId: string, changeType: 'create' | 'update' | 'delete', before?: Record<string, any>, after?: Record<string, any>) => {
  await auditLog({
    action: changeType,
    entity_type: 'product',
    entity_id: productId,
    changes: {
      before,
      after,
    },
    status: 'success',
  });
};

export const logExport = async (exportType: string, recordCount: number) => {
  await auditLog({
    action: 'export',
    entity_type: exportType,
    changes: {
      record_count: recordCount,
      export_time: new Date().toISOString(),
    },
    status: 'success',
  });
};
