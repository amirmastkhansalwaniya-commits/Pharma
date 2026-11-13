import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  FilePlus2,
  FileText,
  Home,
  Lock,
  Package,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { BrandCrest } from './components/BrandMark';
import { InvoicePreviewModal } from './components/InvoicePreviewModal';
import { PinLockScreen } from './components/PinLockScreen';
import {
  ConnectivityStatusText,
  OfflineBanner,
  PWAInstallButton,
} from './components/PWAControls';
import {
  clearAllBusinessData,
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_COMPANY_PROFILE,
  DEFAULT_INVOICE_SEQUENCE,
  deleteCustomerAtomic,
  deleteInvoiceAtomic,
  deletePaymentAtomic,
  deleteProduct,
  exportCompleteBackup,
  loadAllData,
  recordPaymentAtomic,
  requestPersistentStorage,
  saveBusinessSettings,
  saveCompanyProfile,
  saveCustomerAtomic,
  saveInvoiceAtomic,
  saveProduct,
  seedSampleVetPharmaProducts,
} from './db/indexedDb';
import type {
  AppRoute,
  BusinessSettings,
  CompanyProfile,
  Customer,
  Invoice,
  InvoiceItem,
  InvoiceNumberSequence,
  OutstandingBalance,
  PaymentRecord,
  Product,
} from './types/billing';
import { todayISO } from './utils/billingMath';
import { downloadJSONBackup } from './utils/csvExport';
import { CustomersView } from './views/CustomersView';
import { DashboardView } from './views/DashboardView';
import { InvoiceBuilderView } from './views/InvoiceBuilderView';
import { InvoicesListView } from './views/InvoicesListView';
import { PaymentsView } from './views/PaymentsView';
import { ProductsView } from './views/ProductsView';
import { SettingsBackupView } from './views/SettingsBackupView';

const ROUTE_TITLES: Record<AppRoute, string> = {
  home: 'Dashboard',
  'new-bill': 'New Tax Invoice',
  invoices: 'Invoices',
  customers: 'Customers',
  products: 'Products & Stock',
  payments: 'Payments & Ledger',
  settings: 'Backup & Settings',
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState('');
  const [route, setRoute] = useState<AppRoute>('home');

  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_COMPANY_PROFILE);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [sequence, setSequence] = useState<InvoiceNumberSequence>(DEFAULT_INVOICE_SEQUENCE);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [balances, setBalances] = useState<OutstandingBalance[]>([]);

  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [preselectedCustomerForBill, setPreselectedCustomerForBill] = useState<string | null>(
    null
  );
  const [preselectedCustomerForPay, setPreselectedCustomerForPay] = useState<string | null>(
    null
  );
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  const [isLocked, setIsLocked] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg('');
    }, 3500);
  }, []);

  const refreshAll = useCallback(async () => {
    const data = await loadAllData();
    setCompany(data.companyProfile);
    setSettings(data.businessSettings);
    setSequence(data.invoiceSequence);
    setCustomers(data.customers);
    setProducts(data.products);
    setInvoices(data.invoices);
    setInvoiceItems(data.invoiceItems);
    setPayments(data.payments);
    setBalances(data.outstandingBalances);
    return data;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await requestPersistentStorage();
        const data = await refreshAll();
        if (mounted && data.businessSettings.pinEnabled && data.businessSettings.pinHash) {
          setIsLocked(true);
        }
      } catch (err) {
        if (mounted) {
          setDbError((err as Error).message || 'Failed to initialize local database.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const onOfflineReady = () => notify('App cached for full offline use');
    window.addEventListener('rkvp-offline-ready', onOfflineReady);
    return () => {
      mounted = false;
      window.removeEventListener('rkvp-offline-ready', onOfflineReady);
    };
  }, [refreshAll, notify]);

  // Sync light/dark theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Auto-lock after inactivity when PIN is enabled
  useEffect(() => {
    if (!settings.pinEnabled || !settings.pinHash || settings.autoLockMinutes <= 0 || isLocked) {
      return;
    }

    let timer: number;
    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setIsLocked(true);
      }, settings.autoLockMinutes * 60 * 1000);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [settings.pinEnabled, settings.pinHash, settings.autoLockMinutes, isLocked]);

  const handleSaveCompany = async (profile: CompanyProfile) => {
    await saveCompanyProfile(profile);
    await refreshAll();
  };

  const handleSaveSettings = async (
    nextSettings: BusinessSettings,
    nextSeq: InvoiceNumberSequence
  ) => {
    await saveBusinessSettings(nextSettings, nextSeq);
    await refreshAll();
  };

  const handleSaveCustomer = async (customer: Customer) => {
    await saveCustomerAtomic(customer);
    await refreshAll();
    notify(`Customer "${customer.name}" saved`);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    await deleteCustomerAtomic(customerId);
    await refreshAll();
    notify('Customer deleted');
  };

  const handleSaveProduct = async (product: Product) => {
    await saveProduct(product);
    await refreshAll();
    notify(`Product "${product.name}" saved`);
  };

  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId);
    await refreshAll();
    notify('Product deleted');
  };

  const handleSeedProducts = async () => {
    const count = await seedSampleVetPharmaProducts();
    await refreshAll();
    notify(`Loaded ${count} sample veterinary pharma products`);
  };

  const handleSaveInvoice = async (invoice: Invoice, items: InvoiceItem[]) => {
    const saved = await saveInvoiceAtomic(invoice, items);
    await refreshAll();
    notify(
      saved.status === 'draft'
        ? `Draft ${saved.invoiceNumber} saved offline`
        : `Invoice ${saved.invoiceNumber} generated & saved`
    );
    return saved;
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    await deleteInvoiceAtomic(invoiceId);
    await refreshAll();
    notify('Invoice deleted & balance updated');
  };

  const handleRecordPayment = async (payment: PaymentRecord) => {
    await recordPaymentAtomic(payment);
    await refreshAll();
    notify('Payment recorded & balance updated');
  };

  const handleDeletePayment = async (paymentId: string) => {
    await deletePaymentAtomic(paymentId);
    await refreshAll();
    notify('Payment entry removed');
  };

  const handleExportCompleteBackup = async () => {
    const payload = await exportCompleteBackup();
    downloadJSONBackup(payload, `RKVP-Complete-Backup-${todayISO()}.json`);
    await refreshAll();
    notify('Complete JSON backup downloaded');
  };

  const handleClearAllData = async () => {
    await clearAllBusinessData();
    await refreshAll();
    setEditingInvoice(null);
    setPreviewInvoice(null);
    setIsLocked(false);
  };

  const navigateTo = (target: AppRoute) => {
    if (target !== 'new-bill') {
      setEditingInvoice(null);
      setPreselectedCustomerForBill(null);
    }
    setRoute(target);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <BrandCrest className="h-14 w-14" />
        <h1 className="mt-4 text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
          ROYAL KING VET PHARMA
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Opening local offline database...
        </p>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
        <BrandCrest className="h-12 w-12" />
        <h1 className="mt-4 text-lg font-bold text-rose-700 dark:text-rose-400">
          Local Database Error
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">{dbError}</p>
      </div>
    );
  }

  const desktopNavItems: { key: AppRoute; label: string; icon: React.FC<{ className?: string }> }[] =
    [
      { key: 'home', label: 'Dashboard', icon: Home },
      { key: 'new-bill', label: 'New Bill', icon: FilePlus2 },
      { key: 'invoices', label: 'Invoices', icon: FileText },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'products', label: 'Products', icon: Package },
      { key: 'payments', label: 'Payments & Ledger', icon: Wallet },
      { key: 'settings', label: 'Backup & Settings', icon: Settings },
    ];

  const mobileBottomTabs: { key: AppRoute; label: string; icon: React.FC<{ className?: string }> }[] =
    [
      { key: 'home', label: 'Home', icon: Home },
      { key: 'new-bill', label: 'New Bill', icon: FilePlus2 },
      { key: 'invoices', label: 'Invoices', icon: FileText },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'settings', label: 'Settings', icon: Settings },
    ];

  const editingItems = editingInvoice
    ? invoiceItems.filter((it) => it.invoiceId === editingInvoice.id)
    : undefined;

  const previewItems = previewInvoice
    ? invoiceItems.filter((it) => it.invoiceId === previewInvoice.id)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* PIN Lock Screen Overlay */}
      {isLocked && settings.pinEnabled && settings.pinHash && (
        <PinLockScreen storedHash={settings.pinHash} onUnlock={() => setIsLocked(false)} />
      )}

      <div className="flex min-h-screen">
        {/* Desktop Sidebar Navigation */}
        <aside className="no-print hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <BrandCrest className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                  ROYAL KING
                </p>
                <p className="truncate text-[11px] font-bold tracking-wider text-emerald-800 dark:text-emerald-400">
                  VET PHARMA
                </p>
              </div>
            </div>

            <nav className="space-y-1 p-3" aria-label="Main navigation">
              {desktopNavItems.map((item) => {
                const Icon = item.icon;
                const active = route === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigateTo(item.key)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition whitespace-nowrap ${
                      active
                        ? 'bg-emerald-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-2.5 border-t border-slate-200 p-4 dark:border-slate-800">
            <PWAInstallButton variant="sidebar" />
            {settings.pinEnabled && (
              <button
                type="button"
                onClick={() => setIsLocked(true)}
                className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Lock Application</span>
              </button>
            )}
          </div>
        </aside>

        {/* Main Viewport Column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Offline Banner */}
          <OfflineBanner />

          {/* Desktop Top Header */}
          <header className="no-print hidden items-center justify-between gap-8 border-b border-slate-200 bg-white px-6 py-3.5 lg:flex dark:border-slate-800 dark:bg-slate-900">
            <h1 className="text-base font-bold text-slate-900 whitespace-nowrap shrink-0 dark:text-white">
              {ROUTE_TITLES[route]}
            </h1>

            <div className="flex items-center gap-6">
              <ConnectivityStatusText />
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingInvoice(null);
                  setPreselectedCustomerForBill(null);
                  setRoute('new-bill');
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 whitespace-nowrap shrink-0"
              >
                <FilePlus2 className="h-4 w-4" />
                <span>New Invoice</span>
              </button>
            </div>
          </header>

          {/* Mobile Sticky App Bar (52px compact height) */}
          <header className="no-print sticky top-0 z-30 flex h-[52px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3.5 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex min-w-0 items-center gap-2.5">
              <BrandCrest className="h-8 w-8 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-xs font-extrabold tracking-tight text-slate-900 dark:text-white">
                  ROYAL KING VET PHARMA
                </p>
                <p className="truncate text-[10px] font-semibold text-emerald-800 dark:text-emerald-400">
                  {ROUTE_TITLES[route]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <PWAInstallButton variant="compact" />
              {settings.pinEnabled && (
                <button
                  type="button"
                  onClick={() => setIsLocked(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  aria-label="Lock App"
                >
                  <Lock className="h-4 w-4" />
                </button>
              )}
            </div>
          </header>

          {/* Page Content */}
          <main className="no-print flex-1 p-4 pb-24 sm:p-6 lg:pb-8">
            <div className="mx-auto max-w-7xl">
              {route === 'home' && (
                <DashboardView
                  company={company}
                  settings={settings}
                  customers={customers}
                  products={products}
                  invoices={invoices}
                  invoiceItems={invoiceItems}
                  payments={payments}
                  balances={balances}
                  onNavigate={navigateTo}
                  onPreviewInvoice={(inv) => setPreviewInvoice(inv)}
                  onExportBackup={handleExportCompleteBackup}
                />
              )}

              {route === 'new-bill' && (
                <InvoiceBuilderView
                  key={editingInvoice?.id || `new-${preselectedCustomerForBill || 'none'}`}
                  company={company}
                  settings={settings}
                  sequence={sequence}
                  customers={customers}
                  products={products}
                  balances={balances}
                  editingInvoice={editingInvoice}
                  editingItems={editingItems}
                  preselectedCustomerId={preselectedCustomerForBill}
                  onSaveInvoice={handleSaveInvoice}
                  onQuickSaveCustomer={handleSaveCustomer}
                  onCancelEdit={() => {
                    setEditingInvoice(null);
                    setRoute('invoices');
                  }}
                  onSavedAndPreview={(saved) => {
                    setEditingInvoice(null);
                    setPreselectedCustomerForBill(null);
                    setPreviewInvoice(saved);
                    setRoute('invoices');
                  }}
                />
              )}

              {route === 'invoices' && (
                <InvoicesListView
                  company={company}
                  invoices={invoices}
                  invoiceItems={invoiceItems}
                  onCreateNew={() => {
                    setEditingInvoice(null);
                    setPreselectedCustomerForBill(null);
                    setRoute('new-bill');
                  }}
                  onEditInvoice={(inv) => {
                    setEditingInvoice(inv);
                    setRoute('new-bill');
                  }}
                  onPreviewInvoice={(inv) => setPreviewInvoice(inv)}
                  onDeleteInvoice={handleDeleteInvoice}
                  onNotify={notify}
                />
              )}

              {route === 'customers' && (
                <CustomersView
                  company={company}
                  customers={customers}
                  balances={balances}
                  invoices={invoices}
                  invoiceItems={invoiceItems}
                  payments={payments}
                  onSaveCustomer={handleSaveCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                  onCreateInvoiceForCustomer={(custId) => {
                    setEditingInvoice(null);
                    setPreselectedCustomerForBill(custId);
                    setRoute('new-bill');
                  }}
                  onPreviewInvoice={(inv) => setPreviewInvoice(inv)}
                  onQuickRecordPayment={(custId) => {
                    setPreselectedCustomerForPay(custId);
                    setRoute('payments');
                  }}
                />
              )}

              {route === 'products' && (
                <ProductsView
                  products={products}
                  onSaveProduct={handleSaveProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onSeedSampleProducts={handleSeedProducts}
                />
              )}

              {route === 'payments' && (
                <PaymentsView
                  customers={customers}
                  invoices={invoices}
                  payments={payments}
                  balances={balances}
                  preselectedCustomerId={preselectedCustomerForPay}
                  onClearPreselectedCustomer={() => setPreselectedCustomerForPay(null)}
                  onRecordPayment={handleRecordPayment}
                  onDeletePayment={handleDeletePayment}
                />
              )}

              {route === 'settings' && (
                <SettingsBackupView
                  company={company}
                  settings={settings}
                  sequence={sequence}
                  customers={customers}
                  products={products}
                  invoices={invoices}
                  payments={payments}
                  balances={balances}
                  onSaveCompany={handleSaveCompany}
                  onSaveSettings={handleSaveSettings}
                  onExportCompleteBackup={handleExportCompleteBackup}
                  onReloadAllData={async () => {
                    await refreshAll();
                  }}
                  onClearAllData={handleClearAllData}
                  onLockNow={() => setIsLocked(true)}
                  onNotify={notify}
                />
              )}
            </div>
          </main>

          {/* Mobile Fixed Bottom Navigation (Home, New Bill, Invoices, Customers, Settings) */}
          <nav
            aria-label="Mobile bottom navigation"
            className="no-print pb-safe fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-5 items-center border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
          >
            {mobileBottomTabs.map((tab) => {
              const Icon = tab.icon;
              const active = route === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => navigateTo(tab.key)}
                  className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition ${
                    active
                      ? 'text-emerald-800 dark:text-emerald-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-semibold tracking-tight">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Invoice A4 Print / PDF Preview Modal */}
      {previewInvoice && (
        <InvoicePreviewModal
          company={company}
          invoice={previewInvoice}
          items={previewItems}
          onClose={() => setPreviewInvoice(null)}
          onNotify={notify}
        />
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className="no-print fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl lg:bottom-5 dark:bg-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 dark:text-white" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
