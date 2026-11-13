import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  Edit3,
  Eye,
  FilePlus2,
  FileText,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import type { CompanyProfile, Invoice, InvoiceItem } from '../types/billing';
import { formatDateDisplay, formatINR } from '../utils/billingMath';
import { exportInvoicesCSV } from '../utils/csvExport';
import { downloadInvoicePdfOffline, shareInvoiceWhatsApp } from '../utils/pdfGenerator';

interface InvoicesListViewProps {
  company: CompanyProfile;
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  onCreateNew: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  onPreviewInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => Promise<void>;
  onNotify?: (msg: string) => void;
}

type InvoiceFilter = 'all' | 'finalized' | 'draft' | 'due';

export const InvoicesListView: React.FC<InvoicesListViewProps> = ({
  company,
  invoices,
  invoiceItems,
  onCreateNew,
  onEditInvoice,
  onPreviewInvoice,
  onDeleteInvoice,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (filter === 'finalized' && inv.status !== 'finalized') return false;
      if (filter === 'draft' && inv.status !== 'draft') return false;
      if (filter === 'due' && inv.totalOutstanding <= 0.01) return false;

      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerMobile.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, filter]);

  const handleDownload = (inv: Invoice) => {
    const items = invoiceItems.filter((it) => it.invoiceId === inv.id);
    downloadInvoicePdfOffline(company, inv, items, 'both');
    onNotify?.(`Downloaded ${inv.invoiceNumber} PDF offline`);
  };

  const handleShare = async (inv: Invoice) => {
    const items = invoiceItems.filter((it) => it.invoiceId === inv.id);
    await shareInvoiceWhatsApp(company, inv, items);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Invoice History &amp; Reprints
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {invoices.length} saved invoices &amp; drafts · Download PDF or reprint offline anytime
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportInvoicesCSV(invoices)}
            disabled={invoices.length === 0}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-4 w-4" />
            <span>CSV Export</span>
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-xs font-semibold text-white hover:bg-emerald-900"
          >
            <FilePlus2 className="h-4 w-4" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice #, customer name, or mobile..."
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          {(
            [
              ['all', 'All'],
              ['finalized', 'Finalized'],
              ['draft', 'Drafts'],
              ['due', 'Balance Due'],
            ] as [InvoiceFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition whitespace-nowrap ${
                filter === key
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            {invoices.length === 0 ? 'No invoices saved yet' : 'No matching invoices'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            All created invoices and drafts are stored permanently in your device&apos;s local
            database.
          </p>
          {invoices.length === 0 && (
            <button
              type="button"
              onClick={onCreateNew}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-800 px-4 text-xs font-semibold text-white"
            >
              <FilePlus2 className="h-4 w-4" />
              <span>Create First Invoice</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                    <th className="px-4 py-3 font-semibold">Invoice No.</th>
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Taxable</th>
                    <th className="px-3 py-3 text-right font-semibold">GST</th>
                    <th className="px-3 py-3 text-right font-semibold">Grand Total</th>
                    <th className="px-3 py-3 text-right font-semibold">Paid</th>
                    <th className="px-3 py-3 text-right font-semibold">Outstanding</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-600 dark:text-slate-300">
                        {formatDateDisplay(inv.invoiceDate)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {inv.customerName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {inv.customerMobile || inv.placeOfSupply}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`font-semibold ${
                            inv.status === 'draft'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {inv.status === 'draft' ? 'Draft' : 'Finalized'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatINR(inv.subtotalTaxable)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatINR(inv.totalGst)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatINR(inv.grandTotal)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatINR(inv.paymentReceived)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-amber-700 dark:text-amber-400">
                        {formatINR(inv.totalOutstanding)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onPreviewInvoice(inv)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                            title="Preview & Print"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(inv)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            title="Download PDF Offline"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShare(inv)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40"
                            title="Share via WhatsApp"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditInvoice(inv)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            title="Edit Invoice"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(inv)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            title="Delete Invoice"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Touch Cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((inv) => (
              <div
                key={inv.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        {inv.invoiceNumber}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          inv.status === 'draft'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        · {inv.status === 'draft' ? 'Draft' : 'Finalized'}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {inv.customerName}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {formatDateDisplay(inv.invoiceDate)} · GST {formatINR(inv.totalGst)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatINR(inv.grandTotal)}
                    </p>
                    <p className="font-mono text-xs tabular-nums text-amber-700 dark:text-amber-400">
                      Due: {formatINR(inv.totalOutstanding)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => onPreviewInvoice(inv)}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(inv)}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl bg-emerald-800/10 text-xs font-semibold text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditInvoice(inv)}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(inv)}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-rose-200 text-rose-600 dark:border-rose-900 dark:text-rose-400"
                    aria-label={`Delete ${inv.invoiceNumber}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 shrink-0 text-rose-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Invoice {confirmDelete.invoiceNumber}?
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  This will remove the invoice, restore product stock, and recalculate{' '}
                  <strong>{confirmDelete.customerName}</strong>&apos;s outstanding balance.
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
                  await onDeleteInvoice(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="min-h-[44px] rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
