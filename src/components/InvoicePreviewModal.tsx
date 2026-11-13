import React, { useMemo, useState } from 'react';
import { Download, Printer, Share2, X } from 'lucide-react';
import type { CompanyProfile, Invoice, InvoiceItem } from '../types/billing';
import { formatDateDisplay, formatINR, formatNumber, round2 } from '../utils/billingMath';
import {
  downloadInvoicePdfOffline,
  type PdfCopyMode,
  shareInvoiceWhatsApp,
} from '../utils/pdfGenerator';
import { BrandCrest, CompanyStampSvg } from './BrandMark';

interface InvoicePreviewModalProps {
  company: CompanyProfile;
  invoice: Invoice;
  items: InvoiceItem[];
  onClose: () => void;
  onNotify?: (msg: string) => void;
}

const InvoiceSheet: React.FC<{
  company: CompanyProfile;
  invoice: Invoice;
  items: InvoiceItem[];
  copyLabel: string;
}> = ({ company, invoice, items, copyLabel }) => {
  const taxBuckets = useMemo(() => {
    const map = new Map<
      number,
      { taxable: number; cgst: number; sgst: number; igst: number }
    >();
    for (const it of items) {
      const prev = map.get(it.taxRate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      map.set(it.taxRate, {
        taxable: round2(prev.taxable + it.taxableAmount),
        cgst: round2(prev.cgst + it.cgstAmount),
        sgst: round2(prev.sgst + it.sgstAmount),
        igst: round2(prev.igst + it.igstAmount),
      });
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [items]);

  const fullAddress = [company.address, company.city, `${company.state} - ${company.pincode}`]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="print-page-break mx-auto w-full max-w-[794px] border border-slate-800 bg-white text-slate-900 shadow-sm print:shadow-none">
      {/* Header Band */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-emerald-900 bg-emerald-50/60 p-4">
        <div className="flex items-start gap-3">
          <BrandCrest className="h-14 w-14 shrink-0" />
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-emerald-950">
              {company.companyName}
            </h2>
            <p className="text-xs font-medium text-slate-600">{company.tagline}</p>
            <p className="mt-1 max-w-md text-xs text-slate-700">{fullAddress}</p>
            <p className="mt-1 font-mono text-[11px] font-semibold text-slate-800">
              GSTIN: {company.gstin || '-'} &nbsp;|&nbsp; D.L. No.: {company.dlNumber || '-'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="inline-block rounded bg-emerald-900 px-3 py-1 text-xs font-bold tracking-wider text-white">
            TAX INVOICE
          </div>
          <div className="mt-1 border border-emerald-900 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-emerald-900">
            {copyLabel}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-700">Ph: {company.phone}</p>
          <p className="text-[11px] text-slate-700">{company.email}</p>
        </div>
      </div>

      {/* Customer & Invoice Info Grid */}
      <div className="grid grid-cols-1 border-b border-slate-400 sm:grid-cols-12">
        <div className="border-b border-slate-400 p-3 sm:col-span-7 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold tracking-wide text-emerald-900">
            BILLED TO (CUSTOMER)
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{invoice.customerName}</p>
          <p className="text-xs text-slate-700">{invoice.customerAddress || '-'}</p>
          <p className="mt-1 font-mono text-[11px] font-semibold text-slate-800">
            Mobile: {invoice.customerMobile || '-'} &nbsp;|&nbsp; GSTIN:{' '}
            {invoice.customerGstin || 'Unregistered'}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-700">
            <span className="font-bold text-slate-800">Shipped To: </span>
            {invoice.shippingAddress || invoice.customerAddress || '-'}
          </p>
        </div>

        <div className="space-y-1 p-3 text-xs sm:col-span-5">
          <div className="flex justify-between gap-2">
            <span className="text-slate-600">Invoice No.:</span>
            <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-600">Invoice Date:</span>
            <span className="font-mono font-semibold text-slate-900">
              {formatDateDisplay(invoice.invoiceDate)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-600">Place of Supply:</span>
            <span className="font-semibold text-slate-900">
              {invoice.placeOfSupply} ({invoice.placeOfSupplyCode})
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-600">Supply Type:</span>
            <span className="font-semibold text-slate-900">
              {invoice.taxType === 'intrastate' ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-600">Status:</span>
            <span className="font-bold text-emerald-900">
              {invoice.status === 'draft' ? 'DRAFT' : 'FINALIZED'}
            </span>
          </div>
        </div>
      </div>

      {/* Product Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-emerald-900 text-white">
              <th className="border-r border-emerald-800 px-1.5 py-2 text-center">#</th>
              <th className="border-r border-emerald-800 px-2 py-2 text-left">Product Name</th>
              <th className="border-r border-emerald-800 px-1.5 py-2 text-center">HSN</th>
              <th className="border-r border-emerald-800 px-1.5 py-2 text-center">Batch</th>
              <th className="border-r border-emerald-800 px-1.5 py-2 text-center">Mfg / Exp</th>
              <th className="border-r border-emerald-800 px-1.5 py-2 text-right">Qty</th>
              <th className="border-r border-emerald-800 px-1.5 py-2 text-right">MRP</th>
              <th className="border-r border-emerald-800 px-1.5 py-2 text-right">Rate</th>
              <th className="border-r border-emerald-800 px-1.5 py-2 text-right">Taxable</th>
              <th className="border-r border-emerald-800 px-1.5 py-2 text-right">GST</th>
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                <td className="border-b border-r border-slate-200 px-1.5 py-1.5 text-center font-mono tabular-nums">
                  {idx + 1}
                </td>
                <td className="border-b border-r border-slate-200 px-2 py-1.5 font-semibold text-slate-900">
                  {item.productName}
                </td>
                <td className="border-b border-r border-slate-200 px-1.5 py-1.5 text-center font-mono">
                  {item.hsnCode || '-'}
                </td>
                <td className="border-b border-r border-slate-200 px-1.5 py-1.5 text-center font-mono">
                  {item.batchNumber || '-'}
                </td>
                <td className="border-b border-r border-slate-200 px-1.5 py-1.5 text-center font-mono text-[10px]">
                  {(item.mfgDate || '-').slice(2, 7)} / {(item.expiryDate || '-').slice(2, 7)}
                </td>
                <td className="border-b border-r border-slate-200 px-1.5 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                  {item.quantity} {item.unit}
                </td>
                <td className="border-b border-r border-slate-200 px-1.5 py-1.5 text-right font-mono tabular-nums">
                  {formatNumber(item.mrp)}
                </td>
                <td className="border-b border-r border-slate-200 px-1.5 py-1.5 text-right font-mono tabular-nums">
                  {formatNumber(item.price)}
                </td>
                <td className="border-b border-r border-slate-200 px-1.5 py-1.5 text-right font-mono tabular-nums">
                  {formatNumber(item.taxableAmount)}
                </td>
                <td className="border-b border-r border-slate-200 px-1.5 py-1.5 text-right font-mono tabular-nums">
                  {item.taxRate}%
                </td>
                <td className="border-b border-slate-200 px-2 py-1.5 text-right font-mono font-bold tabular-nums">
                  {formatNumber(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tax Summary & Totals */}
      <div className="grid grid-cols-1 border-b border-slate-400 sm:grid-cols-12">
        <div className="border-b border-slate-400 p-3 sm:col-span-7 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold tracking-wide text-emerald-900">
            GST TAX BREAKDOWN SUMMARY
          </p>
          <table className="mt-1.5 w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-200 px-1.5 py-1 text-left">GST %</th>
                <th className="border border-slate-200 px-1.5 py-1 text-right">Taxable</th>
                <th className="border border-slate-200 px-1.5 py-1 text-right">CGST</th>
                <th className="border border-slate-200 px-1.5 py-1 text-right">SGST</th>
                <th className="border border-slate-200 px-1.5 py-1 text-right">IGST</th>
              </tr>
            </thead>
            <tbody>
              {taxBuckets.map(([rate, vals]) => (
                <tr key={rate}>
                  <td className="border border-slate-200 px-1.5 py-1 font-mono">{rate}%</td>
                  <td className="border border-slate-200 px-1.5 py-1 text-right font-mono tabular-nums">
                    {formatNumber(vals.taxable)}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1 text-right font-mono tabular-nums">
                    {formatNumber(vals.cgst)}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1 text-right font-mono tabular-nums">
                    {formatNumber(vals.sgst)}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1 text-right font-mono tabular-nums">
                    {formatNumber(vals.igst)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 border-t border-slate-200 pt-2">
            <p className="text-[10px] font-bold text-emerald-900">AMOUNT IN WORDS:</p>
            <p className="mt-0.5 text-xs font-bold text-slate-900">{invoice.amountInWords}</p>
          </div>
        </div>

        <div className="flex flex-col justify-between text-xs sm:col-span-5">
          <div className="space-y-1 p-3">
            <div className="flex justify-between">
              <span className="text-slate-600">Taxable Subtotal</span>
              <span className="font-mono tabular-nums">{formatINR(invoice.subtotalTaxable)}</span>
            </div>
            {invoice.taxType === 'intrastate' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total CGST</span>
                  <span className="font-mono tabular-nums">{formatINR(invoice.totalCgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total SGST</span>
                  <span className="font-mono tabular-nums">{formatINR(invoice.totalSgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-slate-600">Total IGST</span>
                <span className="font-mono tabular-nums">{formatINR(invoice.totalIgst)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600">Round Off</span>
              <span className="font-mono tabular-nums">{formatINR(invoice.roundOff)}</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between bg-emerald-900 px-3 py-2 text-sm font-bold text-white">
              <span>GRAND TOTAL</span>
              <span className="font-mono tabular-nums">{formatINR(invoice.grandTotal)}</span>
            </div>
            <div className="space-y-1 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Previous Balance</span>
                <span className="font-mono tabular-nums">
                  {formatINR(invoice.previousBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">
                  Payment Received ({invoice.paymentMode})
                </span>
                <span className="font-mono tabular-nums">
                  {formatINR(invoice.paymentReceived)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
                <span>TOTAL OUTSTANDING</span>
                <span className="font-mono tabular-nums">
                  {formatINR(invoice.totalOutstanding)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Details, Terms, Stamp & Signature */}
      <div className="grid grid-cols-1 sm:grid-cols-12">
        <div className="border-b border-slate-400 p-3 text-[11px] sm:col-span-7 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold text-emerald-900">BANK DETAILS FOR PAYMENT:</p>
          <p className="mt-0.5 text-slate-800">
            Bank: <strong>{company.bankName}</strong> &nbsp;|&nbsp; Branch: {company.branch}
          </p>
          <p className="font-mono text-[10.5px] text-slate-800">
            A/C Name: {company.accountName} &nbsp;|&nbsp; A/C No.: {company.accountNumber} &nbsp;|&nbsp;
            IFSC: {company.ifscCode}
          </p>
          <div className="mt-2 border-t border-slate-200 pt-1.5">
            <p className="text-[10px] font-bold text-emerald-900">TERMS &amp; CONDITIONS:</p>
            <p className="mt-0.5 whitespace-pre-line text-[10px] leading-relaxed text-slate-600">
              {company.termsAndConditions}
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between p-3 sm:col-span-5">
          <p className="text-right text-xs font-bold text-emerald-900">
            For {company.companyName}
          </p>
          <div className="my-2 flex items-center justify-between gap-2">
            <CompanyStampSvg companyName={company.companyName} />
            <div className="text-right">
              <div className="h-8" />
              <div className="border-t border-slate-500 pt-1 text-[11px] font-bold text-slate-900">
                {company.authorizedSignatory || 'Authorized Signatory'}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">Receiver&apos;s Signature</p>
        </div>
      </div>
    </div>
  );
};

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  company,
  invoice,
  items,
  onClose,
  onNotify,
}) => {
  const [copyMode, setCopyMode] = useState<PdfCopyMode>('both');
  const [sharing, setSharing] = useState(false);

  const handleDownloadPdf = () => {
    downloadInvoicePdfOffline(company, invoice, items, copyMode);
    onNotify?.(`PDF downloaded offline (${invoice.invoiceNumber})`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    setSharing(true);
    try {
      const result = await shareInvoiceWhatsApp(company, invoice, items);
      if (result === 'shared_file') {
        onNotify?.('Invoice PDF shared');
      } else {
        onNotify?.('Opened WhatsApp invoice summary');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/75 backdrop-blur-xs print:static print:bg-white print:p-0">
      {/* Action Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold sm:text-base">
            Invoice Preview · <span className="font-mono">{invoice.invoiceNumber}</span>
          </h3>
          <div className="hidden items-center gap-1 rounded-lg bg-slate-800 p-1 sm:flex">
            {(['both', 'original', 'duplicate'] as PdfCopyMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCopyMode(mode)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                  copyMode === mode
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {mode === 'both' ? 'Original + Duplicate' : `${mode} Copy`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Download PDF</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-600 transition whitespace-nowrap"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={sharing}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-green-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50 transition whitespace-nowrap"
          >
            <Share2 className="h-4 w-4" />
            <span>{sharing ? 'Preparing...' : 'WhatsApp'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            aria-label="Close invoice preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile Copy Mode Selector */}
      <div className="no-print flex items-center justify-center gap-1 border-b border-slate-800 bg-slate-900/90 px-4 py-2 sm:hidden">
        {(['both', 'original', 'duplicate'] as PdfCopyMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setCopyMode(mode)}
            className={`min-h-[36px] flex-1 rounded-lg px-2 text-xs font-medium transition ${
              copyMode === mode ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {mode === 'both' ? 'Both Copies' : `${mode === 'original' ? 'Original' : 'Duplicate'}`}
          </button>
        ))}
      </div>

      {/* Scrollable A4 Preview Area */}
      <div className="print-only-container flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="space-y-8 print:space-y-0">
          {(copyMode === 'both' || copyMode === 'original') && (
            <InvoiceSheet
              company={company}
              invoice={invoice}
              items={items}
              copyLabel="ORIGINAL FOR RECIPIENT"
            />
          )}
          {(copyMode === 'both' || copyMode === 'duplicate') && (
            <InvoiceSheet
              company={company}
              invoice={invoice}
              items={items}
              copyLabel="DUPLICATE FOR OFFICE / TRANSPORTER"
            />
          )}
        </div>
      </div>
    </div>
  );
};
