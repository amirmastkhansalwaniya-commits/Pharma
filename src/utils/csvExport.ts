import type {
  Customer,
  Invoice,
  OutstandingBalance,
  PaymentRecord,
  Product,
} from '../types/billing';
import { todayISO } from './billingMath';

function escapeCsvCell(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCustomersCSV(
  customers: Customer[],
  balancesMap: Map<string, OutstandingBalance>
): void {
  const headers = [
    'Customer ID',
    'Customer Name',
    'Mobile',
    'Email',
    'GSTIN',
    'Address',
    'Shipping Address',
    'State',
    'State Code',
    'Opening Balance (INR)',
    'Total Invoiced (INR)',
    'Total Paid (INR)',
    'Current Outstanding (INR)',
    'Created At',
  ];

  const rows = customers.map((c) => {
    const bal = balancesMap.get(c.id);
    return [
      c.id,
      c.name,
      c.mobile,
      c.email,
      c.gstin,
      c.address,
      c.shippingAddress,
      c.state,
      c.stateCode,
      c.openingBalance.toFixed(2),
      (bal?.totalInvoiced ?? 0).toFixed(2),
      (bal?.totalPaid ?? 0).toFixed(2),
      (bal?.currentBalance ?? c.openingBalance).toFixed(2),
      c.createdAt,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  const csv = [headers.join(','), ...rows].join('\r\n');
  downloadFile(csv, `RKVP-Customers-${todayISO()}.csv`, 'text/csv;charset=utf-8;');
}

export function exportProductsCSV(products: Product[]): void {
  const headers = [
    'Product ID',
    'Product Name',
    'HSN Code',
    'Batch Number',
    'Mfg Date',
    'Expiry Date',
    'Purchase Price (INR)',
    'Selling Price (INR)',
    'MRP (INR)',
    'Unit',
    'GST Rate (%)',
    'Stock Qty',
    'Updated At',
  ];

  const rows = products.map((p) =>
    [
      p.id,
      p.name,
      p.hsnCode,
      p.batchNumber,
      p.mfgDate,
      p.expiryDate,
      p.purchasePrice.toFixed(2),
      p.sellingPrice.toFixed(2),
      p.mrp.toFixed(2),
      p.unit,
      p.taxRate,
      p.stockQty,
      p.updatedAt,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\r\n');
  downloadFile(csv, `RKVP-Products-${todayISO()}.csv`, 'text/csv;charset=utf-8;');
}

export function exportInvoicesCSV(invoices: Invoice[]): void {
  const headers = [
    'Invoice Number',
    'Invoice Date',
    'Status',
    'Customer Name',
    'Customer Mobile',
    'Customer GSTIN',
    'Place of Supply',
    'Tax Type',
    'Taxable Amount (INR)',
    'CGST (INR)',
    'SGST (INR)',
    'IGST (INR)',
    'Total GST (INR)',
    'Round Off (INR)',
    'Grand Total (INR)',
    'Previous Balance (INR)',
    'Payment Received (INR)',
    'Payment Mode',
    'Total Outstanding (INR)',
  ];

  const rows = invoices.map((inv) =>
    [
      inv.invoiceNumber,
      inv.invoiceDate,
      inv.status.toUpperCase(),
      inv.customerName,
      inv.customerMobile,
      inv.customerGstin,
      `${inv.placeOfSupply} (${inv.placeOfSupplyCode})`,
      inv.taxType,
      inv.subtotalTaxable.toFixed(2),
      inv.totalCgst.toFixed(2),
      inv.totalSgst.toFixed(2),
      inv.totalIgst.toFixed(2),
      inv.totalGst.toFixed(2),
      inv.roundOff.toFixed(2),
      inv.grandTotal.toFixed(2),
      inv.previousBalance.toFixed(2),
      inv.paymentReceived.toFixed(2),
      inv.paymentMode,
      inv.totalOutstanding.toFixed(2),
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\r\n');
  downloadFile(csv, `RKVP-Invoices-${todayISO()}.csv`, 'text/csv;charset=utf-8;');
}

export function exportPaymentsCSV(payments: PaymentRecord[]): void {
  const headers = [
    'Payment ID',
    'Payment Date',
    'Customer Name',
    'Invoice Number',
    'Payment Type',
    'Payment Mode',
    'Amount (INR)',
    'Reference Number',
    'Notes',
    'Recorded At',
  ];

  const rows = payments.map((p) =>
    [
      p.id,
      p.paymentDate,
      p.customerName,
      p.invoiceNumber || '-',
      p.type === 'invoice_initial' ? 'Invoice Payment' : 'Balance Settlement',
      p.paymentMode,
      p.amount.toFixed(2),
      p.referenceNumber,
      p.notes,
      p.createdAt,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\r\n');
  downloadFile(csv, `RKVP-Payments-${todayISO()}.csv`, 'text/csv;charset=utf-8;');
}

export function downloadJSONBackup(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, filename, 'application/json;charset=utf-8;');
}
