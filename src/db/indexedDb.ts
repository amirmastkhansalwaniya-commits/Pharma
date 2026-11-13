import type {
  BusinessSettings,
  CompanyProfile,
  CompleteBackupPayload,
  Customer,
  Invoice,
  InvoiceItem,
  InvoiceNumberSequence,
  OutstandingBalance,
  PaymentRecord,
  Product,
} from '../types/billing';
import { formatInvoiceNumber, round2, todayISO } from '../utils/billingMath';
import { generateId } from '../utils/security';

const DB_NAME = 'royal_king_vet_pharma_db';
const DB_VERSION = 1;

export const STORES = {
  COMPANY_PROFILE: 'companyProfile',
  CUSTOMERS: 'customers',
  PRODUCTS: 'products',
  INVOICES: 'invoices',
  INVOICE_ITEMS: 'invoiceItems',
  PAYMENTS: 'payments',
  OUTSTANDING_BALANCES: 'outstandingBalances',
  BUSINESS_SETTINGS: 'businessSettings',
  INVOICE_SEQUENCE: 'invoiceNumberSequence',
} as const;

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  id: 'primary',
  companyName: 'ROYAL KING VET PHARMA',
  tagline: 'Veterinary Pharmaceuticals, Feed Supplements & Animal Healthcare',
  address: 'Shop No. 12, Veterinary Market Complex, Station Road',
  city: 'Pune',
  state: 'Maharashtra',
  stateCode: '27',
  pincode: '411001',
  phone: '+91 98765 43210',
  email: 'billing@royalkingvetpharma.in',
  gstin: '27AABCR1234F1Z5',
  dlNumber: 'MH-PZ1-20B/21B-10452',
  bankName: 'State Bank of India',
  accountName: 'ROYAL KING VET PHARMA',
  accountNumber: '38910456210',
  ifscCode: 'SBIN0001234',
  branch: 'Pune Main Branch',
  termsAndConditions:
    '1. Goods once sold will not be taken back or exchanged.\n2. Please check Batch No. & Expiry Date at the time of delivery.\n3. Interest @ 18% p.a. will be charged on overdue bills beyond 30 days.\n4. Subject to local jurisdiction only.',
  authorizedSignatory: 'Authorized Signatory',
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  id: 'primary',
  invoicePrefix: 'RKVP',
  financialYear: '2026-27',
  defaultPlaceOfSupply: 'Maharashtra',
  defaultPlaceOfSupplyCode: '27',
  defaultTaxRate: 12,
  autoRoundOff: true,
  pinEnabled: false,
  pinHash: '',
  autoLockMinutes: 5,
  lastBackupAt: null,
  backupReminderDays: 7,
  theme: 'light',
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_INVOICE_SEQUENCE: InvoiceNumberSequence = {
  id: 'primary',
  prefix: 'RKVP',
  nextNumber: 1,
  padding: 4,
  updatedAt: new Date().toISOString(),
};

let dbPromise: Promise<IDBDatabase> | null = null;

function mapDbError(err: unknown, context: string): Error {
  const domErr = err as { name?: string; message?: string } | null;
  if (domErr?.name === 'QuotaExceededError') {
    return new Error(
      `Device storage quota exceeded during ${context}. Please export a complete backup and free up device space.`
    );
  }
  return new Error(`Database error (${context}): ${domErr?.message || String(err)}`);
}

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.COMPANY_PROFILE)) {
        db.createObjectStore(STORES.COMPANY_PROFILE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const store = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('mobile', 'mobile', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        const store = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('hsnCode', 'hsnCode', { unique: false });
        store.createIndex('batchNumber', 'batchNumber', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.INVOICES)) {
        const store = db.createObjectStore(STORES.INVOICES, { keyPath: 'id' });
        store.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
        store.createIndex('customerId', 'customerId', { unique: false });
        store.createIndex('invoiceDate', 'invoiceDate', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.INVOICE_ITEMS)) {
        const store = db.createObjectStore(STORES.INVOICE_ITEMS, { keyPath: 'id' });
        store.createIndex('invoiceId', 'invoiceId', { unique: false });
        store.createIndex('productId', 'productId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
        const store = db.createObjectStore(STORES.PAYMENTS, { keyPath: 'id' });
        store.createIndex('customerId', 'customerId', { unique: false });
        store.createIndex('invoiceId', 'invoiceId', { unique: false });
        store.createIndex('paymentDate', 'paymentDate', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.OUTSTANDING_BALANCES)) {
        db.createObjectStore(STORES.OUTSTANDING_BALANCES, { keyPath: 'customerId' });
      }
      if (!db.objectStoreNames.contains(STORES.BUSINESS_SETTINGS)) {
        db.createObjectStore(STORES.BUSINESS_SETTINGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.INVOICE_SEQUENCE)) {
        db.createObjectStore(STORES.INVOICE_SEQUENCE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(mapDbError(request.error, 'opening IndexedDB'));
    };
  });

  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
    return false;
  } catch {
    return false;
  }
}

export interface StorageDiagnostics {
  persisted: boolean;
  usageBytes: number;
  quotaBytes: number;
}

export async function getStorageDiagnostics(): Promise<StorageDiagnostics> {
  let persisted = false;
  let usageBytes = 0;
  let quotaBytes = 0;
  try {
    if (navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted();
    }
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      usageBytes = est.usage ?? 0;
      quotaBytes = est.quota ?? 0;
    }
  } catch {
    // Ignore unsupported browser storage estimate errors
  }
  return { persisted, usageBytes, quotaBytes };
}

export async function initializeDatabaseDefaults(): Promise<{
  companyProfile: CompanyProfile;
  businessSettings: BusinessSettings;
  invoiceSequence: InvoiceNumberSequence;
}> {
  const db = await openDatabase();
  const tx = db.transaction(
    [STORES.COMPANY_PROFILE, STORES.BUSINESS_SETTINGS, STORES.INVOICE_SEQUENCE],
    'readwrite'
  );

  const companyStore = tx.objectStore(STORES.COMPANY_PROFILE);
  const settingsStore = tx.objectStore(STORES.BUSINESS_SETTINGS);
  const seqStore = tx.objectStore(STORES.INVOICE_SEQUENCE);

  let company = (await reqToPromise(companyStore.get('primary'))) as CompanyProfile | undefined;
  if (!company) {
    company = { ...DEFAULT_COMPANY_PROFILE, updatedAt: new Date().toISOString() };
    await reqToPromise(companyStore.put(company));
  }

  let settings = (await reqToPromise(settingsStore.get('primary'))) as BusinessSettings | undefined;
  if (!settings) {
    settings = { ...DEFAULT_BUSINESS_SETTINGS, updatedAt: new Date().toISOString() };
    await reqToPromise(settingsStore.put(settings));
  }

  let seq = (await reqToPromise(seqStore.get('primary'))) as InvoiceNumberSequence | undefined;
  if (!seq) {
    seq = { ...DEFAULT_INVOICE_SEQUENCE, updatedAt: new Date().toISOString() };
    await reqToPromise(seqStore.put(seq));
  }

  await txDone(tx);
  return { companyProfile: company, businessSettings: settings, invoiceSequence: seq };
}

export interface AllAppData {
  companyProfile: CompanyProfile;
  businessSettings: BusinessSettings;
  invoiceSequence: InvoiceNumberSequence;
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: PaymentRecord[];
  outstandingBalances: OutstandingBalance[];
}

export async function loadAllData(): Promise<AllAppData> {
  const defaults = await initializeDatabaseDefaults();
  const db = await openDatabase();
  const tx = db.transaction(
    [
      STORES.CUSTOMERS,
      STORES.PRODUCTS,
      STORES.INVOICES,
      STORES.INVOICE_ITEMS,
      STORES.PAYMENTS,
      STORES.OUTSTANDING_BALANCES,
    ],
    'readonly'
  );

  const [customers, products, invoices, invoiceItems, payments, outstandingBalances] =
    await Promise.all([
      reqToPromise(tx.objectStore(STORES.CUSTOMERS).getAll()) as Promise<Customer[]>,
      reqToPromise(tx.objectStore(STORES.PRODUCTS).getAll()) as Promise<Product[]>,
      reqToPromise(tx.objectStore(STORES.INVOICES).getAll()) as Promise<Invoice[]>,
      reqToPromise(tx.objectStore(STORES.INVOICE_ITEMS).getAll()) as Promise<InvoiceItem[]>,
      reqToPromise(tx.objectStore(STORES.PAYMENTS).getAll()) as Promise<PaymentRecord[]>,
      reqToPromise(
        tx.objectStore(STORES.OUTSTANDING_BALANCES).getAll()
      ) as Promise<OutstandingBalance[]>,
    ]);

  await txDone(tx);

  customers.sort((a, b) => a.name.localeCompare(b.name));
  products.sort((a, b) => a.name.localeCompare(b.name));
  invoices.sort((a, b) => (b.invoiceDate + b.createdAt).localeCompare(a.invoiceDate + a.createdAt));
  payments.sort((a, b) => (b.paymentDate + b.createdAt).localeCompare(a.paymentDate + a.createdAt));

  return {
    ...defaults,
    customers,
    products,
    invoices,
    invoiceItems,
    payments,
    outstandingBalances,
  };
}

export async function saveCompanyProfile(profile: CompanyProfile): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORES.COMPANY_PROFILE, 'readwrite');
    await reqToPromise(
      tx.objectStore(STORES.COMPANY_PROFILE).put({
        ...profile,
        id: 'primary',
        updatedAt: new Date().toISOString(),
      })
    );
    await txDone(tx);
  } catch (err) {
    throw mapDbError(err, 'saving company profile');
  }
}

export async function saveBusinessSettings(
  settings: BusinessSettings,
  sequence?: InvoiceNumberSequence
): Promise<void> {
  const db = await openDatabase();
  try {
    const stores = sequence
      ? [STORES.BUSINESS_SETTINGS, STORES.INVOICE_SEQUENCE]
      : [STORES.BUSINESS_SETTINGS];
    const tx = db.transaction(stores, 'readwrite');
    await reqToPromise(
      tx.objectStore(STORES.BUSINESS_SETTINGS).put({
        ...settings,
        id: 'primary',
        updatedAt: new Date().toISOString(),
      })
    );
    if (sequence) {
      await reqToPromise(
        tx.objectStore(STORES.INVOICE_SEQUENCE).put({
          ...sequence,
          id: 'primary',
          updatedAt: new Date().toISOString(),
        })
      );
    }
    await txDone(tx);
  } catch (err) {
    throw mapDbError(err, 'saving business settings');
  }
}

async function recalculateCustomerBalanceInTx(
  tx: IDBTransaction,
  customer: Customer
): Promise<OutstandingBalance> {
  const invStore = tx.objectStore(STORES.INVOICES);
  const payStore = tx.objectStore(STORES.PAYMENTS);
  const balStore = tx.objectStore(STORES.OUTSTANDING_BALANCES);

  const invIndex = invStore.index('customerId');
  const payIndex = payStore.index('customerId');

  const customerInvoices = (await reqToPromise(
    invIndex.getAll(customer.id)
  )) as Invoice[];
  const customerPayments = (await reqToPromise(
    payIndex.getAll(customer.id)
  )) as PaymentRecord[];

  const finalizedInvoices = customerInvoices.filter((inv) => inv.status === 'finalized');
  const totalInvoiced = round2(
    finalizedInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0)
  );
  const totalPaid = round2(
    customerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );
  const opening = round2(Number(customer.openingBalance) || 0);
  const currentBalance = round2(opening + totalInvoiced - totalPaid);

  const lastInvoiceDate = finalizedInvoices
    .map((i) => i.invoiceDate)
    .sort()
    .pop();
  const lastPaymentDate = customerPayments
    .map((p) => p.paymentDate)
    .sort()
    .pop();

  const record: OutstandingBalance = {
    customerId: customer.id,
    customerName: customer.name,
    openingBalance: opening,
    totalInvoiced,
    totalPaid,
    currentBalance,
    lastInvoiceDate,
    lastPaymentDate,
    updatedAt: new Date().toISOString(),
  };

  await reqToPromise(balStore.put(record));
  return record;
}

export async function saveCustomerAtomic(customer: Customer): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(
      [
        STORES.CUSTOMERS,
        STORES.INVOICES,
        STORES.PAYMENTS,
        STORES.OUTSTANDING_BALANCES,
      ],
      'readwrite'
    );
    const saved: Customer = {
      ...customer,
      updatedAt: new Date().toISOString(),
    };
    await reqToPromise(tx.objectStore(STORES.CUSTOMERS).put(saved));
    await recalculateCustomerBalanceInTx(tx, saved);
    await txDone(tx);
  } catch (err) {
    throw mapDbError(err, 'saving customer');
  }
}

export async function deleteCustomerAtomic(customerId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(
      [
        STORES.CUSTOMERS,
        STORES.OUTSTANDING_BALANCES,
        STORES.INVOICES,
        STORES.INVOICE_ITEMS,
        STORES.PAYMENTS,
      ],
      'readwrite'
    );

    const invStore = tx.objectStore(STORES.INVOICES);
    const itemStore = tx.objectStore(STORES.INVOICE_ITEMS);
    const payStore = tx.objectStore(STORES.PAYMENTS);

    const customerInvoices = (await reqToPromise(
      invStore.index('customerId').getAll(customerId)
    )) as Invoice[];

    for (const inv of customerInvoices) {
      const items = (await reqToPromise(
        itemStore.index('invoiceId').getAll(inv.id)
      )) as InvoiceItem[];
      for (const item of items) {
        await reqToPromise(itemStore.delete(item.id));
      }
      await reqToPromise(invStore.delete(inv.id));
    }

    const customerPayments = (await reqToPromise(
      payStore.index('customerId').getAll(customerId)
    )) as PaymentRecord[];
    for (const p of customerPayments) {
      await reqToPromise(payStore.delete(p.id));
    }

    await reqToPromise(tx.objectStore(STORES.OUTSTANDING_BALANCES).delete(customerId));
    await reqToPromise(tx.objectStore(STORES.CUSTOMERS).delete(customerId));
    await txDone(tx);
  } catch (err) {
    throw mapDbError(err, 'deleting customer');
  }
}

export async function saveProduct(product: Product): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORES.PRODUCTS, 'readwrite');
    await reqToPromise(
      tx.objectStore(STORES.PRODUCTS).put({
        ...product,
        updatedAt: new Date().toISOString(),
      })
    );
    await txDone(tx);
  } catch (err) {
    throw mapDbError(err, 'saving product');
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORES.PRODUCTS, 'readwrite');
    await reqToPromise(tx.objectStore(STORES.PRODUCTS).delete(productId));
    await txDone(tx);
  } catch (err) {
    throw mapDbError(err, 'deleting product');
  }
}

export async function saveInvoiceAtomic(
  invoiceInput: Invoice,
  itemsInput: InvoiceItem[]
): Promise<Invoice> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(
      [
        STORES.INVOICES,
        STORES.INVOICE_ITEMS,
        STORES.PAYMENTS,
        STORES.OUTSTANDING_BALANCES,
        STORES.CUSTOMERS,
        STORES.PRODUCTS,
        STORES.BUSINESS_SETTINGS,
        STORES.INVOICE_SEQUENCE,
      ],
      'readwrite'
    );

    const invStore = tx.objectStore(STORES.INVOICES);
    const itemStore = tx.objectStore(STORES.INVOICE_ITEMS);
    const payStore = tx.objectStore(STORES.PAYMENTS);
    const custStore = tx.objectStore(STORES.CUSTOMERS);
    const prodStore = tx.objectStore(STORES.PRODUCTS);
    const settingsStore = tx.objectStore(STORES.BUSINESS_SETTINGS);
    const seqStore = tx.objectStore(STORES.INVOICE_SEQUENCE);

    const existingInvoice = (await reqToPromise(invStore.get(invoiceInput.id))) as
      | Invoice
      | undefined;
    const existingItems = (await reqToPromise(
      itemStore.index('invoiceId').getAll(invoiceInput.id)
    )) as InvoiceItem[];

    const settings =
      ((await reqToPromise(settingsStore.get('primary'))) as BusinessSettings | undefined) ||
      DEFAULT_BUSINESS_SETTINGS;
    const seq =
      ((await reqToPromise(seqStore.get('primary'))) as InvoiceNumberSequence | undefined) ||
      DEFAULT_INVOICE_SEQUENCE;

    let finalInvoiceNumber = invoiceInput.invoiceNumber.trim();

    if (invoiceInput.status === 'draft') {
      if (!finalInvoiceNumber || !finalInvoiceNumber.startsWith('DRAFT-')) {
        finalInvoiceNumber = `DRAFT-${Date.now().toString().slice(-6)}`;
      }
    } else {
      // Finalized invoice: assign official sequential number if new or transitioning from draft
      const wasDraftOrNew = !existingInvoice || existingInvoice.status === 'draft';
      if (wasDraftOrNew && (!finalInvoiceNumber || finalInvoiceNumber.startsWith('DRAFT-'))) {
        finalInvoiceNumber = formatInvoiceNumber(
          settings.invoicePrefix || seq.prefix,
          settings.financialYear,
          seq.nextNumber,
          seq.padding
        );
        await reqToPromise(
          seqStore.put({
            ...seq,
            prefix: settings.invoicePrefix || seq.prefix,
            nextNumber: seq.nextNumber + 1,
            updatedAt: new Date().toISOString(),
          })
        );
      }
    }

    // Reconcile product stock safely (only for finalized invoices)
    const oldStockDeductions = new Map<string, number>();
    if (existingInvoice && existingInvoice.status === 'finalized') {
      for (const oldItem of existingItems) {
        if (oldItem.productId) {
          oldStockDeductions.set(
            oldItem.productId,
            (oldStockDeductions.get(oldItem.productId) || 0) + oldItem.quantity
          );
        }
      }
    }

    const newStockDeductions = new Map<string, number>();
    if (invoiceInput.status === 'finalized') {
      for (const newItem of itemsInput) {
        if (newItem.productId) {
          newStockDeductions.set(
            newItem.productId,
            (newStockDeductions.get(newItem.productId) || 0) + newItem.quantity
          );
        }
      }
    }

    const affectedProductIds = new Set([
      ...oldStockDeductions.keys(),
      ...newStockDeductions.keys(),
    ]);

    for (const pid of affectedProductIds) {
      const prod = (await reqToPromise(prodStore.get(pid))) as Product | undefined;
      if (prod) {
        const delta =
          (oldStockDeductions.get(pid) || 0) - (newStockDeductions.get(pid) || 0);
        if (delta !== 0) {
          await reqToPromise(
            prodStore.put({
              ...prod,
              stockQty: Math.max(0, round2(prod.stockQty + delta)),
              updatedAt: new Date().toISOString(),
            })
          );
        }
      }
    }

    // Replace line items cleanly
    for (const oldItem of existingItems) {
      await reqToPromise(itemStore.delete(oldItem.id));
    }
    for (const item of itemsInput) {
      await reqToPromise(
        itemStore.put({
          ...item,
          invoiceId: invoiceInput.id,
        })
      );
    }

    const savedInvoice: Invoice = {
      ...invoiceInput,
      invoiceNumber: finalInvoiceNumber,
      updatedAt: new Date().toISOString(),
    };
    await reqToPromise(invStore.put(savedInvoice));

    // Sync initial payment record deterministically (id = pay_init_<invoiceId>)
    const initialPaymentId = `pay_init_${savedInvoice.id}`;
    if (savedInvoice.status === 'finalized' && savedInvoice.paymentReceived > 0) {
      const payRecord: PaymentRecord = {
        id: initialPaymentId,
        customerId: savedInvoice.customerId,
        customerName: savedInvoice.customerName,
        invoiceId: savedInvoice.id,
        invoiceNumber: savedInvoice.invoiceNumber,
        amount: round2(savedInvoice.paymentReceived),
        paymentDate: savedInvoice.invoiceDate,
        paymentMode: savedInvoice.paymentMode,
        referenceNumber: savedInvoice.invoiceNumber,
        notes: `Payment recorded with Invoice ${savedInvoice.invoiceNumber}`,
        type: 'invoice_initial',
        createdAt: savedInvoice.createdAt,
      };
      await reqToPromise(payStore.put(payRecord));
    } else {
      await reqToPromise(payStore.delete(initialPaymentId));
    }

    // Recalculate customer's outstanding balance atomically
    if (savedInvoice.customerId) {
      const customer = (await reqToPromise(
        custStore.get(savedInvoice.customerId)
      )) as Customer | undefined;
      if (customer) {
        await recalculateCustomerBalanceInTx(tx, customer);
      }
    }

    await txDone(tx);
    return savedInvoice;
  } catch (err) {
    throw mapDbError(err, 'saving invoice');
  }
}

export async function deleteInvoiceAtomic(invoiceId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(
      [
        STORES.INVOICES,
        STORES.INVOICE_ITEMS,
        STORES.PAYMENTS,
        STORES.OUTSTANDING_BALANCES,
        STORES.CUSTOMERS,
        STORES.PRODUCTS,
      ],
      'readwrite'
    );

    const invStore = tx.objectStore(STORES.INVOICES);
    const itemStore = tx.objectStore(STORES.INVOICE_ITEMS);
    const payStore = tx.objectStore(STORES.PAYMENTS);
    const custStore = tx.objectStore(STORES.CUSTOMERS);
    const prodStore = tx.objectStore(STORES.PRODUCTS);

    const inv = (await reqToPromise(invStore.get(invoiceId))) as Invoice | undefined;
    if (!inv) {
      await txDone(tx);
      return;
    }

    const items = (await reqToPromise(
      itemStore.index('invoiceId').getAll(invoiceId)
    )) as InvoiceItem[];

    // Restore stock if finalized
    if (inv.status === 'finalized') {
      for (const item of items) {
        if (item.productId) {
          const prod = (await reqToPromise(prodStore.get(item.productId))) as
            | Product
            | undefined;
          if (prod) {
            await reqToPromise(
              prodStore.put({
                ...prod,
                stockQty: round2(prod.stockQty + item.quantity),
                updatedAt: new Date().toISOString(),
              })
            );
          }
        }
      }
    }

    for (const item of items) {
      await reqToPromise(itemStore.delete(item.id));
    }

    // Remove initial payment tied to this invoice
    await reqToPromise(payStore.delete(`pay_init_${invoiceId}`));
    await reqToPromise(invStore.delete(invoiceId));

    if (inv.customerId) {
      const customer = (await reqToPromise(
        custStore.get(inv.customerId)
      )) as Customer | undefined;
      if (customer) {
        await recalculateCustomerBalanceInTx(tx, customer);
      }
    }

    await txDone(tx);
  } catch (err) {
    throw mapDbError(err, 'deleting invoice');
  }
}

export async function recordPaymentAtomic(payment: PaymentRecord): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(
      [
        STORES.PAYMENTS,
        STORES.INVOICES,
        STORES.OUTSTANDING_BALANCES,
        STORES.CUSTOMERS,
      ],
      'readwrite'
    );
    await reqToPromise(
      tx.objectStore(STORES.PAYMENTS).put({
        ...payment,
        amount: round2(payment.amount),
      })
    );

    const customer = (await reqToPromise(
      tx.objectStore(STORES.CUSTOMERS).get(payment.customerId)
    )) as Customer | undefined;
    if (customer) {
      await recalculateCustomerBalanceInTx(tx, customer);
    }

    await txDone(tx);
  } catch (err) {
    throw mapDbError(err, 'recording payment');
  }
}

export async function deletePaymentAtomic(paymentId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(
      [
        STORES.PAYMENTS,
        STORES.INVOICES,
        STORES.OUTSTANDING_BALANCES,
        STORES.CUSTOMERS,
      ],
      'readwrite'
    );
    const payStore = tx.objectStore(STORES.PAYMENTS);
    const payment = (await reqToPromise(payStore.get(paymentId))) as
      | PaymentRecord
      | undefined;
    if (!payment) {
      await txDone(tx);
      return;
    }

    await reqToPromise(payStore.delete(paymentId));

    const customer = (await reqToPromise(
      tx.objectStore(STORES.CUSTOMERS).get(payment.customerId)
    )) as Customer | undefined;
    if (customer) {
      await recalculateCustomerBalanceInTx(tx, customer);
    }

    await txDone(tx);
  } catch (err) {
    throw mapDbError(err, 'deleting payment');
  }
}

export async function exportCompleteBackup(): Promise<CompleteBackupPayload> {
  const data = await loadAllData();
  const now = new Date().toISOString();

  // Record last backup timestamp
  const updatedSettings: BusinessSettings = {
    ...data.businessSettings,
    lastBackupAt: now,
    updatedAt: now,
  };
  await saveBusinessSettings(updatedSettings);

  return {
    appName: 'ROYAL KING VET PHARMA',
    schemaVersion: 1,
    exportedAt: now,
    stores: {
      companyProfile: [data.companyProfile],
      customers: data.customers,
      products: data.products,
      invoices: data.invoices,
      invoiceItems: data.invoiceItems,
      payments: data.payments,
      outstandingBalances: data.outstandingBalances,
      businessSettings: [updatedSettings],
      invoiceNumberSequence: [data.invoiceSequence],
    },
  };
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  payload?: CompleteBackupPayload;
  summary?: {
    exportedAt: string;
    customersCount: number;
    productsCount: number;
    invoicesCount: number;
    paymentsCount: number;
  };
}

export function validateBackupJSON(rawText: string): BackupValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { valid: false, errors: ['File is not valid JSON.'] };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['Backup root must be a JSON object.'] };
  }

  const obj = parsed as Partial<CompleteBackupPayload>;
  const errors: string[] = [];

  if (obj.appName !== 'ROYAL KING VET PHARMA') {
    errors.push('Invalid backup source: missing ROYAL KING VET PHARMA signature.');
  }
  if (!obj.stores || typeof obj.stores !== 'object') {
    errors.push('Missing "stores" container in backup file.');
  } else {
    const requiredArrays: (keyof CompleteBackupPayload['stores'])[] = [
      'companyProfile',
      'customers',
      'products',
      'invoices',
      'invoiceItems',
      'payments',
      'outstandingBalances',
      'businessSettings',
      'invoiceNumberSequence',
    ];
    for (const key of requiredArrays) {
      if (!Array.isArray(obj.stores[key])) {
        errors.push(`Backup store "${key}" is missing or corrupted.`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const payload = obj as CompleteBackupPayload;
  return {
    valid: true,
    errors: [],
    payload,
    summary: {
      exportedAt: payload.exportedAt || 'Unknown date',
      customersCount: payload.stores.customers.length,
      productsCount: payload.stores.products.length,
      invoicesCount: payload.stores.invoices.length,
      paymentsCount: payload.stores.payments.length,
    },
  };
}

export async function importCompleteBackup(
  payload: CompleteBackupPayload,
  mode: 'replace' | 'merge'
): Promise<{ addedCount: number; skippedDuplicates: number }> {
  const db = await openDatabase();
  const storeNames = Object.values(STORES);

  let addedCount = 0;
  let skippedDuplicates = 0;

  try {
    const tx = db.transaction(storeNames, 'readwrite');

    if (mode === 'replace') {
      for (const name of storeNames) {
        await reqToPromise(tx.objectStore(name).clear());
      }

      for (const c of payload.stores.companyProfile) {
        await reqToPromise(tx.objectStore(STORES.COMPANY_PROFILE).put(c));
        addedCount++;
      }
      for (const b of payload.stores.businessSettings) {
        await reqToPromise(tx.objectStore(STORES.BUSINESS_SETTINGS).put(b));
        addedCount++;
      }
      for (const s of payload.stores.invoiceNumberSequence) {
        await reqToPromise(tx.objectStore(STORES.INVOICE_SEQUENCE).put(s));
        addedCount++;
      }
      for (const cust of payload.stores.customers) {
        await reqToPromise(tx.objectStore(STORES.CUSTOMERS).put(cust));
        addedCount++;
      }
      for (const prod of payload.stores.products) {
        await reqToPromise(tx.objectStore(STORES.PRODUCTS).put(prod));
        addedCount++;
      }
      for (const inv of payload.stores.invoices) {
        await reqToPromise(tx.objectStore(STORES.INVOICES).put(inv));
        addedCount++;
      }
      for (const item of payload.stores.invoiceItems) {
        await reqToPromise(tx.objectStore(STORES.INVOICE_ITEMS).put(item));
        addedCount++;
      }
      for (const pay of payload.stores.payments) {
        await reqToPromise(tx.objectStore(STORES.PAYMENTS).put(pay));
        addedCount++;
      }
    } else {
      // Merge mode: prevent accidental duplicate records by ID & invoiceNumber
      const existingCustomers = (await reqToPromise(
        tx.objectStore(STORES.CUSTOMERS).getAll()
      )) as Customer[];
      const custIds = new Set(existingCustomers.map((c) => c.id));
      for (const cust of payload.stores.customers) {
        if (custIds.has(cust.id)) {
          skippedDuplicates++;
        } else {
          await reqToPromise(tx.objectStore(STORES.CUSTOMERS).put(cust));
          custIds.add(cust.id);
          addedCount++;
        }
      }

      const existingProducts = (await reqToPromise(
        tx.objectStore(STORES.PRODUCTS).getAll()
      )) as Product[];
      const prodIds = new Set(existingProducts.map((p) => p.id));
      for (const prod of payload.stores.products) {
        if (prodIds.has(prod.id)) {
          skippedDuplicates++;
        } else {
          await reqToPromise(tx.objectStore(STORES.PRODUCTS).put(prod));
          prodIds.add(prod.id);
          addedCount++;
        }
      }

      const existingInvoices = (await reqToPromise(
        tx.objectStore(STORES.INVOICES).getAll()
      )) as Invoice[];
      const invIds = new Set(existingInvoices.map((i) => i.id));
      const invNums = new Set(
        existingInvoices
          .filter((i) => i.status === 'finalized')
          .map((i) => i.invoiceNumber)
      );
      const importedInvIds = new Set<string>();

      for (const inv of payload.stores.invoices) {
        if (
          invIds.has(inv.id) ||
          (inv.status === 'finalized' && invNums.has(inv.invoiceNumber))
        ) {
          skippedDuplicates++;
        } else {
          await reqToPromise(tx.objectStore(STORES.INVOICES).put(inv));
          invIds.add(inv.id);
          if (inv.status === 'finalized') invNums.add(inv.invoiceNumber);
          importedInvIds.add(inv.id);
          addedCount++;
        }
      }

      const existingItems = (await reqToPromise(
        tx.objectStore(STORES.INVOICE_ITEMS).getAll()
      )) as InvoiceItem[];
      const itemIds = new Set(existingItems.map((it) => it.id));
      for (const item of payload.stores.invoiceItems) {
        if (itemIds.has(item.id) || !invIds.has(item.invoiceId)) {
          skippedDuplicates++;
        } else {
          await reqToPromise(tx.objectStore(STORES.INVOICE_ITEMS).put(item));
          itemIds.add(item.id);
          addedCount++;
        }
      }

      const existingPayments = (await reqToPromise(
        tx.objectStore(STORES.PAYMENTS).getAll()
      )) as PaymentRecord[];
      const payIds = new Set(existingPayments.map((p) => p.id));
      for (const pay of payload.stores.payments) {
        if (payIds.has(pay.id)) {
          skippedDuplicates++;
        } else {
          await reqToPromise(tx.objectStore(STORES.PAYMENTS).put(pay));
          payIds.add(pay.id);
          addedCount++;
        }
      }
    }

    // Recompute all customer balances cleanly to ensure zero drift
    const allCustomers = (await reqToPromise(
      tx.objectStore(STORES.CUSTOMERS).getAll()
    )) as Customer[];
    for (const c of allCustomers) {
      await recalculateCustomerBalanceInTx(tx, c);
    }

    await txDone(tx);
    await initializeDatabaseDefaults();
    return { addedCount, skippedDuplicates };
  } catch (err) {
    throw mapDbError(err, 'importing backup');
  }
}

export async function clearAllBusinessData(): Promise<void> {
  const db = await openDatabase();
  const storeNames = Object.values(STORES);
  const tx = db.transaction(storeNames, 'readwrite');
  for (const name of storeNames) {
    await reqToPromise(tx.objectStore(name).clear());
  }
  await txDone(tx);
  await initializeDatabaseDefaults();
}

export async function seedSampleVetPharmaProducts(): Promise<number> {
  const samples: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'Royal-Cal Gold Calcium Oral Suspension 1 Ltr',
      hsnCode: '23099090',
      batchNumber: 'RKV-2604A',
      mfgDate: '2026-04-01',
      expiryDate: '2028-03-31',
      purchasePrice: 185,
      sellingPrice: 245,
      mrp: 310,
      unit: 'Bottle',
      taxRate: 12,
      stockQty: 120,
    },
    {
      name: 'King-Mectin Ivermectin 1% Injection 100 ml',
      hsnCode: '30049099',
      batchNumber: 'RKV-2606B',
      mfgDate: '2026-06-10',
      expiryDate: '2028-05-31',
      purchasePrice: 140,
      sellingPrice: 195,
      mrp: 260,
      unit: 'Vial',
      taxRate: 12,
      stockQty: 85,
    },
    {
      name: 'Bovimin Forte Chelated Mineral Mixture 1 Kg',
      hsnCode: '23099010',
      batchNumber: 'RKV-2608C',
      mfgDate: '2026-08-15',
      expiryDate: '2028-07-31',
      purchasePrice: 155,
      sellingPrice: 215,
      mrp: 280,
      unit: 'Jar',
      taxRate: 5,
      stockQty: 60,
    },
    {
      name: 'Albendazole 3000 mg Vet Bolus (10x4 Strip)',
      hsnCode: '30049011',
      batchNumber: 'RKV-2605D',
      mfgDate: '2026-05-01',
      expiryDate: '2028-04-30',
      purchasePrice: 92,
      sellingPrice: 130,
      mrp: 175,
      unit: 'Box',
      taxRate: 12,
      stockQty: 95,
    },
    {
      name: 'Liv-King Herbal Liver Tonic 5 Ltr Can',
      hsnCode: '23099090',
      batchNumber: 'RKV-2609E',
      mfgDate: '2026-09-01',
      expiryDate: '2028-08-31',
      purchasePrice: 460,
      sellingPrice: 610,
      mrp: 780,
      unit: 'Tin',
      taxRate: 12,
      stockQty: 40,
    },
  ];

  const now = new Date().toISOString();
  const db = await openDatabase();
  const tx = db.transaction(STORES.PRODUCTS, 'readwrite');
  const store = tx.objectStore(STORES.PRODUCTS);
  for (const s of samples) {
    const p: Product = {
      ...s,
      id: generateId('prod'),
      createdAt: now,
      updatedAt: now,
    };
    await reqToPromise(store.put(p));
  }
  await txDone(tx);
  return samples.length;
}
