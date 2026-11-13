import type { InvoiceItem, TaxType } from '../types/billing';

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatNumber(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function determineTaxType(companyStateCode: string, placeOfSupplyCode: string): TaxType {
  if (!companyStateCode || !placeOfSupplyCode) return 'intrastate';
  return companyStateCode.trim() === placeOfSupplyCode.trim() ? 'intrastate' : 'interstate';
}

export interface DraftLineInput {
  id: string;
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
  taxRate: number;
}

export function calculateInvoiceItem(
  item: DraftLineInput,
  invoiceId: string,
  taxType: TaxType
): InvoiceItem {
  const qty = Math.max(0, Number(item.quantity) || 0);
  const price = Math.max(0, Number(item.price) || 0);
  const disc = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
  const taxRate = Math.max(0, Number(item.taxRate) || 0);

  const gross = qty * price;
  const taxableAmount = round2(gross * (1 - disc / 100));
  const gstAmount = round2((taxableAmount * taxRate) / 100);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (taxType === 'intrastate') {
    cgstAmount = round2(gstAmount / 2);
    sgstAmount = round2(gstAmount - cgstAmount);
  } else {
    igstAmount = gstAmount;
  }

  const lineTotal = round2(taxableAmount + cgstAmount + sgstAmount + igstAmount);

  return {
    id: item.id,
    invoiceId,
    productId: item.productId,
    productName: item.productName,
    hsnCode: item.hsnCode,
    batchNumber: item.batchNumber,
    mfgDate: item.mfgDate,
    expiryDate: item.expiryDate,
    quantity: qty,
    unit: item.unit,
    price,
    mrp: Math.max(0, Number(item.mrp) || 0),
    discountPercent: disc,
    taxableAmount,
    taxRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstAmount: round2(cgstAmount + sgstAmount + igstAmount),
    lineTotal,
  };
}

export interface InvoiceTotalsSummary {
  subtotalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  exactTotal: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
}

export function calculateInvoiceTotals(
  items: InvoiceItem[],
  autoRoundOff: boolean = true
): InvoiceTotalsSummary {
  const subtotalTaxable = round2(items.reduce((sum, it) => sum + it.taxableAmount, 0));
  const totalCgst = round2(items.reduce((sum, it) => sum + it.cgstAmount, 0));
  const totalSgst = round2(items.reduce((sum, it) => sum + it.sgstAmount, 0));
  const totalIgst = round2(items.reduce((sum, it) => sum + it.igstAmount, 0));
  const totalGst = round2(totalCgst + totalSgst + totalIgst);
  const exactTotal = round2(subtotalTaxable + totalGst);

  const grandTotal = autoRoundOff ? Math.round(exactTotal) : exactTotal;
  const roundOff = round2(grandTotal - exactTotal);
  const amountInWords = numberToIndianWords(grandTotal);

  return {
    subtotalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    totalGst,
    exactTotal,
    roundOff,
    grandTotal,
    amountInWords,
  };
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigitsToWords(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return one ? `${TENS[ten]} ${ONES[one]}` : TENS[ten];
}

function integerToIndianWords(num: number): string {
  if (num === 0) return 'Zero';
  let n = Math.floor(Math.abs(num));
  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  const rest = n % 100;

  if (crore > 0) parts.push(`${integerToIndianWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (hundred > 0) parts.push(`${ONES[hundred]} Hundred`);
  if (rest > 0) parts.push(twoDigitsToWords(rest));

  return parts.join(' ').trim();
}

export function numberToIndianWords(amount: number): string {
  const safe = Math.max(0, round2(Number(amount) || 0));
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);

  if (rupees === 0 && paise === 0) {
    return 'Rupees Zero Only';
  }

  let result = `Rupees ${integerToIndianWords(rupees)}`;
  if (paise > 0) {
    result += ` and ${twoDigitsToWords(paise)} Paise`;
  }
  return `${result} Only`;
}

export function formatInvoiceNumber(prefix: string, financialYear: string, seqNum: number, padding: number = 4): string {
  const fyShort = financialYear.replace(/[^0-9]/g, '').slice(0, 4) || '2627';
  const numStr = String(seqNum).padStart(padding, '0');
  return `${prefix.toUpperCase()}-${fyShort}-${numStr}`;
}
