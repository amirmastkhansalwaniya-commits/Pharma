import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Customer,
  Invoice,
  OutstandingBalance,
  PaymentMode,
  PaymentRecord,
} from '../types/billing';
import { formatDateDisplay, formatINR, round2, todayISO } from '../utils/billingMath';
import { exportPaymentsCSV } from '../utils/csvExport';
import { generateId } from '../utils/security';

interface PaymentsViewProps {
  customers: Customer[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  balances: OutstandingBalance[];
  preselectedCustomerId?: string | null;
  onClearPreselectedCustomer?: () => void;
  onRecordPayment: (payment: PaymentRecord) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
}

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  customers,
  invoices,
  payments,
  balances,
  preselectedCustomerId,
  onClearPreselectedCustomer,
  onRecordPayment,
  onDeletePayment,
}) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(todayISO());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PaymentRecord | null>(null);

  const balancesMap = useMemo(() => {
    const map = new Map<string, OutstandingBalance>();
    balances.forEach((b) => map.set(b.customerId, b));
    return map;
  }, [balances]);

  // Open modal automatically if navigated via "Receive Payment" on a customer
  useEffect(() => {
    if (preselectedCustomerId) {
      const bal = balancesMap.get(preselectedCustomerId);
      setSelectedCustId(preselectedCustomerId);
      setSelectedInvoiceId('');
      setAmount(bal && bal.currentBalance > 0 ? round2(bal.currentBalance) : 0);
      setPaymentDate(todayISO());
      setShowModal(true);
      onClearPreselectedCustomer?.();
    }
  }, [preselectedCustomerId, balancesMap, onClearPreselectedCustomer]);

  const customerOutstandingRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .map((c) => {
        const b = balancesMap.get(c.id);
        return {
          customer: c,
          openingBalance: b?.openingBalance ?? c.openingBalance,
          totalInvoiced: b?.totalInvoiced ?? 0,
          totalPaid: b?.totalPaid ?? 0,
          currentBalance: b?.currentBalance ?? c.openingBalance,
        };
      })
      .filter((r) => {
        if (!q) return true;
        return (
          r.customer.name.toLowerCase().includes(q) ||
          r.customer.mobile.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.currentBalance - a.currentBalance);
  }, [customers, balancesMap, search]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        p.customerName.toLowerCase().includes(q) ||
        (p.invoiceNumber || '').toLowerCase().includes(q) ||
        p.referenceNumber.toLowerCase().includes(q)
    );
  }, [payments, search]);

  const customerInvoices = useMemo(
    () =>
      invoices.filter(
        (i) => i.customerId === selectedCustId && i.status === 'finalized'
      ),
    [invoices, selectedCustId]
  );

  const openPaymentModal = (custId?: string) => {
    const cid = custId || customers[0]?.id || '';
    const bal = cid ? balancesMap.get(cid) : undefined;
    setSelectedCustId(cid);
    setSelectedInvoiceId('');
    setAmount(bal && bal.currentBalance > 0 ? round2(bal.currentBalance) : 0);
    setPaymentDate(todayISO());
    setPaymentMode('Cash');
    setReferenceNumber('');
    setNotes('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustId || amount <= 0) return;
    const cust = customers.find((c) => c.id === selectedCustId);
    const inv = invoices.find((i) => i.id === selectedInvoiceId);
    if (!cust) return;

    setSaving(true);
    try {
      const record: PaymentRecord = {
        id: generateId('pay'),
        customerId: cust.id,
        customerName: cust.name,
        invoiceId: inv?.id,
        invoiceNumber: inv?.invoiceNumber,
        amount: round2(amount),
        paymentDate,
        paymentMode,
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim(),
        type: 'settlement',
        createdAt: new Date().toISOString(),
      };
      await onRecordPayment(record);
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const selectedBalance = selectedCustId
    ? balancesMap.get(selectedCustId)?.currentBalance ?? 0
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Outstanding Balances &amp; Payments
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track partial/full payments with automatic ledger updates and zero double counting
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportPaymentsCSV(payments)}
            disabled={payments.length === 0}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-4 w-4" />
            <span>Export Payment History</span>
          </button>
          <button
            type="button"
            disabled={customers.length === 0}
            onClick={() => openPaymentModal()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer, invoice #, or payment reference..."
          className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
      </div>

      {/* Customer-wise Outstanding Balances */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Customer-Wise Outstanding Ledger
          </h3>
        </div>

        {customerOutstandingRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No customers available. Add customers first to track balances.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <th className="px-4 py-3 font-semibold">Customer Name</th>
                  <th className="px-3 py-3 text-right font-semibold">Opening</th>
                  <th className="px-3 py-3 text-right font-semibold">Total Billed</th>
                  <th className="px-3 py-3 text-right font-semibold">Total Paid</th>
                  <th className="px-3 py-3 text-right font-semibold">Remaining Balance</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customerOutstandingRows.map((row) => (
                  <tr
                    key={row.customer.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {row.customer.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {row.customer.mobile || '-'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {formatINR(row.openingBalance)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatINR(row.totalInvoiced)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatINR(row.totalPaid)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-mono font-bold tabular-nums ${
                        row.currentBalance > 0
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {formatINR(row.currentBalance)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openPaymentModal(row.customer.id)}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-emerald-800/10 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-800/20 dark:bg-emerald-500/15 dark:text-emerald-300"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        <span>Receive</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment History Table */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Payment History ({filteredPayments.length})
          </h3>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No payment entries recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPayments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">{p.customerName}</p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    <span className="font-mono">{formatDateDisplay(p.paymentDate)}</span> ·{' '}
                    {p.paymentMode}
                    {p.invoiceNumber ? ` · Inv: ${p.invoiceNumber}` : ' · Ledger Settlement'}
                    {p.referenceNumber ? ` · Ref: ${p.referenceNumber}` : ''}
                  </p>
                  {p.notes && <p className="mt-0.5 text-[11px] text-slate-400">{p.notes}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    +{formatINR(p.amount)}
                  </span>
                  {p.type === 'settlement' ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(p)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      title="Delete payment entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400" title="Linked to Invoice">
                      Invoice
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Record Customer Payment
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer *
                </label>
                <select
                  required
                  value={selectedCustId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setSelectedCustId(cid);
                    setSelectedInvoiceId('');
                    const bal = balancesMap.get(cid);
                    setAmount(bal && bal.currentBalance > 0 ? round2(bal.currentBalance) : 0);
                  }}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {selectedCustId && (
                  <p className="mt-1 text-xs text-slate-500">
                    Current Outstanding:{' '}
                    <strong className="font-mono text-amber-700 dark:text-amber-400">
                      {formatINR(selectedBalance)}
                    </strong>
                  </p>
                )}
              </div>

              {customerInvoices.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Against Invoice (Optional)
                  </label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">-- General Account Settlement --</option>
                    {customerInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} ({formatDateDisplay(inv.invoiceDate)}) -{' '}
                        {formatINR(inv.grandTotal)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Amount Received (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    UTR / Cheque / Ref #
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Optional"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Partial payment / full settlement note"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs dark:bg-slate-800/60">
                Remaining Balance After Payment:{' '}
                <strong className="font-mono text-emerald-800 dark:text-emerald-400">
                  {formatINR(round2(selectedBalance - (Number(amount) || 0)))}
                </strong>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || amount <= 0}
                  className="min-h-[44px] rounded-xl bg-emerald-800 px-5 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Payment Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 shrink-0 text-rose-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Payment Entry?
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Removing this {formatINR(confirmDelete.amount)} payment will automatically
                  recalculate <strong>{confirmDelete.customerName}</strong>&apos;s outstanding
                  balance.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeletePayment(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="min-h-[44px] rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
