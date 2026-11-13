import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  DatabaseBackup,
  Download,
  FilePlus2,
  FileText,
  IndianRupee,
  Package,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AppRoute,
  BusinessSettings,
  CompanyProfile,
  Customer,
  Invoice,
  InvoiceItem,
  OutstandingBalance,
  PaymentRecord,
  Product,
} from '../types/billing';
import { formatDateDisplay, formatINR } from '../utils/billingMath';
import { downloadInvoicePdfOffline } from '../utils/pdfGenerator';

interface DashboardViewProps {
  company: CompanyProfile;
  settings: BusinessSettings;
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: PaymentRecord[];
  balances: OutstandingBalance[];
  onNavigate: (route: AppRoute) => void;
  onPreviewInvoice: (invoice: Invoice) => void;
  onExportBackup: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  company,
  settings,
  customers,
  products,
  invoices,
  invoiceItems,
  payments,
  balances,
  onNavigate,
  onPreviewInvoice,
  onExportBackup,
}) => {
  const stats = useMemo(() => {
    const finalized = invoices.filter((i) => i.status === 'finalized');
    const drafts = invoices.filter((i) => i.status === 'draft');
    const totalSales = finalized.reduce((s, i) => s + i.grandTotal, 0);
    const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
    const totalOutstanding = balances.reduce(
      (s, b) => s + (b.currentBalance > 0 ? b.currentBalance : 0),
      0
    );

    const now = new Date();
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const expiringProducts = products.filter((p) => {
      if (!p.expiryDate) return false;
      const exp = new Date(p.expiryDate);
      return exp <= ninetyDays;
    });
    const lowStockProducts = products.filter((p) => p.stockQty <= 10);

    return {
      finalizedCount: finalized.length,
      draftCount: drafts.length,
      totalSales,
      totalCollected,
      totalOutstanding,
      expiringCount: expiringProducts.length,
      lowStockCount: lowStockProducts.length,
    };
  }, [invoices, payments, balances, products]);

  const backupOverdue = useMemo(() => {
    if (!settings.lastBackupAt) return true;
    const diffDays =
      (Date.now() - new Date(settings.lastBackupAt).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= (settings.backupReminderDays || 7);
  }, [settings.lastBackupAt, settings.backupReminderDays]);

  const topReceivables = useMemo(() => {
    return [...balances]
      .filter((b) => b.currentBalance > 0.01)
      .sort((a, b) => b.currentBalance - a.currentBalance)
      .slice(0, 5);
  }, [balances]);

  const recentInvoices = useMemo(() => invoices.slice(0, 6), [invoices]);

  const handleQuickDownload = (inv: Invoice) => {
    const items = invoiceItems.filter((it) => it.invoiceId === inv.id);
    downloadInvoicePdfOffline(company, inv, items, 'both');
  };

  return (
    <div className="space-y-6">
      {/* Backup Reminder Banner */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
          backupOverdue
            ? 'border-amber-300 bg-amber-50/90 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
            : 'border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <DatabaseBackup
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              backupOverdue
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          />
          <div>
            <p className="text-sm font-semibold">
              {settings.lastBackupAt
                ? `Last Local Backup: ${new Date(settings.lastBackupAt).toLocaleDateString('en-IN')}`
                : 'Create Your First Offline Backup'}
            </p>
            <p className="mt-0.5 text-xs opacity-85">
              All records are stored locally on this device only. Export a complete backup regularly
              to safeguard data or transfer it to another phone or computer.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-900 transition whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Backup</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
          >
            <span>Manage</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Billed Sales</span>
            <IndianRupee className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-2xl dark:text-white">
            {formatINR(stats.totalSales)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {stats.finalizedCount} finalized · {stats.draftCount} drafts
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Outstanding</span>
            <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold tracking-tight text-amber-700 tabular-nums sm:text-2xl dark:text-amber-400">
            {formatINR(stats.totalOutstanding)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {topReceivables.length} pending party balances
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Payments Collected</span>
            <FileText className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold tracking-tight text-emerald-800 tabular-nums sm:text-2xl dark:text-emerald-400">
            {formatINR(stats.totalCollected)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {payments.length} payment entries
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Catalog &amp; Parties</span>
            <Package className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-2xl dark:text-white">
            {products.length} <span className="text-sm font-medium text-slate-500">Items</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {customers.length} customers · {stats.expiringCount} expiring
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate('new-bill')}
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 active:scale-[0.99] transition"
        >
          <FilePlus2 className="h-5 w-5 shrink-0" />
          <span>New GST Bill</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('customers')}
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99] transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <UserPlus className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <span>Customers</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('products')}
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99] transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <Package className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <span>Products</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('payments')}
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99] transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <Wallet className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Payments</span>
        </button>
      </div>

      {/* Main Content Split: Recent Invoices + Receivables & Expiry Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Invoices */}
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Invoices
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Latest saved bills &amp; drafts stored locally
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('invoices')}
              className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-400"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
              <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                No invoices created yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Create your first offline GST tax invoice for ROYAL KING VET PHARMA.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('new-bill')}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
              >
                <FilePlus2 className="h-4 w-4" />
                <span>Create First Invoice</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                      <span className="font-mono">{inv.invoiceNumber}</span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="truncate font-semibold">{inv.customerName}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono">{formatDateDisplay(inv.invoiceDate)}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          inv.status === 'draft'
                            ? 'font-semibold text-amber-700 dark:text-amber-400'
                            : 'font-semibold text-emerald-700 dark:text-emerald-400'
                        }
                      >
                        {inv.status === 'draft' ? 'Draft' : 'Finalized'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatINR(inv.grandTotal)}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                        Bal: {formatINR(inv.totalOutstanding)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPreviewInvoice(inv)}
                      className="min-h-[40px] rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDownload(inv)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-800/10 text-emerald-900 hover:bg-emerald-800/20 dark:bg-emerald-500/15 dark:text-emerald-300"
                      title="Download PDF Offline"
                      aria-label={`Download PDF for ${inv.invoiceNumber}`}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Top Outstanding & Vet Inventory Alerts */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Pending Customer Balances
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('payments')}
                className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-400"
              >
                Settle Dues
              </button>
            </div>
            {topReceivables.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No pending customer receivables right now.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {topReceivables.map((bal) => (
                  <div
                    key={bal.customerId}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {bal.customerName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Billed {formatINR(bal.totalInvoiced)} · Paid {formatINR(bal.totalPaid)}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-bold text-amber-700 tabular-nums dark:text-amber-400">
                      {formatINR(bal.currentBalance)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(stats.expiringCount > 0 || stats.lowStockCount > 0) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Inventory Attention Needed
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('products')}
                  className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-400"
                >
                  Inspect Stock
                </button>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {stats.expiringCount > 0 && (
                  <p>
                    <strong className="font-mono text-amber-700 dark:text-amber-400">
                      {stats.expiringCount}
                    </strong>{' '}
                    product batch(es) expiring within 90 days or expired.
                  </p>
                )}
                {stats.lowStockCount > 0 && (
                  <p>
                    <strong className="font-mono text-rose-700 dark:text-rose-400">
                      {stats.lowStockCount}
                    </strong>{' '}
                    product(s) at low stock (&le; 10 units).
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
