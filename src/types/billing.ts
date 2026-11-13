export type AppRoute =
  | 'home'
  | 'new-bill'
  | 'invoices'
  | 'customers'
  | 'products'
  | 'payments'
  | 'settings';

export type InvoiceStatus = 'draft' | 'finalized';
export type TaxType = 'intrastate' | 'interstate';
export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card';

export interface CompanyProfile {
  id: 'primary';
  companyName: string;
  tagline: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  phone: string;
  email: string;
  gstin: string;
  dlNumber: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  termsAndConditions: string;
  authorizedSignatory: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string;
  address: string;
  shippingAddress: string;
  pincode?: string;
  state: string;
  stateCode: string;
  gstin: string;
  openingBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  hsnCode: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  unit: string;
  taxRate: number;
  stockQty: number;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  invoiceTypeLabel?: 'TAX INVOICE' | 'BILL OF SUPPLY';
  transport?: string;
  vehicleNo?: string;
  station?: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  shippingAddress: string;
  customerPincode?: string;
  customerMobile: string;
  customerGstin: string;
  status: InvoiceStatus;
  taxType: TaxType;
  subtotalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  previousBalance: number;
  paymentReceived: number;
  paymentMode: PaymentMode;
  totalOutstanding: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  productName: string;
  hsnCode: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  price: number;
  mrp: number;
  discountPercent: number;
  taxableAmount: number;
  taxRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  lineTotal: number;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  paymentDate: string;
  paymentMode: PaymentMode;
  referenceNumber: string;
  notes: string;
  type: 'invoice_initial' | 'settlement';
  createdAt: string;
}

export interface OutstandingBalance {
  customerId: string;
  customerName: string;
  openingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  currentBalance: number;
  lastInvoiceDate?: string;
  lastPaymentDate?: string;
  updatedAt: string;
}

export interface BusinessSettings {
  id: 'primary';
  invoicePrefix: string;
  financialYear: string;
  defaultPlaceOfSupply: string;
  defaultPlaceOfSupplyCode: string;
  defaultTaxRate: number;
  autoRoundOff: boolean;
  pinEnabled: boolean;
  pinHash: string;
  autoLockMinutes: number;
  lastBackupAt: string | null;
  backupReminderDays: number;
  theme: 'light' | 'dark';
  updatedAt: string;
}

export interface InvoiceNumberSequence {
  id: 'primary';
  prefix: string;
  nextNumber: number;
  padding: number;
  updatedAt: string;
}

export interface CompleteBackupPayload {
  appName: 'ROYAL KING VET PHARMA';
  schemaVersion: number;
  exportedAt: string;
  stores: {
    companyProfile: CompanyProfile[];
    customers: Customer[];
    products: Product[];
    invoices: Invoice[];
    invoiceItems: InvoiceItem[];
    payments: PaymentRecord[];
    outstandingBalances: OutstandingBalance[];
    businessSettings: BusinessSettings[];
    invoiceNumberSequence: InvoiceNumberSequence[];
  };
}
