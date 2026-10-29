import { supabase } from './supabase';
import { quincenaOf, quincenaShare } from './fixedExpenses';

export type DeletableTransaction = { id: string; kind: 'income' | 'expense'; occurred_on: string; distributes_fixed: boolean };

/**
 * Elimina un movimiento y revierte lo derivado de él: el balance y el disponible se recalculan solos
 * (salen de los movimientos) y las reservas de gastos fijos creadas por ese ingreso se borran en cascada.
 * Si en la misma quincena queda otro salario que repartía gastos fijos, ese salario recupera la reserva.
 */
export async function deleteTransactionWithRollback(userId: string, target: DeletableTransaction) {
  const result = await supabase.from('transactions').delete().eq('id', target.id).eq('user_id', userId).select('id');
  if (result.error) throw result.error;
  if (!result.data || result.data.length === 0) throw new Error('No se pudo eliminar el movimiento. Recarga e inténtalo de nuevo.');
  if (target.kind !== 'income' || !target.distributes_fixed) return;

  const q = quincenaOf(target.occurred_on);
  const remaining = await supabase.from('transactions').select('id, created_at').eq('user_id', userId).eq('kind', 'income').eq('distributes_fixed', true).gte('occurred_on', q.start).lte('occurred_on', q.end).order('created_at').limit(1);
  if (remaining.error) throw remaining.error;
  const heir = remaining.data?.[0];
  if (!heir) return;

  const [existing, expenses] = await Promise.all([
    supabase.from('fixed_expense_periods').select('fixed_expense_id').eq('user_id', userId).eq('period_start', q.start),
    supabase.from('fixed_expenses').select('id, monthly_amount, created_at').eq('user_id', userId),
  ]);
  if (existing.error) throw existing.error;
  if (expenses.error) throw expenses.error;
  const covered = new Set((existing.data ?? []).map(row => row.fixed_expense_id as string));
  const missing = (expenses.data ?? []).filter(item => !covered.has(item.id as string) && (item.created_at as string) <= (heir.created_at as string));
  if (missing.length === 0) return;
  const restore = await supabase.from('fixed_expense_periods').upsert(
    missing.map(item => ({ user_id: userId, fixed_expense_id: item.id, period_start: q.start, amount: quincenaShare(Number(item.monthly_amount), q.half), source_transaction_id: heir.id })),
    { onConflict: 'fixed_expense_id,period_start', ignoreDuplicates: true },
  );
  if (restore.error) throw restore.error;
}
