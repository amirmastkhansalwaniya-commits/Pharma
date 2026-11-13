import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  Edit3,
  FilePlus2,
  FileText,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  CompanyProfile,
  Customer,
  Invoice,
  InvoiceItem,
  OutstandingBalance,
  PaymentRecord,
} from '../types/billing';
import { formatDateDisplay, formatINR } from '../utils/billingMath';
import { exportCustomersCSV } from '../utils/csvExport';
import { INDIAN_STATES } from '../utils/indianStates';
import { downloadInvoicePdfOffline } from '../utils/pdfGenerator';
import { generateId } from '../utils/security';

interface CustomersViewProps {
  company: CompanyProfile;
  customers: Customer[];
  balances: OutstandingBalance[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: PaymentRecord[];
  onSaveCustomer: (customer: Customer) => Promise<void>;
  onDeleteCustomer: (customerId: string) => Promise<void>;
  onCreateInvoiceForCustomer: (customerId: string) => void;
  onPreviewInvoice: (invoice: Invoice) => void;
  onQuickRecordPayment: (customerId: string) => void;
}

const emptyCustomerForm = (): Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  mobile: '',
  email: '',
  address: '',
  shippingAddress: '',
  pincode: '',
  state: 'Maharashtra',
  stateCode: '27',
  gstin: '',
  openingBalance: 0,
});

export const CustomersView: React.FC<CustomersViewProps> = ({
  company,
  customers,
  balances,
  invoices,
  invoiceItems,
  payments,
  onSaveCustomer,
  onDeleteCustomer,
  onCreateInvoiceForCustomer,
  onPreviewInvoice,
  onQuickRecordPayment,
}) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomerForm());
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);

  const balancesMap = useMemo(() => {
    const map = new Map<string, OutstandingBalance>();
    balances.forEach((b) => map.set(b.customerId, b));
    return map;
  }, [balances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q) ||
        c.gstin.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyCustomerForm());
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      mobile: c.mobile,
      email: c.email,
      address: c.address,
      shippingAddress: c.shippingAddress,
      pincode: c.pincode || '',
      state: c.state,
      stateCode: c.stateCode,
      gstin: c.gstin,
      openingBalance: c.openingBalance,
    });
    setShowModal(true);
  };

  const handleStateChange = (code: string) => {
    const found = INDIAN_STATES.find((s) => s.code === code);
    setForm((prev) => ({
      ...prev,
      stateCode: code,
      state: found?.name || prev.state,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const customer: Customer = {
        id: editing?.id || generateId('cust'),
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        shippingAddress: form.shippingAddress.trim() || form.address.trim(),
        pincode: (form.pincode || '').trim(),
        state: form.state,
        stateCode: form.stateCode,
        gstin: form.gstin.trim().toUpperCase(),
        openingBalance: Number(form.openingBalance) || 0,
        createdAt: editing?.createdAt || now,
        updatedAt: now,
      };
      await onSaveCustomer(customer);
      if (selectedCustomer?.id === customer.id) {
        setSelectedCustomer(customer);
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const selectedCustomerDetails = useMemo(() => {
    if (!selectedCustomer) return null;
    const bal = balancesMap.get(selectedCustomer.id);
    const custInvoices = invoices.filter((i) => i.customerId === selectedCustomer.id);
    const custPayments = payments.filter((p) => p.customerId === selectedCustomer.id);
    return {
      balance: bal,
      invoices: custInvoices,
      payments: custPayments,
    };
  }, [selectedCustomer, balancesMap, invoices, payments]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Customers &amp; Party Directory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {customers.length} veterinary dealers, clinics &amp; farm accounts saved locally
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportCustomersCSV(customers, balancesMap)}
            disabled={customers.length === 0}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-4 w-4" />
            <span>CSV Export</span>
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Customer</span>
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
          placeholder="Search customer by name, mobile, or GSTIN..."
          className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            {customers.length === 0 ? 'No customers added yet' : 'No matching customers found'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Add veterinary medical stores, dairy farms, or clinics to track invoices and balances.
          </p>
          {customers.length === 0 && (
            <button
              type="button"
              onClick={openAdd}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
            >
              <Plus className="h-4 w-4" />
              <span>Add First Customer</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Customer List */}
          <div
            className={`${
              selectedCustomer ? 'lg:col-span-7' : 'lg:col-span-12'
            } overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900`}
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((c) => {
                const bal = balancesMap.get(c.id);
                const outstanding = bal?.currentBalance ?? c.openingBalance;
                const isSelected = selectedCustomer?.id === c.id;

                return (
                  <div
                    key={c.id}
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(c)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {c.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3" />
                          {c.mobile || 'No mobile'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {c.state} ({c.stateCode})
                        </span>
                        {c.gstin && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">GSTIN: {c.gstin}</span>
                          </>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Outstanding</p>
                        <p
                          className={`font-mono text-sm font-bold tabular-nums ${
                            outstanding > 0
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {formatINR(outstanding)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        title="Edit customer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(c)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        title="Delete customer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer Ledger & History Panel */}
          {selectedCustomer && selectedCustomerDetails && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedCustomer.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {selectedCustomer.address || 'No address saved'}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {selectedCustomer.mobile || '-'} · GSTIN:{' '}
                    {selectedCustomer.gstin || 'Unregistered'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Close customer details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Balance Breakdown */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-slate-500 dark:text-slate-400">Total Billed</p>
                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatINR(selectedCustomerDetails.balance?.totalInvoiced ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-slate-500 dark:text-slate-400">Total Paid</p>
                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatINR(selectedCustomerDetails.balance?.totalPaid ?? 0)}
                  </p>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                  <span className="font-semibold text-amber-950 dark:text-amber-100">
                    Current Outstanding Balance
                  </span>
                  <span className="font-mono text-base font-bold tabular-nums text-amber-800 dark:text-amber-300">
                    {formatINR(
                      selectedCustomerDetails.balance?.currentBalance ??
                        selectedCustomer.openingBalance
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onCreateInvoiceForCustomer(selectedCustomer.id)}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-white hover:bg-emerald-900"
                >
                  <FilePlus2 className="h-4 w-4" />
                  <span>New Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickRecordPayment(selectedCustomer.id)}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <Wallet className="h-4 w-4 text-amber-600" />
                  <span>Receive Payment</span>
                </button>
              </div>

              {/* Customer Invoice History */}
              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Invoice History ({selectedCustomerDetails.invoices.length})
                </h4>
                {selectedCustomerDetails.invoices.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">No invoices for this customer.</p>
                ) : (
                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                    {selectedCustomerDetails.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-xs dark:border-slate-800"
                      >
                        <div>
                          <p className="font-mono font-bold text-slate-900 dark:text-white">
                            {inv.invoiceNumber}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatDateDisplay(inv.invoiceDate)} · {inv.status}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                            {formatINR(inv.grandTotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onPreviewInvoice(inv)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50 dark:border-slate-700"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadInvoicePdfOffline(
                                company,
                                inv,
                                invoiceItems.filter((it) => it.invoiceId === inv.id),
                                'both'
                              )
                            }
                            className="rounded-lg bg-emerald-800/10 p-1.5 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                            title="Download PDF"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Payment History */}
              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Payment History ({selectedCustomerDetails.payments.length})
                </h4>
                {selectedCustomerDetails.payments.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">No payments recorded yet.</p>
                ) : (
                  <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                    {selectedCustomerDetails.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-xs dark:border-slate-800"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {p.paymentMode} {p.invoiceNumber ? `· ${p.invoiceNumber}` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatDateDisplay(p.paymentDate)}
                            {p.referenceNumber ? ` · Ref: ${p.referenceNumber}` : ''}
                          </p>
                        </div>
                        <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                          +{formatINR(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Customer / Veterinary Clinic / Firm Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Shri Ganesh Vet Medical & Agro Agency"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    placeholder="10-digit mobile"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    placeholder="e.g., 27AABCU9603R1ZM"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Billing Address
                </label>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Shop / Village / Taluka / District"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Shipping Address (Leave blank if same as billing)
                </label>
                <input
                  type="text"
                  value={form.shippingAddress}
                  onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                  placeholder="Optional separate delivery address"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    State / Place of Supply
                  </label>
                  <select
                    value={form.stateCode}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Party Pincode
                  </label>
                  <input
                    type="text"
                    value={form.pincode || ''}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    placeholder="e.g., 132046"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Opening Balance (INR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.openingBalance}
                    onChange={(e) =>
                      setForm({ ...form, openingBalance: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 shrink-0 text-rose-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Customer?
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Deleting <strong>{confirmDelete.name}</strong> will also remove their{' '}
                  {invoices.filter((i) => i.customerId === confirmDelete.id).length} invoice(s) and{' '}
                  {payments.filter((p) => p.customerId === confirmDelete.id).length} payment(s) from
                  this device. Export a backup first if you need to keep these records.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteCustomer(confirmDelete.id);
                  if (selectedCustomer?.id === confirmDelete.id) {
                    setSelectedCustomer(null);
                  }
                  setConfirmDelete(null);
                }}
                className="min-h-[44px] rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
