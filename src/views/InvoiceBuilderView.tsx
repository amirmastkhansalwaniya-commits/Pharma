import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Plus,
  Save,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  BusinessSettings,
  CompanyProfile,
  Customer,
  Invoice,
  InvoiceItem,
  InvoiceNumberSequence,
  InvoiceStatus,
  OutstandingBalance,
  PaymentMode,
  Product,
} from '../types/billing';
import {
  calculateInvoiceItem,
  calculateInvoiceTotals,
  determineTaxType,
  formatINR,
  formatInvoiceNumber,
  round2,
  todayISO,
  type DraftLineInput,
} from '../utils/billingMath';
import { GST_RATES, INDIAN_STATES, PRODUCT_UNITS } from '../utils/indianStates';
import { generateId } from '../utils/security';

interface InvoiceBuilderViewProps {
  company: CompanyProfile;
  settings: BusinessSettings;
  sequence: InvoiceNumberSequence;
  customers: Customer[];
  products: Product[];
  balances: OutstandingBalance[];
  editingInvoice?: Invoice | null;
  editingItems?: InvoiceItem[];
  preselectedCustomerId?: string | null;
  onSaveInvoice: (invoice: Invoice, items: InvoiceItem[]) => Promise<Invoice>;
  onQuickSaveCustomer: (customer: Customer) => Promise<void>;
  onCancelEdit: () => void;
  onSavedAndPreview: (invoice: Invoice) => void;
}

const createEmptyLine = (defaultTaxRate: number): DraftLineInput => ({
  id: generateId('item'),
  productId: '',
  productName: '',
  hsnCode: '30049099',
  batchNumber: '',
  mfgDate: '',
  expiryDate: '',
  quantity: 1,
  unit: 'Bottle',
  price: 0,
  mrp: 0,
  discountPercent: 0,
  taxRate: defaultTaxRate,
});

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

export const InvoiceBuilderView: React.FC<InvoiceBuilderViewProps> = ({
  company,
  settings,
  sequence,
  customers,
  products,
  balances,
  editingInvoice,
  editingItems,
  preselectedCustomerId,
  onSaveInvoice,
  onQuickSaveCustomer,
  onCancelEdit,
  onSavedAndPreview,
}) => {
  const nextAutoNumber = useMemo(
    () =>
      formatInvoiceNumber(
        settings.invoicePrefix || sequence.prefix,
        settings.financialYear,
        sequence.nextNumber,
        sequence.padding
      ),
    [settings, sequence]
  );

  const [invoiceId, setInvoiceId] = useState<string>(() => editingInvoice?.id || generateId('inv'));
  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    () => editingInvoice?.invoiceNumber || nextAutoNumber
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    () => editingInvoice?.invoiceDate || todayISO()
  );
  const [placeOfSupply, setPlaceOfSupply] = useState<string>(
    () => editingInvoice?.placeOfSupply || settings.defaultPlaceOfSupply || company.state
  );
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState<string>(
    () => editingInvoice?.placeOfSupplyCode || settings.defaultPlaceOfSupplyCode || company.stateCode
  );

  const [customerId, setCustomerId] = useState<string>(
    () => editingInvoice?.customerId || preselectedCustomerId || ''
  );
  const [customerName, setCustomerName] = useState<string>(
    () => editingInvoice?.customerName || ''
  );
  const [customerAddress, setCustomerAddress] = useState<string>(
    () => editingInvoice?.customerAddress || ''
  );
  const [shippingAddress, setShippingAddress] = useState<string>(
    () => editingInvoice?.shippingAddress || ''
  );
  const [customerMobile, setCustomerMobile] = useState<string>(
    () => editingInvoice?.customerMobile || ''
  );
  const [customerGstin, setCustomerGstin] = useState<string>(
    () => editingInvoice?.customerGstin || ''
  );
  const [customerPincode, setCustomerPincode] = useState<string>(
    () => editingInvoice?.customerPincode || ''
  );
  const [transport, setTransport] = useState<string>(
    () => editingInvoice?.transport || 'Self'
  );
  const [vehicleNo, setVehicleNo] = useState<string>(
    () => editingInvoice?.vehicleNo || ''
  );
  const [station, setStation] = useState<string>(
    () => editingInvoice?.station || ''
  );
  const [invoiceTypeLabel, setInvoiceTypeLabel] = useState<'AUTO' | 'TAX INVOICE' | 'BILL OF SUPPLY'>(
    () => editingInvoice?.invoiceTypeLabel || 'AUTO'
  );

  const [lines, setLines] = useState<DraftLineInput[]>(() => {
    if (editingItems && editingItems.length > 0) {
      return editingItems.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        hsnCode: it.hsnCode,
        batchNumber: it.batchNumber,
        mfgDate: it.mfgDate,
        expiryDate: it.expiryDate,
        quantity: it.quantity,
        unit: it.unit,
        price: it.price,
        mrp: it.mrp,
        discountPercent: it.discountPercent,
        taxRate: it.taxRate,
      }));
    }
    return [createEmptyLine(settings.defaultTaxRate)];
  });

  const [paymentReceived, setPaymentReceived] = useState<number>(
    () => editingInvoice?.paymentReceived ?? 0
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(
    () => editingInvoice?.paymentMode || 'Cash'
  );
  const [notes, setNotes] = useState<string>(() => editingInvoice?.notes || '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Quick Add Customer Modal inside Invoice Builder
  const [showQuickCust, setShowQuickCust] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustMobile, setQuickCustMobile] = useState('');
  const [quickCustAddress, setQuickCustAddress] = useState('');
  const [quickCustGstin, setQuickCustGstin] = useState('');
  const [quickCustStateCode, setQuickCustStateCode] = useState(company.stateCode || '27');

  const balancesMap = useMemo(() => {
    const map = new Map<string, OutstandingBalance>();
    balances.forEach((b) => map.set(b.customerId, b));
    return map;
  }, [balances]);

  // Apply preselected customer if passed when opening New Bill
  useEffect(() => {
    if (!editingInvoice && preselectedCustomerId) {
      const cust = customers.find((c) => c.id === preselectedCustomerId);
      if (cust) {
        setCustomerId(cust.id);
        setCustomerName(cust.name);
        setCustomerAddress(cust.address);
        setShippingAddress(cust.shippingAddress || cust.address);
        setCustomerMobile(cust.mobile);
        setCustomerGstin(cust.gstin);
        setCustomerPincode(cust.pincode || '');
        setPlaceOfSupply(cust.state);
        setPlaceOfSupplyCode(cust.stateCode);
      }
    }
  }, [preselectedCustomerId, customers, editingInvoice]);

  // Update auto invoice number if not editing
  useEffect(() => {
    if (!editingInvoice) {
      setInvoiceId(generateId('inv'));
      setInvoiceNumber(nextAutoNumber);
    }
  }, [editingInvoice, nextAutoNumber]);

  const handleSelectCustomer = (selectedId: string) => {
    setCustomerId(selectedId);
    if (!selectedId) return;
    const cust = customers.find((c) => c.id === selectedId);
    if (cust) {
      setCustomerName(cust.name);
      setCustomerAddress(cust.address);
      setShippingAddress(cust.shippingAddress || cust.address);
      setCustomerMobile(cust.mobile);
      setCustomerGstin(cust.gstin);
      setCustomerPincode(cust.pincode || '');
      setPlaceOfSupply(cust.state);
      setPlaceOfSupplyCode(cust.stateCode);
    }
  };

  const handleStateChange = (code: string) => {
    const found = INDIAN_STATES.find((s) => s.code === code);
    setPlaceOfSupplyCode(code);
    setPlaceOfSupply(found?.name || placeOfSupply);
  };

  const handleSelectProduct = (lineId: string, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        if (!prod) return { ...l, productId: '' };
        return {
          ...l,
          productId: prod.id,
          productName: prod.name,
          hsnCode: prod.hsnCode,
          batchNumber: prod.batchNumber,
          mfgDate: prod.mfgDate,
          expiryDate: prod.expiryDate,
          unit: prod.unit,
          price: prod.sellingPrice,
          mrp: prod.mrp,
          taxRate: prod.taxRate,
        };
      })
    );
  };

  const updateLine = (lineId: string, patch: Partial<DraftLineInput>) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== lineId)));
  };

  const taxType = useMemo(
    () => determineTaxType(company.stateCode, placeOfSupplyCode),
    [company.stateCode, placeOfSupplyCode]
  );

  const computedItems = useMemo(
    () => lines.map((l) => calculateInvoiceItem(l, invoiceId, taxType)),
    [lines, invoiceId, taxType]
  );

  const totals = useMemo(
    () => calculateInvoiceTotals(computedItems, settings.autoRoundOff),
    [computedItems, settings.autoRoundOff]
  );

  // Previous balance calculation (excludes current invoice's previous finalized impact if editing)
  const previousBalance = useMemo(() => {
    if (!customerId) return 0;
    const bal = balancesMap.get(customerId);
    const cust = customers.find((c) => c.id === customerId);
    let base = bal ? bal.currentBalance : cust?.openingBalance ?? 0;

    if (
      editingInvoice &&
      editingInvoice.status === 'finalized' &&
      editingInvoice.customerId === customerId
    ) {
      base = round2(base - editingInvoice.grandTotal + editingInvoice.paymentReceived);
    }
    return round2(base);
  }, [customerId, balancesMap, customers, editingInvoice]);

  const totalOutstanding = useMemo(
    () => round2(previousBalance + totals.grandTotal - (Number(paymentReceived) || 0)),
    [previousBalance, totals.grandTotal, paymentReceived]
  );

  const handleQuickCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim()) return;
    const st = INDIAN_STATES.find((s) => s.code === quickCustStateCode);
    const now = new Date().toISOString();
    const newCust: Customer = {
      id: generateId('cust'),
      name: quickCustName.trim(),
      mobile: quickCustMobile.trim(),
      email: '',
      address: quickCustAddress.trim(),
      shippingAddress: quickCustAddress.trim(),
      state: st?.name || 'Maharashtra',
      stateCode: quickCustStateCode,
      gstin: quickCustGstin.trim().toUpperCase(),
      openingBalance: 0,
      createdAt: now,
      updatedAt: now,
    };
    await onQuickSaveCustomer(newCust);
    setCustomerId(newCust.id);
    setCustomerName(newCust.name);
    setCustomerAddress(newCust.address);
    setShippingAddress(newCust.shippingAddress);
    setCustomerMobile(newCust.mobile);
    setCustomerGstin(newCust.gstin);
    setPlaceOfSupply(newCust.state);
    setPlaceOfSupplyCode(newCust.stateCode);
    setShowQuickCust(false);
    setQuickCustName('');
    setQuickCustMobile('');
    setQuickCustAddress('');
    setQuickCustGstin('');
  };

  const handleSave = async (targetStatus: InvoiceStatus) => {
    setErrorMsg('');
    if (!customerName.trim()) {
      setErrorMsg('Please select or enter a Customer Name.');
      return;
    }
    const validItems = computedItems.filter((it) => it.productName.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please add at least one product item with quantity > 0.');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const invNumToSave =
        targetStatus === 'draft'
          ? editingInvoice?.status === 'draft'
            ? invoiceNumber
            : `DRAFT-${Date.now().toString().slice(-6)}`
          : editingInvoice?.status === 'draft'
            ? ''
            : invoiceNumber;

      const resolvedTypeLabel: 'TAX INVOICE' | 'BILL OF SUPPLY' =
        invoiceTypeLabel === 'AUTO'
          ? totals.totalGst > 0
            ? 'TAX INVOICE'
            : 'BILL OF SUPPLY'
          : invoiceTypeLabel;

      const invoicePayload: Invoice = {
        id: invoiceId,
        invoiceNumber: invNumToSave,
        invoiceDate,
        placeOfSupply,
        placeOfSupplyCode,
        invoiceTypeLabel: resolvedTypeLabel,
        transport: transport.trim() || 'Self',
        vehicleNo: vehicleNo.trim().toUpperCase(),
        station: station.trim(),
        customerId,
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim(),
        shippingAddress: shippingAddress.trim() || customerAddress.trim(),
        customerPincode: customerPincode.trim(),
        customerMobile: customerMobile.trim(),
        customerGstin: customerGstin.trim().toUpperCase(),
        status: targetStatus,
        taxType,
        subtotalTaxable: totals.subtotalTaxable,
        totalCgst: totals.totalCgst,
        totalSgst: totals.totalSgst,
        totalIgst: totals.totalIgst,
        totalGst: totals.totalGst,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        amountInWords: totals.amountInWords,
        previousBalance,
        paymentReceived: round2(Number(paymentReceived) || 0),
        paymentMode,
        totalOutstanding,
        notes: notes.trim(),
        createdAt: editingInvoice?.createdAt || now,
        updatedAt: now,
      };

      const saved = await onSaveInvoice(invoicePayload, validItems);

      // Reset builder if creating a new invoice, or open preview
      if (!editingInvoice) {
        setInvoiceId(generateId('inv'));
        setCustomerId('');
        setCustomerName('');
        setCustomerAddress('');
        setShippingAddress('');
        setCustomerMobile('');
        setCustomerGstin('');
        setCustomerPincode('');
        setVehicleNo('');
        setStation('');
        setLines([createEmptyLine(settings.defaultTaxRate)]);
        setPaymentReceived(0);
        setNotes('');
      }
      onSavedAndPreview(saved);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Builder Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {editingInvoice ? `Edit Invoice · ${editingInvoice.invoiceNumber}` : 'Create Tax Invoice'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Offline GST billing ({taxType === 'intrastate' ? 'CGST + SGST' : 'IGST'}) · Auto
            updates customer ledger
          </p>
        </div>

        {editingInvoice && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="min-h-[40px] rounded-xl border border-slate-300 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            Cancel Editing
          </button>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
        >
          {errorMsg}
        </div>
      )}

      {/* Invoice Metadata & Customer Section */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 lg:grid-cols-12 dark:border-slate-800 dark:bg-slate-900">
        {/* Customer Selection */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
              Customer / Party Details
            </label>
            <button
              type="button"
              onClick={() => setShowQuickCust(true)}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-800/10 px-2.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-800/20 dark:bg-emerald-500/15 dark:text-emerald-300"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Quick Add Customer</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Saved Customer
              </label>
              <select
                value={customerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">-- Walk-in / Manual Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.mobile ? `(${c.mobile})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Customer Name *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Party / Clinic Name"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Customer Mobile
              </label>
              <input
                type="tel"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="Mobile number"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Customer GSTIN
              </label>
              <input
                type="text"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                placeholder="Optional GSTIN"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Billing Address
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Shop / Village / City"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Shipping Address
              </label>
              <input
                type="text"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Delivery address (if different)"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Party Pincode
              </label>
              <input
                type="text"
                value={customerPincode}
                onChange={(e) => setCustomerPincode(e.target.value)}
                placeholder="e.g., 132046"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Invoice Meta */}
        <div className="space-y-3 border-t border-slate-200 pt-4 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 dark:border-slate-800">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
            Invoice &amp; Transport Metadata
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Invoice Number
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 font-mono text-sm font-bold text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Invoice Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Place of Supply
              </label>
              <select
                value={placeOfSupplyCode}
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
                Bill Heading
              </label>
              <select
                value={invoiceTypeLabel}
                onChange={(e) =>
                  setInvoiceTypeLabel(
                    e.target.value as 'AUTO' | 'TAX INVOICE' | 'BILL OF SUPPLY'
                  )
                }
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="AUTO">Auto (Tax / Supply)</option>
                <option value="TAX INVOICE">TAX INVOICE</option>
                <option value="BILL OF SUPPLY">BILL OF SUPPLY</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Transport
              </label>
              <input
                type="text"
                value={transport}
                onChange={(e) => setTransport(e.target.value)}
                placeholder="Self"
                className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Vehicle No.
              </label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                placeholder="Optional"
                className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Station
              </label>
              <input
                type="text"
                value={station}
                onChange={(e) => setStation(e.target.value)}
                placeholder="City / Town"
                className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Company State: {company.state} ({company.stateCode}) · Applying{' '}
            <strong className="text-emerald-800 dark:text-emerald-400">
              {taxType === 'intrastate' ? 'CGST + SGST (Intra-State)' : 'IGST (Inter-State)'}
            </strong>
          </p>
        </div>
      </div>

      {/* Product Line Items Section */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Invoice Items ({lines.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a saved product to auto-fill HSN, Batch, Mfg/Exp, MRP, Price &amp; GST
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, createEmptyLine(settings.defaultTaxRate)])}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 text-xs font-semibold text-white hover:bg-emerald-900"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item Row</span>
          </button>
        </div>

        {/* Desktop Line-Item Table */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                <th className="px-3 py-2.5 font-semibold">#</th>
                <th className="min-w-[220px] px-2 py-2.5 font-semibold">Product Selection / Name</th>
                <th className="w-24 px-2 py-2.5 font-semibold">HSN</th>
                <th className="w-28 px-2 py-2.5 font-semibold">Batch No.</th>
                <th className="w-32 px-2 py-2.5 font-semibold">Mfg / Exp</th>
                <th className="w-20 px-2 py-2.5 text-right font-semibold">Qty</th>
                <th className="w-24 px-2 py-2.5 font-semibold">Unit</th>
                <th className="w-24 px-2 py-2.5 text-right font-semibold">MRP</th>
                <th className="w-24 px-2 py-2.5 text-right font-semibold">Rate</th>
                <th className="w-20 px-2 py-2.5 text-right font-semibold">GST %</th>
                <th className="w-28 px-2 py-2.5 text-right font-semibold">Taxable</th>
                <th className="w-28 px-2 py-2.5 text-right font-semibold">Line Total</th>
                <th className="w-10 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((line, idx) => {
                const calc = computedItems[idx];
                return (
                  <tr key={line.id} className="align-top">
                    <td className="px-3 py-2.5 font-mono text-slate-500">{idx + 1}</td>
                    <td className="space-y-1.5 px-2 py-2">
                      <select
                        value={line.productId}
                        onChange={(e) => handleSelectProduct(line.id, e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">-- Choose Product (or type below) --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.batchNumber || 'No Batch'}) · Rs.{p.sellingPrice}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={line.productName}
                        onChange={(e) => updateLine(line.id, { productName: e.target.value })}
                        placeholder="Product Name"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={line.hsnCode}
                        onChange={(e) => updateLine(line.id, { hsnCode: e.target.value })}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={line.batchNumber}
                        onChange={(e) => updateLine(line.id, { batchNumber: e.target.value })}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </td>
                    <td className="space-y-1 px-2 py-2">
                      <input
                        type="date"
                        value={line.mfgDate}
                        onChange={(e) => updateLine(line.id, { mfgDate: e.target.value })}
                        className="h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        title="Manufacturing Date"
                      />
                      <input
                        type="date"
                        value={line.expiryDate}
                        onChange={(e) => updateLine(line.id, { expiryDate: e.target.value })}
                        className="h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        title="Expiry Date"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })
                        }
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-right font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={line.unit}
                        onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {PRODUCT_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.mrp}
                        onChange={(e) =>
                          updateLine(line.id, { mrp: parseFloat(e.target.value) || 0 })
                        }
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-right font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.price}
                        onChange={(e) =>
                          updateLine(line.id, { price: parseFloat(e.target.value) || 0 })
                        }
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-right font-mono text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={line.taxRate}
                        onChange={(e) =>
                          updateLine(line.id, { taxRate: Number(e.target.value) })
                        }
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-1.5 text-right font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatINR(calc.taxableAmount)}
                    </td>
                    <td className="px-2 py-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatINR(calc.lineTotal)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length <= 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-30 dark:text-rose-400"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Touch-Friendly Item Cards */}
        <div className="divide-y divide-slate-200 lg:hidden dark:divide-slate-800">
          {lines.map((line, idx) => {
            const calc = computedItems[idx];
            return (
              <div key={line.id} className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-400">
                    Item #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length <= 1}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Quick Select Product
                  </label>
                  <select
                    value={line.productId}
                    onChange={(e) => handleSelectProduct(line.id, e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">-- Choose Saved Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.batchNumber || '-'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={line.productName}
                    onChange={(e) => updateLine(line.id, { productName: e.target.value })}
                    placeholder="Enter product name"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      HSN Code
                    </label>
                    <input
                      type="text"
                      value={line.hsnCode}
                      onChange={(e) => updateLine(line.id, { hsnCode: e.target.value })}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Batch Number
                    </label>
                    <input
                      type="text"
                      value={line.batchNumber}
                      onChange={(e) => updateLine(line.id, { batchNumber: e.target.value })}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Mfg Date
                    </label>
                    <input
                      type="date"
                      value={line.mfgDate}
                      onChange={(e) => updateLine(line.id, { mfgDate: e.target.value })}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={line.expiryDate}
                      onChange={(e) => updateLine(line.id, { expiryDate: e.target.value })}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Qty
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })
                      }
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Unit
                    </label>
                    <select
                      value={line.unit}
                      onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {PRODUCT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      GST %
                    </label>
                    <select
                      value={line.taxRate}
                      onChange={(e) => updateLine(line.id, { taxRate: Number(e.target.value) })}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {GST_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Rate (INR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.price}
                      onChange={(e) =>
                        updateLine(line.id, { price: parseFloat(e.target.value) || 0 })
                      }
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      MRP (INR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.mrp}
                      onChange={(e) =>
                        updateLine(line.id, { mrp: parseFloat(e.target.value) || 0 })
                      }
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
                  <span className="text-slate-500">
                    Taxable: <strong className="font-mono">{formatINR(calc.taxableAmount)}</strong>
                  </span>
                  <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400">
                    Total: {formatINR(calc.lineTotal)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Summary, Payment & Amount in Words */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
              Amount in Words
            </p>
            <p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-900 dark:bg-slate-800/60 dark:text-white">
              {totals.amountInWords}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Payment Received Now (INR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentReceived}
                onChange={(e) => setPaymentReceived(parseFloat(e.target.value) || 0)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm font-bold text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentReceived(totals.grandTotal)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Bill Paid ({formatINR(totals.grandTotal)})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentReceived(Math.max(0, round2(previousBalance + totals.grandTotal)))}
                  className="rounded-lg border border-emerald-700/30 bg-emerald-800/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 dark:text-emerald-300"
                >
                  Clear Full Dues
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentReceived(0)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-400"
                >
                  Credit (0)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Invoice Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Transport, LR No., or delivery note..."
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Live GST & Ledger Summary */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Taxable Subtotal</span>
              <span className="font-mono tabular-nums">{formatINR(totals.subtotalTaxable)}</span>
            </div>
            {taxType === 'intrastate' ? (
              <>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>CGST</span>
                  <span className="font-mono tabular-nums">{formatINR(totals.totalCgst)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>SGST</span>
                  <span className="font-mono tabular-nums">{formatINR(totals.totalSgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>IGST</span>
                <span className="font-mono tabular-nums">{formatINR(totals.totalIgst)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Round Off</span>
              <span className="font-mono tabular-nums">{formatINR(totals.roundOff)}</span>
            </div>

            <div className="my-2 flex items-center justify-between rounded-xl bg-emerald-900 px-4 py-3 text-white">
              <span className="text-sm font-bold">GRAND TOTAL</span>
              <span className="font-mono text-lg font-bold tabular-nums">
                {formatINR(totals.grandTotal)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Previous Customer Balance</span>
              <span className="font-mono tabular-nums">{formatINR(previousBalance)}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-400">
              <span>Payment Received ({paymentMode})</span>
              <span className="font-mono tabular-nums">-{formatINR(paymentReceived)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              <span>Total Outstanding</span>
              <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
                {formatINR(totalOutstanding)}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('draft')}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <Save className="h-4 w-4" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('finalized')}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Generate Invoice'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      {showQuickCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Quick Add Customer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickCust(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleQuickCustomerSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mobile
                  </label>
                  <input
                    type="tel"
                    value={quickCustMobile}
                    onChange={(e) => setQuickCustMobile(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    State
                  </label>
                  <select
                    value={quickCustStateCode}
                    onChange={(e) => setQuickCustStateCode(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Address
                </label>
                <input
                  type="text"
                  value={quickCustAddress}
                  onChange={(e) => setQuickCustAddress(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  GSTIN (Optional)
                </label>
                <input
                  type="text"
                  value={quickCustGstin}
                  onChange={(e) => setQuickCustGstin(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickCust(false)}
                  className="min-h-[42px] rounded-xl border border-slate-300 px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] rounded-xl bg-emerald-800 px-4 text-xs font-semibold text-white"
                >
                  Save &amp; Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
