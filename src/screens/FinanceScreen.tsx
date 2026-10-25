import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Card, Chip, EmptyState, ErrorText, Field, Icon, ProgressBar, SectionHeader } from '../components/ui';
import FixedExpenseCard from '../components/FixedExpenseCard';
import FixedExpensesAccordion from '../components/FixedExpensesAccordion';
import { fixedOverview, quincenaOf, quincenaShare, quincenaSummary, toDateString, type FixedExpense, type FixedPeriod } from '../lib/fixedExpenses';
import { colors, money, radius, space, type } from '../theme';

type Transaction = { id: string; kind: 'income' | 'expense'; amount: number; note: string; occurred_on: string; category_id: string | null; distributes_fixed: boolean; created_at: string };
type Goal = { id: string; name: string; target_amount: number; current_amount: number; deadline: string | null };
type Category = { id: string; name: string; kind: 'income' | 'expense' };
const EXPENSE_CATEGORIES = ['Alimentación', 'Transporte', 'Ocio', 'Hogar', 'Salud', 'Otros'];
const MISSING_TABLES = 'Faltan las tablas de gastos fijos. Ejecuta supabase/migrations/20261024_fixed_expenses.sql en el SQL Editor de Supabase y vuelve a abrir Finanzas.';
const INCOME_CATEGORIES = ['Salario', 'Ventas', 'Regalo', 'Otros'];
const SALARY_CATEGORY = 'Salario';

export default function FinanceScreen({ userId }: { userId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'transaction' | 'goal' | 'contribution' | 'fixed' | 'deleteFixed' | 'deleteTx' | 'deleteGoal' | null>(null);
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryName, setCategoryName] = useState(EXPENSE_CATEGORIES[0]);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [contribution, setContribution] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [periods, setPeriods] = useState<FixedPeriod[]>([]);
  const [fixedError, setFixedError] = useState('');
  const [fixedName, setFixedName] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedDue, setFixedDue] = useState('');
  const [splitIncome, setSplitIncome] = useState(true);
  const [paidBusyId, setPaidBusyId] = useState('');
  const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FixedExpense | null>(null);
  const [pendingTx, setPendingTx] = useState<Transaction | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [pendingGoal, setPendingGoal] = useState<Goal | null>(null);
  const [fixedWarning, setFixedWarning] = useState('');
  const [fixedOpen, setFixedOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const today = toDateString(new Date());

  const load = useCallback(async () => {
    setError('');
    const [tx, goalRows, categoryRows] = await Promise.all([
      supabase.from('transactions').select('id, kind, amount, note, occurred_on, category_id, distributes_fixed, created_at').eq('user_id', userId).order('occurred_on', { ascending: false }).limit(50),
      supabase.from('financial_goals').select('id, name, target_amount, current_amount, deadline').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name, kind').eq('user_id', userId),
    ]);
    const firstError = tx.error ?? goalRows.error ?? categoryRows.error;
    if (firstError) setError(firstError.message);
    else { setTransactions((tx.data ?? []) as Transaction[]); setGoals((goalRows.data ?? []) as Goal[]); setCategories((categoryRows.data ?? []) as Category[]); }
    const [expenseRows, periodRows] = await Promise.all([
      supabase.from('fixed_expenses').select('id, name, monthly_amount, due_day, created_at').eq('user_id', userId).order('due_day').order('created_at'),
      supabase.from('fixed_expense_periods').select('id, fixed_expense_id, period_start, amount, paid_at').eq('user_id', userId).gte('period_start', `${toDateString(new Date()).slice(0, 7)}-01`),
    ]);
    const fixedFailure = expenseRows.error ?? periodRows.error;
    if (fixedFailure) setFixedError(/fixed_expense|schema cache|does not exist|relation/i.test(fixedFailure.message) ? MISSING_TABLES : fixedFailure.message);
    else { setFixedError(''); setFixedExpenses((expenseRows.data ?? []) as FixedExpense[]); setPeriods((periodRows.data ?? []) as FixedPeriod[]); }
    setLoading(false);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthRows = transactions.filter(row => row.occurred_on.startsWith(currentMonth));
  const income = monthRows.filter(row => row.kind === 'income').reduce((sum, row) => sum + Number(row.amount), 0);
  const expenses = monthRows.filter(row => row.kind === 'expense').reduce((sum, row) => sum + Number(row.amount), 0);

  const quincena = quincenaOf(today);
  const overview = fixedOverview(fixedExpenses, periods, today);
  const summary = quincenaSummary(fixedExpenses, periods, transactions, today);
  const incomePreview = Number(amount.replace(',', '.'));
  const missingShare = Math.round(fixedExpenses.filter(item => !periods.some(period => period.fixed_expense_id === item.id && period.period_start === quincena.start)).reduce((sum, item) => sum + quincenaShare(Number(item.monthly_amount), quincena.half), 0) * 100) / 100;
  const availableAfter = (extraIncome: number) => Math.round((summary.income + extraIncome - summary.reserved - missingShare - summary.spent) * 100) / 100;

  const saveTransaction = async () => {
    const parsed = Number(amount.replace(',', '.'));
    if (!(parsed > 0)) return setError('Escribe un monto mayor que cero.');
    setBusy(true); setError('');
    try {
      let category = categories.find(item => item.name === categoryName && item.kind === kind);
      if (!category) {
        const created = await supabase.from('categories').insert({ user_id: userId, name: categoryName, kind }).select('id, name, kind').single();
        if (created.error) throw created.error;
        category = created.data as Category;
      }
      const distributes = kind === 'income' && categoryName === SALARY_CATEGORY && splitIncome && fixedExpenses.length > 0;
      const result = await supabase.from('transactions').insert({ user_id: userId, category_id: category.id, kind, amount: parsed, note: note.trim(), occurred_on: today, distributes_fixed: distributes }).select('id').single();
      if (result.error) throw result.error;
      let message = '';
      if (distributes) {
        const missing = fixedExpenses.filter(item => !periods.some(period => period.fixed_expense_id === item.id && period.period_start === quincena.start));
        if (missing.length > 0) {
          const reserve = await supabase.from('fixed_expense_periods').upsert(missing.map(item => ({ user_id: userId, fixed_expense_id: item.id, period_start: quincena.start, amount: quincenaShare(Number(item.monthly_amount), quincena.half), source_transaction_id: (result.data as { id: string }).id })), { onConflict: 'fixed_expense_id,period_start', ignoreDuplicates: true });
          if (reserve.error) throw reserve.error;
        }
        message = `Reservado ${money(missingShare)} para gastos fijos · Disponible ${money(availableAfter(parsed))}`;
      }
      setAmount(''); setNote(''); setModal(null); setNotice(message); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el movimiento.'); }
    finally { setBusy(false); }
  };

  const openFixedCreate = () => { setEditingFixed(null); setFixedName(''); setFixedAmount(''); setFixedDue(''); setError(''); setModal('fixed'); };
  const openFixedEdit = (expense: FixedExpense) => { setEditingFixed(expense); setFixedName(expense.name); setFixedAmount(String(expense.monthly_amount)); setFixedDue(String(expense.due_day)); setError(''); setModal('fixed'); };
  const closeModal = () => { setModal(null); setError(''); setEditingFixed(null); setPendingDelete(null); setPendingTx(null); setEditingGoal(null); setPendingGoal(null); };

  const saveFixed = async () => {
    const monthly = Number(fixedAmount.replace(',', '.'));
    const dueDay = Number(fixedDue);
    if (!fixedName.trim() || !(monthly > 0)) return setError('Escribe un nombre y un monto mensual mayor que cero.');
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return setError('El día límite de pago debe estar entre 1 y 31.');
    setBusy(true); setError('');
    const values = { name: fixedName.trim(), monthly_amount: monthly, due_day: dueDay };
    const result = editingFixed
      ? await supabase.from('fixed_expenses').update(values).eq('id', editingFixed.id).eq('user_id', userId).select('id')
      : await supabase.from('fixed_expenses').insert({ user_id: userId, ...values }).select('id');
    setBusy(false);
    if (result.error) setError(/fixed_expense|schema cache|does not exist|relation/i.test(result.error.message) ? MISSING_TABLES : result.error.message);
    else { setFixedWarning(''); closeModal(); await load(); }
  };

  const togglePaid = async (expense: FixedExpense) => {
    setFixedWarning(''); setError('');
    const current = periods.find(period => period.fixed_expense_id === expense.id && period.period_start === quincena.start);
    if (!current) { setFixedWarning(`Para pagar "${expense.name}" primero registra tu ingreso de salario de esta quincena: los gastos fijos solo se cubren con salario.`); return; }
    setPaidBusyId(expense.id);
    const result = await supabase.from('fixed_expense_periods').update({ paid_at: current.paid_at ? null : new Date().toISOString() }).eq('id', current.id).eq('user_id', userId).select('id');
    setPaidBusyId('');
    if (result.error) setError(result.error.message); else await load();
  };

  const confirmDeleteFixed = async () => {
    if (!pendingDelete) return;
    setBusy(true); setError('');
    const result = await supabase.from('fixed_expenses').delete().eq('id', pendingDelete.id).eq('user_id', userId).select('id');
    setBusy(false);
    if (result.error) setError(result.error.message);
    else if (!result.data || result.data.length === 0) setError('No se pudo eliminar el gasto. Recarga e inténtalo de nuevo.');
    else { setFixedWarning(''); closeModal(); await load(); }
  };

  /**
   * Elimina un movimiento y revierte todo lo derivado de él: el balance y el disponible se recalculan solos
   * (se calculan desde los movimientos) y las reservas de gastos fijos creadas por ese ingreso se borran en cascada.
   * Si en la misma quincena queda otro salario que repartía gastos fijos, ese salario recupera la reserva.
   */
  const deleteTransaction = async () => {
    if (!pendingTx) return;
    const target = pendingTx;
    setBusy(true); setError('');
    try {
      const result = await supabase.from('transactions').delete().eq('id', target.id).eq('user_id', userId).select('id');
      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) throw new Error('No se pudo eliminar el movimiento. Recarga e inténtalo de nuevo.');
      if (target.kind === 'income' && target.distributes_fixed) {
        const q = quincenaOf(target.occurred_on);
        const remaining = await supabase.from('transactions').select('id, created_at').eq('user_id', userId).eq('kind', 'income').eq('distributes_fixed', true).gte('occurred_on', q.start).lte('occurred_on', q.end).order('created_at').limit(1);
        if (remaining.error) throw remaining.error;
        const heir = remaining.data?.[0];
        if (heir) {
          const existing = await supabase.from('fixed_expense_periods').select('fixed_expense_id').eq('user_id', userId).eq('period_start', q.start);
          if (existing.error) throw existing.error;
          const covered = new Set((existing.data ?? []).map(row => row.fixed_expense_id as string));
          const missing = fixedExpenses.filter(item => !covered.has(item.id) && item.created_at <= heir.created_at);
          if (missing.length > 0) {
            const restore = await supabase.from('fixed_expense_periods').upsert(missing.map(item => ({ user_id: userId, fixed_expense_id: item.id, period_start: q.start, amount: quincenaShare(Number(item.monthly_amount), q.half), source_transaction_id: heir.id })), { onConflict: 'fixed_expense_id,period_start', ignoreDuplicates: true });
            if (restore.error) throw restore.error;
          }
        }
      }
      setNotice(''); closeModal(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar el movimiento.'); }
    finally { setBusy(false); }
  };

  const openGoalCreate = () => { setEditingGoal(null); setGoalName(''); setGoalTarget(''); setGoalDeadline(''); setError(''); setModal('goal'); };
  const openGoalEdit = (goal: Goal) => { setEditingGoal(goal); setGoalName(goal.name); setGoalTarget(String(goal.target_amount)); setGoalDeadline(goal.deadline ?? ''); setError(''); setModal('goal'); };

  const saveGoal = async () => {
    const target = Number(goalTarget.replace(',', '.'));
    if (!goalName.trim() || !(target > 0)) return setError('Escribe un nombre y un monto objetivo válido.');
    if (goalDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(goalDeadline.trim())) return setError('La fecha límite debe tener el formato AAAA-MM-DD, por ejemplo 2026-12-31.');
    setBusy(true); setError('');
    const values = { name: goalName.trim(), target_amount: target, deadline: goalDeadline.trim() || null };
    const result = editingGoal
      ? await supabase.from('financial_goals').update(values).eq('id', editingGoal.id).eq('user_id', userId).select('id')
      : await supabase.from('financial_goals').insert({ user_id: userId, ...values }).select('id');
    setBusy(false);
    if (result.error) setError(result.error.message);
    else { setGoalName(''); setGoalTarget(''); setGoalDeadline(''); closeModal(); await load(); }
  };

  const deleteGoal = async () => {
    if (!pendingGoal) return;
    setBusy(true); setError('');
    const result = await supabase.from('financial_goals').delete().eq('id', pendingGoal.id).eq('user_id', userId).select('id');
    setBusy(false);
    if (result.error) setError(result.error.message);
    else if (!result.data || result.data.length === 0) setError('No se pudo eliminar la meta. Recarga e inténtalo de nuevo.');
    else { closeModal(); await load(); }
  };

  const saveContribution = async () => {
    if (!selectedGoal) return;
    const added = Number(contribution.replace(',', '.'));
    if (!(added > 0)) return setError('Escribe un aporte mayor que cero.');
    setBusy(true); setError('');
    const result = await supabase.from('financial_goals').update({ current_amount: Number(selectedGoal.current_amount) + added }).eq('id', selectedGoal.id).eq('user_id', userId);
    setBusy(false);
    if (result.error) setError(result.error.message);
    else { setContribution(''); setSelectedGoal(null); setModal(null); await load(); }
  };

  return <View>
    <Card glow style={{ paddingVertical: space.xl }}>
      <Text style={type.overline}>BALANCE DE ESTE MES</Text>
      <Text style={styles.balance}>{money(income - expenses)}</Text>
      <View style={styles.flowRow}>
        <View style={styles.flow}><Icon name="arrow-down-left" size={14} color={colors.accent} /><Text style={styles.flowText}>{money(income)}</Text></View>
        <View style={styles.flow}><Icon name="arrow-up-right" size={14} color={colors.danger} /><Text style={styles.flowText}>{money(expenses)}</Text></View>
      </View>
    </Card>
    <Button label="Registrar movimiento" icon="plus" onPress={() => { setKind('expense'); setCategoryName(EXPENSE_CATEGORIES[0]); setError(''); setModal('transaction'); }} />

    <Card style={{ marginTop: space.lg }}>
      <View style={styles.qHeader}><Text style={type.overline}>QUINCENA · {quincena.label.toUpperCase()}</Text></View>
      <Text style={styles.qLabel}>Disponible</Text>
      <Text style={[styles.qAvailable, summary.available < 0 && { color: colors.danger }]}>{money(summary.available)}</Text>
      <View style={styles.qRow}><Text style={styles.qKey}>Ingresos</Text><Text style={styles.qVal}>{money(summary.income)}</Text></View>
      <View style={styles.qRow}><Text style={styles.qKey}>Reservado para gastos fijos</Text><Text style={styles.qVal}>− {money(summary.reserved)}</Text></View>
      <View style={styles.qRow}><Text style={styles.qKey}>Otros gastos</Text><Text style={styles.qVal}>− {money(summary.spent)}</Text></View>
    </Card>
    {!!notice && <View style={styles.notice}><Icon name="check-circle" size={16} color={colors.accent} /><Text style={styles.noticeText}>{notice}</Text></View>}

    <FixedExpensesAccordion overview={overview} count={fixedExpenses.length} expanded={fixedOpen} onToggle={setFixedOpen} onAdd={openFixedCreate}>
      <ErrorText>{fixedWarning}</ErrorText>
      {fixedError ? <ErrorText>{fixedError}</ErrorText> : fixedExpenses.length === 0
        ? <View style={{ marginBottom: space.md }}><EmptyState icon="calendar" text="Registra tus gastos mensuales (renta, internet…). Se dividen solos entre las dos quincenas." /></View>
        : fixedExpenses.map(expense => <FixedExpenseCard key={expense.id} expense={expense} periods={periods} today={today} busy={paidBusyId === expense.id} onTogglePaid={() => togglePaid(expense)} onEdit={() => openFixedEdit(expense)} onDelete={() => { setPendingDelete(expense); setError(''); setModal('deleteFixed'); }} />)}
    </FixedExpensesAccordion>

    <SectionHeader title="Metas financieras" action="Crear meta" onAction={openGoalCreate} />
    {goals.length === 0 ? <EmptyState icon="target" text="Aún no tienes metas. Crea una para seguir tu progreso." /> : goals.map(goal => {
      const progress = Math.min(100, Math.round(Number(goal.current_amount) / Number(goal.target_amount) * 100));
      return <Card key={goal.id} style={{ marginBottom: space.md }}>
        <View style={styles.goalHeader}><Text style={styles.goalName}>{goal.name}</Text><Text style={styles.goalPercent}>{progress}%</Text></View>
        <View style={{ marginTop: space.md }}><ProgressBar percent={progress} /></View>
        <Text style={[type.caption, { marginTop: space.md }]}>{money(Number(goal.current_amount))} de {money(Number(goal.target_amount))}{goal.deadline ? ` · Límite ${goal.deadline}` : ''}</Text>
        <View style={styles.goalActions}>
          <TouchableOpacity style={styles.contribute} onPress={() => { setSelectedGoal(goal); setError(''); setModal('contribution'); }}><Icon name="plus" size={14} color={colors.accent} /><Text style={styles.contributeText}>Aportar</Text></TouchableOpacity>
          <View style={styles.iconRow}>
            <TouchableOpacity onPress={() => openGoalEdit(goal)} hitSlop={8} style={styles.iconButton} accessibilityLabel={`Modificar meta ${goal.name}`}><Icon name="edit-2" size={16} color={colors.inkSoft} /></TouchableOpacity>
            <TouchableOpacity onPress={() => { setPendingGoal(goal); setError(''); setModal('deleteGoal'); }} hitSlop={8} style={styles.iconButton} accessibilityLabel={`Eliminar meta ${goal.name}`}><Icon name="trash-2" size={16} color={colors.danger} /></TouchableOpacity>
          </View>
        </View>
      </Card>;
    })}

    <SectionHeader title="Movimientos recientes" />
    {loading ? <ActivityIndicator color={colors.accent} style={{ margin: 24 }} /> : transactions.length === 0 ? <EmptyState icon="credit-card" text="Todavía no hay ingresos ni gastos registrados." /> : <Card style={styles.list}>{transactions.map((row, index) => {
      const category = categories.find(item => item.id === row.category_id)?.name ?? 'Sin categoría';
      const isIncome = row.kind === 'income';
      return <View key={row.id} style={[styles.txRow, index > 0 && styles.txDivider]}>
        <View style={[styles.txIcon, isIncome && styles.txIconIncome]}><Icon name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={isIncome ? colors.accent : colors.danger} /></View>
        <View style={styles.txCopy}><Text style={styles.txTitle} numberOfLines={1}>{row.note || category}</Text><Text style={type.caption}>{category} · {row.occurred_on}</Text></View>
        <Text style={[styles.txAmount, isIncome && { color: colors.accent }]}>{isIncome ? '+' : '−'}{money(Number(row.amount))}</Text>
        <TouchableOpacity onPress={() => { setPendingTx(row); setError(''); setModal('deleteTx'); }} hitSlop={8} style={styles.txDelete} accessibilityLabel={`Eliminar movimiento ${row.note || category}`}><Icon name="trash-2" size={15} color={colors.muted} /></TouchableOpacity>
      </View>;
    })}</Card>}
    {!modal && <ErrorText>{error}</ErrorText>}

    <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={closeModal}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding"><View style={styles.backdrop}><ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled"><View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.modalHeader}><Text style={type.title}>{modal === 'transaction' ? 'Nuevo movimiento' : modal === 'goal' ? (editingGoal ? 'Modificar meta' : 'Nueva meta') : modal === 'deleteGoal' ? 'Eliminar meta' : modal === 'fixed' ? (editingFixed ? 'Modificar gasto fijo' : 'Nuevo gasto fijo') : modal === 'deleteFixed' ? 'Eliminar gasto fijo' : modal === 'deleteTx' ? 'Eliminar movimiento' : 'Añadir aporte'}</Text><TouchableOpacity onPress={closeModal} hitSlop={10}><Icon name="x" size={22} color={colors.muted} /></TouchableOpacity></View>
        {modal === 'transaction' && <>
          <View style={styles.segmentRow}>{(['expense', 'income'] as const).map(value => <TouchableOpacity key={value} activeOpacity={0.8} style={[styles.segment, kind === value && styles.segmentSelected]} onPress={() => { setKind(value); setCategoryName(value === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]); }}><Text style={[styles.segmentText, kind === value && styles.segmentTextSelected]}>{value === 'expense' ? 'Gasto' : 'Ingreso'}</Text></TouchableOpacity>)}</View>
          <Field label="MONTO" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
          <Text style={[type.overline, { marginTop: space.lg, marginBottom: 8 }]}>CATEGORÍA</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{(kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(name => <Chip key={name} label={name} selected={name === categoryName} onPress={() => setCategoryName(name)} />)}</ScrollView>
          <Field label="NOTA (OPCIONAL)" value={note} onChangeText={setNote} placeholder="Descripción" />
          {kind === 'income' && categoryName !== SALARY_CATEGORY && fixedExpenses.length > 0 && <Text style={[type.caption, { marginTop: space.lg }]}>Los gastos fijos solo se cubren con ingresos de salario; este ingreso no se reparte.</Text>}
          {kind === 'income' && categoryName === SALARY_CATEGORY && fixedExpenses.length > 0 && <View style={styles.splitBox}>
            <View style={styles.splitRow}>
              <View style={{ flex: 1 }}><Text style={type.heading}>Pago quincenal</Text><Text style={[type.caption, { marginTop: 3 }]}>Reservar la parte de la quincena de tus gastos fijos</Text></View>
              <Chip label={splitIncome ? 'Sí' : 'No'} selected={splitIncome} onPress={() => setSplitIncome(value => !value)} />
            </View>
            {splitIncome && incomePreview > 0 && <Text style={styles.splitPreview}>Se reservan {money(missingShare)} · quedan {money(availableAfter(incomePreview))} disponibles</Text>}
          </View>}
          <Button label="Guardar movimiento" onPress={saveTransaction} busy={busy} />
        </>}
        {modal === 'fixed' && <>
          <Field label="NOMBRE DEL GASTO" value={fixedName} onChangeText={setFixedName} placeholder="Ej. Internet, renta" />
          <Field label="MONTO MENSUAL" value={fixedAmount} onChangeText={setFixedAmount} keyboardType="decimal-pad" placeholder="0" />
          <Field label="DÍA LÍMITE DE PAGO (1-31)" value={fixedDue} onChangeText={setFixedDue} keyboardType="number-pad" placeholder="Ej. 25" maxLength={2} />
          {Number(fixedAmount.replace(',', '.')) > 0 && <Text style={styles.splitPreview}>Se reparte en {money(quincenaShare(Number(fixedAmount.replace(',', '.')), 1))} y {money(quincenaShare(Number(fixedAmount.replace(',', '.')), 2))} por quincena</Text>}
          <Button label={editingFixed ? 'Guardar cambios' : 'Guardar gasto fijo'} onPress={saveFixed} busy={busy} />
        </>}
        {modal === 'deleteFixed' && <>
          <Text style={[type.body, { marginTop: space.md, lineHeight: 21 }]}>¿Eliminar "{pendingDelete?.name}"? También se borrará su historial de quincenas. Esta acción no se puede deshacer.</Text>
          <Button label="Eliminar" variant="danger" icon="trash-2" onPress={confirmDeleteFixed} busy={busy} />
          <Button label="Cancelar" variant="ghost" onPress={closeModal} style={{ marginTop: space.md }} />
        </>}
        {modal === 'deleteTx' && pendingTx && <>
          <Text style={[type.body, { marginTop: space.md, lineHeight: 21 }]}>
            {pendingTx.kind === 'income' ? 'Ingreso' : 'Gasto'} de {money(Number(pendingTx.amount))} ({pendingTx.note || categories.find(item => item.id === pendingTx.category_id)?.name || 'Sin categoría'}, {pendingTx.occurred_on}).
          </Text>
          <Text style={[type.caption, { marginTop: space.md, lineHeight: 19 }]}>
            Se restará del balance{pendingTx.kind === 'income' && pendingTx.distributes_fixed ? ' y se revertirá el reparto a tus gastos fijos: sus barras de progreso volverán al nivel anterior' : ''}. Esta acción no se puede deshacer.
          </Text>
          <Button label="Eliminar movimiento" variant="danger" icon="trash-2" onPress={deleteTransaction} busy={busy} />
          <Button label="Cancelar" variant="ghost" onPress={closeModal} style={{ marginTop: space.md }} />
        </>}
        {modal === 'deleteGoal' && pendingGoal && <>
          <Text style={[type.body, { marginTop: space.md, lineHeight: 21 }]}>¿Eliminar la meta "{pendingGoal.name}"? Llevas {money(Number(pendingGoal.current_amount))} de {money(Number(pendingGoal.target_amount))}. Se borrará junto con sus aportes. Esta acción no se puede deshacer.</Text>
          <Button label="Eliminar meta" variant="danger" icon="trash-2" onPress={deleteGoal} busy={busy} />
          <Button label="Cancelar" variant="ghost" onPress={closeModal} style={{ marginTop: space.md }} />
        </>}
        {modal === 'goal' && <>
          <Field label="NOMBRE DE LA META" value={goalName} onChangeText={setGoalName} placeholder="Ej. Viaje, fondo de emergencia" />
          <Field label="MONTO OBJETIVO" value={goalTarget} onChangeText={setGoalTarget} keyboardType="decimal-pad" placeholder="0" />
          <Field label="FECHA LÍMITE (AAAA-MM-DD, OPCIONAL)" value={goalDeadline} onChangeText={setGoalDeadline} placeholder="2026-12-31" />
          <Button label={editingGoal ? 'Guardar cambios' : 'Crear meta'} onPress={saveGoal} busy={busy} />
        </>}
        {modal === 'contribution' && <>
          <Text style={[type.body, { marginTop: space.sm }]}>Meta: {selectedGoal?.name}</Text>
          <Field label="MONTO DEL APORTE" value={contribution} onChangeText={setContribution} keyboardType="decimal-pad" placeholder="0" />
          <Button label="Guardar aporte" onPress={saveContribution} busy={busy} />
        </>}
        <ErrorText>{error}</ErrorText>
      </View></ScrollView></View></KeyboardAvoidingView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  balance: { color: colors.ink, fontSize: 44, fontWeight: '200', letterSpacing: -1.5, marginTop: space.md },
  flowRow: { flexDirection: 'row', gap: space.xl, marginTop: space.lg },
  flow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flowText: { color: colors.inkSoft, fontSize: 13, fontWeight: '500' },
  qHeader: { marginBottom: space.md },
  qLabel: { ...type.caption },
  qAvailable: { color: colors.accent, fontSize: 38, fontWeight: '200', letterSpacing: -1.2, marginBottom: space.md },
  qRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  qKey: { ...type.caption, fontSize: 13 },
  qVal: { color: colors.inkSoft, fontSize: 13, fontVariant: ['tabular-nums'] },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.accentGlow },
  noticeText: { color: colors.accent, fontSize: 12, fontWeight: '500', flex: 1 },
  splitBox: { marginTop: space.lg, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  splitPreview: { color: colors.accent, fontSize: 12, marginTop: space.md, lineHeight: 18 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalName: { ...type.heading, flex: 1 },
  goalPercent: { color: colors.accent, fontSize: 18, fontWeight: '300' },
  goalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
  iconRow: { flexDirection: 'row', gap: space.sm },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  contribute: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.accentGlow },
  contributeText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  list: { paddingVertical: 4, paddingHorizontal: space.lg },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  txDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  txIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  txIconIncome: { backgroundColor: colors.accentGlow },
  txCopy: { flex: 1, marginLeft: space.md, gap: 3 },
  txTitle: { color: colors.ink, fontSize: 14 },
  txDelete: { marginLeft: space.md, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  txAmount: { color: colors.inkSoft, fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.night, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong, padding: 22, paddingBottom: 32 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: space.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  segmentRow: { flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: colors.surface, marginTop: space.lg },
  segment: { flex: 1, paddingVertical: 11, borderRadius: radius.sm, alignItems: 'center' },
  segmentSelected: { backgroundColor: colors.accentGlow },
  segmentText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  segmentTextSelected: { color: colors.accent },
});
