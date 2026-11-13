import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Database,
  Download,
  FileSpreadsheet,
  HardDrive,
  Lock,
  Moon,
  Save,
  Shield,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { PWAInstallButton } from '../components/PWAControls';
import {
  getStorageDiagnostics,
  importCompleteBackup,
  type StorageDiagnostics,
  validateBackupJSON,
} from '../db/indexedDb';
import type {
  BusinessSettings,
  CompanyProfile,
  CompleteBackupPayload,
  Customer,
  Invoice,
  InvoiceNumberSequence,
  OutstandingBalance,
  PaymentRecord,
  Product,
} from '../types/billing';
import {
  exportCustomersCSV,
  exportInvoicesCSV,
  exportPaymentsCSV,
  exportProductsCSV,
} from '../utils/csvExport';
import { GST_RATES, INDIAN_STATES } from '../utils/indianStates';
import { hashPin } from '../utils/security';

interface SettingsBackupViewProps {
  company: CompanyProfile;
  settings: BusinessSettings;
  sequence: InvoiceNumberSequence;
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  balances: OutstandingBalance[];
  onSaveCompany: (profile: CompanyProfile) => Promise<void>;
  onSaveSettings: (
    settings: BusinessSettings,
    sequence: InvoiceNumberSequence
  ) => Promise<void>;
  onExportCompleteBackup: () => Promise<void>;
  onReloadAllData: () => Promise<void>;
  onClearAllData: () => Promise<void>;
  onLockNow: () => void;
  onNotify: (msg: string) => void;
}

export const SettingsBackupView: React.FC<SettingsBackupViewProps> = ({
  company,
  settings,
  sequence,
  customers,
  products,
  invoices,
  payments,
  balances,
  onSaveCompany,
  onSaveSettings,
  onExportCompleteBackup,
  onReloadAllData,
  onClearAllData,
  onLockNow,
  onNotify,
}) => {
  const [companyForm, setCompanyForm] = useState<CompanyProfile>(company);
  const [settingsForm, setSettingsForm] = useState<BusinessSettings>(settings);
  const [seqForm, setSeqForm] = useState<InvoiceNumberSequence>(sequence);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // PIN Setup
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Storage Diagnostics
  const [storageDiag, setStorageDiag] = useState<StorageDiagnostics | null>(null);

  // Import Backup flow
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<{
    payload: CompleteBackupPayload;
    summary: {
      exportedAt: string;
      customersCount: number;
      productsCount: number;
      invoicesCount: number;
      paymentsCount: number;
    };
  } | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  // Clear Local Data confirmation
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  useEffect(() => {
    setCompanyForm(company);
  }, [company]);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  useEffect(() => {
    setSeqForm(sequence);
  }, [sequence]);

  useEffect(() => {
    getStorageDiagnostics().then(setStorageDiag);
  }, [invoices.length, customers.length, products.length]);

  const balancesMap = useMemo(() => {
    const map = new Map<string, OutstandingBalance>();
    balances.forEach((b) => map.set(b.customerId, b));
    return map;
  }, [balances]);

  const handleSaveCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      await onSaveCompany(companyForm);
      onNotify('Company profile saved locally');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await onSaveSettings(settingsForm, {
        ...seqForm,
        prefix: settingsForm.invoicePrefix,
      });
      onNotify('Business settings & invoice numbering updated');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError('PIN must be 4 to 6 digits (numbers only).');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PIN and Confirm PIN do not match.');
      return;
    }
    const hashed = await hashPin(newPin);
    const updated: BusinessSettings = {
      ...settingsForm,
      pinEnabled: true,
      pinHash: hashed,
    };
    setSettingsForm(updated);
    await onSaveSettings(updated, seqForm);
    setNewPin('');
    setConfirmPin('');
    onNotify('Application PIN protection enabled');
  };

  const handleDisablePin = async () => {
    const updated: BusinessSettings = {
      ...settingsForm,
      pinEnabled: false,
      pinHash: '',
    };
    setSettingsForm(updated);
    await onSaveSettings(updated, seqForm);
    onNotify('Application PIN protection disabled');
  };

  const handleThemeToggle = async (nextTheme: 'light' | 'dark') => {
    const updated: BusinessSettings = {
      ...settingsForm,
      theme: nextTheme,
    };
    setSettingsForm(updated);
    await onSaveSettings(updated, seqForm);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const validation = validateBackupJSON(text);
      if (!validation.valid || !validation.payload || !validation.summary) {
        setImportError(validation.errors.join(' '));
        return;
      }
      setPendingBackup({
        payload: validation.payload,
        summary: validation.summary,
      });
    } catch {
      setImportError('Failed to read the selected backup file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmImport = async (mode: 'replace' | 'merge') => {
    if (!pendingBackup) return;
    setImporting(true);
    try {
      const result = await importCompleteBackup(pendingBackup.payload, mode);
      await onReloadAllData();
      setPendingBackup(null);
      onNotify(
        mode === 'replace'
          ? `Backup restored cleanly (${result.addedCount} records loaded)`
          : `Merged backup (${result.addedCount} added, ${result.skippedDuplicates} duplicates skipped)`
      );
    } catch (err) {
      setImportError((err as Error).message || 'Backup restore failed');
      setPendingBackup(null);
    } finally {
      setImporting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Data Backup & Export Center */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800 dark:text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Data Backup, Restore &amp; CSV Exports
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Offline data is stored strictly on this device. Use manual backup &amp; restore to
                transfer records between mobile and desktop devices.
              </p>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Last Backup:{' '}
            <strong className="font-mono">
              {settings.lastBackupAt
                ? new Date(settings.lastBackupAt).toLocaleString('en-IN')
                : 'Never'}
            </strong>
          </div>
        </div>

        {importError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
          >
            {importError}
          </div>
        )}

        {/* All 6 Required Backup & Export Buttons */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={onExportCompleteBackup}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 transition"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>Export Complete Backup</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-emerald-800/30 bg-emerald-50/70 px-4 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-100/70 transition dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span>Import Backup</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => {
              exportCustomersCSV(customers, balancesMap);
              onNotify('Customer CSV downloaded');
            }}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <span>Download Customer Data</span>
          </button>

          <button
            type="button"
            onClick={() => {
              exportProductsCSV(products);
              onNotify('Product CSV downloaded');
            }}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <span>Download Product Data</span>
          </button>

          <button
            type="button"
            onClick={() => {
              exportInvoicesCSV(invoices);
              onNotify('Invoice History CSV downloaded');
            }}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <span>Export Invoice History</span>
          </button>

          <button
            type="button"
            onClick={() => {
              exportPaymentsCSV(payments);
              onNotify('Payment History CSV downloaded');
            }}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <span>Export Payment History</span>
          </button>
        </div>
      </section>

      {/* Company Profile Form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4 dark:border-slate-800">
          <Building2 className="h-5 w-5 text-emerald-800 dark:text-emerald-400" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Company Profile &amp; Invoice Header
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Printed on every A4 Tax Invoice, PDF download, and Company Stamp
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveCompanySubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Company Name
              </label>
              <input
                type="text"
                required
                value={companyForm.companyName}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, companyName: e.target.value })
                }
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={companyForm.tagline}
                onChange={(e) => setCompanyForm({ ...companyForm, tagline: e.target.value })}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                GSTIN
              </label>
              <input
                type="text"
                value={companyForm.gstin}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, gstin: e.target.value.toUpperCase() })
                }
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Drug License Number (D.L. No.)
              </label>
              <input
                type="text"
                value={companyForm.dlNumber}
                onChange={(e) => setCompanyForm({ ...companyForm, dlNumber: e.target.value })}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Street Address
              </label>
              <input
                type="text"
                value={companyForm.address}
                onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                City
              </label>
              <input
                type="text"
                value={companyForm.city}
                onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Home State (GST)
              </label>
              <select
                value={companyForm.stateCode}
                onChange={(e) => {
                  const found = INDIAN_STATES.find((s) => s.code === e.target.value);
                  setCompanyForm({
                    ...companyForm,
                    stateCode: e.target.value,
                    state: found?.name || companyForm.state,
                  });
                }}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pincode
              </label>
              <input
                type="text"
                value={companyForm.pincode}
                onChange={(e) => setCompanyForm({ ...companyForm, pincode: e.target.value })}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phone
              </label>
              <input
                type="text"
                value={companyForm.phone}
                onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                value={companyForm.email}
                onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bank Name
              </label>
              <input
                type="text"
                value={companyForm.bankName}
                onChange={(e) => setCompanyForm({ ...companyForm, bankName: e.target.value })}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                A/C Holder Name
              </label>
              <input
                type="text"
                value={companyForm.accountName}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, accountName: e.target.value })
                }
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Account No.
              </label>
              <input
                type="text"
                value={companyForm.accountNumber}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, accountNumber: e.target.value })
                }
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                IFSC Code
              </label>
              <input
                type="text"
                value={companyForm.ifscCode}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, ifscCode: e.target.value.toUpperCase() })
                }
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Branch
              </label>
              <input
                type="text"
                value={companyForm.branch}
                onChange={(e) => setCompanyForm({ ...companyForm, branch: e.target.value })}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Terms &amp; Conditions
              </label>
              <textarea
                rows={3}
                value={companyForm.termsAndConditions}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, termsAndConditions: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Authorized Signatory Label
              </label>
              <input
                type="text"
                value={companyForm.authorizedSignatory}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, authorizedSignatory: e.target.value })
                }
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingCompany}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{savingCompany ? 'Saving...' : 'Save Company Profile'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Business Settings, Invoice Sequence & Security */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="border-b border-slate-200 pb-3 text-base font-bold text-slate-900 dark:border-slate-800 dark:text-white">
            Invoice Numbering &amp; Billing Defaults
          </h2>

          <form onSubmit={handleSaveSettingsSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={settingsForm.invoicePrefix}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      invoicePrefix: e.target.value.toUpperCase(),
                    })
                  }
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Financial Year
                </label>
                <input
                  type="text"
                  value={settingsForm.financialYear}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, financialYear: e.target.value })
                  }
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Next Invoice Sequence #
                </label>
                <input
                  type="number"
                  min="1"
                  value={seqForm.nextNumber}
                  onChange={(e) =>
                    setSeqForm({
                      ...seqForm,
                      nextNumber: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Default GST Slab
                </label>
                <select
                  value={settingsForm.defaultTaxRate}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      defaultTaxRate: Number(e.target.value),
                    })
                  }
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Auto Round-Off Grand Total to Nearest Rupee
              </span>
              <input
                type="checkbox"
                checked={settingsForm.autoRoundOff}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, autoRoundOff: e.target.checked })
                }
                className="h-5 w-5 accent-emerald-800"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Application Theme
              </span>
              <div className="flex items-center gap-1 rounded-lg bg-slate-200/80 p-1 dark:bg-slate-700">
                <button
                  type="button"
                  onClick={() => handleThemeToggle('light')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                    settingsForm.theme === 'light'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeToggle('dark')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                    settingsForm.theme === 'dark'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{savingSettings ? 'Saving...' : 'Save Billing Defaults'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Security, PWA Install & Storage */}
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-800 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Security, PWA App &amp; Storage
              </h2>
            </div>
            {settingsForm.pinEnabled && (
              <button
                type="button"
                onClick={onLockNow}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white dark:bg-slate-700"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Lock Now</span>
              </button>
            )}
          </div>

          {/* PIN Lock Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Application PIN Protection
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {settingsForm.pinEnabled
                    ? 'PIN lock is currently ACTIVE on this device.'
                    : 'Protect billing records with an optional 4-6 digit PIN.'}
                </p>
              </div>
              {settingsForm.pinEnabled && (
                <button
                  type="button"
                  onClick={handleDisablePin}
                  className="min-h-[36px] rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
                >
                  Disable PIN
                </button>
              )}
            </div>

            <form onSubmit={handleSavePin} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4-6 digit PIN"
                className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Confirm PIN"
                className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-700"
              >
                {settingsForm.pinEnabled ? 'Change PIN' : 'Enable PIN'}
              </button>
            </form>
            {pinError && <p className="text-xs font-medium text-rose-600">{pinError}</p>}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Auto-Lock After Inactivity
              </span>
              <select
                value={settingsForm.autoLockMinutes}
                onChange={async (e) => {
                  const updated = {
                    ...settingsForm,
                    autoLockMinutes: Number(e.target.value),
                  };
                  setSettingsForm(updated);
                  await onSaveSettings(updated, seqForm);
                }}
                className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value={0}>Off</option>
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>
          </div>

          {/* PWA Install & Offline Storage Diagnostics */}
          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <HardDrive className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <span>
                  IndexedDB Storage:{' '}
                  <strong className="font-mono">
                    {storageDiag ? formatBytes(storageDiag.usageBytes) : 'Checking...'}
                  </strong>
                  {storageDiag?.persisted ? ' · Persistent Lock Granted' : ''}
                </span>
              </div>
            </div>

            <PWAInstallButton variant="card" />

            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setClearConfirmText('');
                  setShowClearModal(true);
                }}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-rose-300 px-3.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="h-4 w-4" />
                <span>Clear All Local Data</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Import Backup Confirmation Modal */}
      {pendingBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Restore Backup Preview
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Backup exported on{' '}
              <strong className="font-mono">
                {new Date(pendingBackup.summary.exportedAt).toLocaleString('en-IN')}
              </strong>
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/70">
              <div>
                Customers:{' '}
                <strong className="font-mono">{pendingBackup.summary.customersCount}</strong>
              </div>
              <div>
                Products:{' '}
                <strong className="font-mono">{pendingBackup.summary.productsCount}</strong>
              </div>
              <div>
                Invoices:{' '}
                <strong className="font-mono">{pendingBackup.summary.invoicesCount}</strong>
              </div>
              <div>
                Payments:{' '}
                <strong className="font-mono">{pendingBackup.summary.paymentsCount}</strong>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 dark:text-slate-300">
              Choose whether to <strong>Merge</strong> new records without duplicates or{' '}
              <strong className="text-rose-700 dark:text-rose-400">Replace All Existing Data</strong>{' '}
              on this device.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={importing}
                onClick={() => handleConfirmImport('merge')}
                className="min-h-[44px] w-full rounded-xl bg-emerald-800 px-4 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
              >
                {importing ? 'Restoring...' : 'Merge Backup (Skip Duplicates)'}
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => handleConfirmImport('replace')}
                className="min-h-[44px] w-full rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Replace Existing Data Completely
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => setPendingBackup(null)}
                className="min-h-[42px] w-full rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Local Data Warning Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-rose-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Erase All Local Business Data?
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  This permanently deletes all customers, products, invoices, and payment records
                  from this device. <strong>Export a Complete Backup first!</strong>
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Type <span className="font-mono text-rose-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="DELETE"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearConfirmText.trim() !== 'DELETE'}
                onClick={async () => {
                  await onClearAllData();
                  setShowClearModal(false);
                  onNotify('All local data cleared');
                }}
                className="min-h-[44px] rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
              >
                Confirm Erase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
