import React, { useMemo, useState } from 'react';
import { Download, Printer, Share2, X } from 'lucide-react';
import type { CompanyProfile, Invoice, InvoiceItem } from '../types/billing';
import {
  formatDateDisplay,
  formatMonthYear,
  formatNumber,
  round2,
} from '../utils/billingMath';
import {
  downloadInvoicePdfOffline,
  type PdfCopyMode,
  shareInvoiceWhatsApp,
} from '../utils/pdfGenerator';

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
      string,
      { hsn: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number }
    >();
    for (const it of items) {
      const key = `${it.hsnCode || '-'}_${it.taxRate}`;
      const prev = map.get(key) || {
        hsn: it.hsnCode || '-',
        rate: it.taxRate,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
      };
      map.set(key, {
        ...prev,
        taxable: round2(prev.taxable + it.taxableAmount),
        cgst: round2(prev.cgst + it.cgstAmount),
        sgst: round2(prev.sgst + it.sgstAmount),
        igst: round2(prev.igst + it.igstAmount),
      });
    }
    return Array.from(map.values());
  }, [items]);

  const companyAddr = [
    company.address,
    company.city ? `${company.city}${company.pincode ? ` (${company.pincode})` : ''}` : '',
    company.state,
  ]
    .filter(Boolean)
    .join(', ');

  const docTitle =
    invoice.invoiceTypeLabel || (invoice.totalGst > 0 ? 'TAX INVOICE' : 'BILL OF SUPPLY');
  const fillerRows = Math.max(0, 9 - items.length);

  return (
    <div className="print-page-break mx-auto w-full max-w-[794px] border border-slate-900 bg-white text-slate-950 shadow-sm print:shadow-none">
      {/* Top Header Block */}
      <div className="relative border-b border-slate-900 px-3 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2 text-[11px]">
          <div>
            <p className="font-mono font-bold">GSTIN : {company.gstin || '-'}</p>
            {company.dlNumber && (
              <p className="font-mono text-[10px] text-slate-700">
                D.L. No. : {company.dlNumber}
              </p>
            )}
          </div>
          <p className="italic text-slate-700">{copyLabel}</p>
        </div>

        <div className="mt-1 text-center">
          <p className="text-xs font-bold tracking-wide text-slate-900">{docTitle}</p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight text-slate-950">
            {company.companyName || 'ROYAL KING VET PHARMA'}
          </h2>
          <p className="mx-auto max-w-lg text-[11px] leading-snug text-slate-800">
            {companyAddr}
          </p>
          <p className="text-[11px] text-slate-800">
            Contact No : {company.phone}
            {company.email ? ` | ${company.email}` : ''}
          </p>
        </div>
      </div>

      {/* Invoice & Transport Metadata Row */}
      <div className="grid grid-cols-1 border-b border-slate-900 text-[11px] sm:grid-cols-12">
        <div className="space-y-0.5 border-b border-slate-900 px-3 py-1.5 sm:col-span-6 sm:border-b-0 sm:border-r">
          <div className="grid grid-cols-12">
            <span className="col-span-4 text-slate-700">Invoice No.</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-7 font-mono font-bold">{invoice.invoiceNumber}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-4 text-slate-700">Dated</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-7 font-mono font-semibold">
              {formatDateDisplay(invoice.invoiceDate)}
            </span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-4 text-slate-700">Place of Supply</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-7 font-semibold">
              {invoice.placeOfSupply} ({invoice.placeOfSupplyCode})
            </span>
          </div>
        </div>

        <div className="space-y-0.5 px-3 py-1.5 sm:col-span-6">
          <div className="grid grid-cols-12">
            <span className="col-span-4 text-slate-700">Transport</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-7 font-semibold">{invoice.transport || 'Self'}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-4 text-slate-700">Vehicle No.</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-7 font-mono">{invoice.vehicleNo || '-'}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-4 text-slate-700">Station</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-7 font-semibold">{invoice.station || '-'}</span>
          </div>
        </div>
      </div>

      {/* Billed To & Shipped To Row */}
      <div className="grid grid-cols-1 border-b border-slate-900 text-[11px] sm:grid-cols-12">
        <div className="flex flex-col justify-between border-b border-slate-900 px-3 py-2 sm:col-span-6 sm:border-b-0 sm:border-r">
          <div>
            <p className="font-bold italic">Billed To &nbsp;:</p>
            <p className="mt-0.5 text-xs font-bold uppercase text-slate-950">
              {invoice.customerName}
            </p>
            <p className="leading-snug text-slate-800">{invoice.customerAddress || '-'}</p>
          </div>
          <div className="mt-2.5 space-y-0.5">
            <div className="grid grid-cols-12">
              <span className="col-span-4 text-slate-700">Party Mobile No</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-7 font-mono">{invoice.customerMobile || '-'}</span>
            </div>
            <div className="grid grid-cols-12">
              <span className="col-span-4 text-slate-700">Party Pincode</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-7 font-mono">{invoice.customerPincode || '-'}</span>
            </div>
            <div className="grid grid-cols-12">
              <span className="col-span-4 text-slate-700">GSTIN / UIN</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-7 font-mono">{invoice.customerGstin || '-'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between px-3 py-2 sm:col-span-6">
          <div>
            <p className="font-bold italic">Shipped To &nbsp;:</p>
            <p className="mt-0.5 text-xs font-bold uppercase text-slate-950">
              {invoice.customerName}
            </p>
            <p className="leading-snug text-slate-800">
              {invoice.shippingAddress || invoice.customerAddress || '-'}
            </p>
          </div>
          <div className="mt-2.5 space-y-0.5">
            <div className="grid grid-cols-12">
              <span className="col-span-4 text-slate-700">Party Mobile No</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-7 font-mono">{invoice.customerMobile || '-'}</span>
            </div>
            <div className="grid grid-cols-12">
              <span className="col-span-4 text-slate-700">Party Pincode</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-7 font-mono">{invoice.customerPincode || '-'}</span>
            </div>
            <div className="grid grid-cols-12">
              <span className="col-span-4 text-slate-700">GSTIN / UIN</span>
              <span className="col-span-1 text-center">:</span>
              <span className="col-span-7 font-mono">{invoice.customerGstin || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Height Vertical-Column Product Table */}
      <div className="overflow-x-auto border-b border-slate-900">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-slate-900 bg-slate-100 text-slate-950">
              <th className="border-r border-slate-400 px-1.5 py-2 text-center font-bold">
                S No.
              </th>
              <th className="border-r border-slate-400 px-2 py-2 text-left font-bold">
                Description of Goods
              </th>
              <th className="border-r border-slate-400 px-1.5 py-2 text-center font-bold">
                HSN Code
              </th>
              <th className="border-r border-slate-400 px-1.5 py-2 text-center font-bold">
                Batch No.
              </th>
              <th className="border-r border-slate-400 px-1.5 py-2 text-center font-bold">
                Mfg. Date
              </th>
              <th className="border-r border-slate-400 px-1.5 py-2 text-center font-bold">
                Exp. Date
              </th>
              <th className="border-r border-slate-400 px-1.5 py-2 text-right font-bold">Qty.</th>
              <th className="border-r border-slate-400 px-1.5 py-2 text-left font-bold">Unit</th>
              <th className="border-r border-slate-400 px-1.5 py-2 text-right font-bold">
                Price
              </th>
              <th className="border-r border-slate-400 px-1.5 py-2 text-right font-bold">MRP</th>
              <th className="px-2 py-2 text-right font-bold">Amount in (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className="align-top">
                <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono tabular-nums">
                  {idx + 1}
                </td>
                <td className="border-r border-slate-400 px-2 py-1.5 font-bold text-slate-950">
                  <div>{item.productName}</div>
                  {item.taxRate > 0 && (
                    <div className="text-[10px] font-normal text-slate-600">
                      GST @ {item.taxRate}%
                      {item.discountPercent > 0 ? ` · Disc ${item.discountPercent}%` : ''}
                    </div>
                  )}
                </td>
                <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono">
                  {item.hsnCode || '-'}
                </td>
                <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono">
                  {item.batchNumber || '-'}
                </td>
                <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono">
                  {formatMonthYear(item.mfgDate)}
                </td>
                <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono">
                  {formatMonthYear(item.expiryDate)}
                </td>
                <td className="border-r border-slate-400 px-1.5 py-1.5 text-right font-mono tabular-nums">
                  {item.quantity}
                </td>
                <td className="border-r border-slate-400 px-1.5 py-1.5">{item.unit}</td>
                <td className="border-r border-slate-400 px-1.5 py-1.5 text-right font-mono tabular-nums">
                  {formatNumber(item.price)}
                </td>
                <td className="border-r border-slate-400 px-1.5 py-1.5 text-right font-mono tabular-nums">
                  {formatNumber(item.mrp)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums">
                  {formatNumber(item.taxableAmount)}
                </td>
              </tr>
            ))}
            {Array.from({ length: fillerRows }).map((_, idx) => (
              <tr key={`filler-${idx}`} className="h-6">
                <td className="border-r border-slate-400" />
                <td className="border-r border-slate-400" />
                <td className="border-r border-slate-400" />
                <td className="border-r border-slate-400" />
                <td className="border-r border-slate-400" />
                <td className="border-r border-slate-400" />
                <td className="border-r border-slate-400" />
                <td className="border-r border-slate-400" />
                <td className="border-r border-slate-400" />
                <td className="border-r border-slate-400" />
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grand Total Row */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-900 text-xs">
        <div className="px-3 py-1.5 text-[10.5px] text-slate-700">
          {(invoice.totalGst > 0 || invoice.roundOff !== 0) && (
            <span className="font-mono">
              Sub Total: {formatNumber(invoice.subtotalTaxable)}
              {invoice.taxType === 'intrastate'
                ? ` | CGST: ${formatNumber(invoice.totalCgst)} | SGST: ${formatNumber(invoice.totalSgst)}`
                : ` | IGST: ${formatNumber(invoice.totalIgst)}`}
              {invoice.roundOff !== 0 ? ` | Round Off: ${formatNumber(invoice.roundOff)}` : ''}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center">
          <span className="px-4 py-1.5 font-bold text-slate-900">Grand Total ₹</span>
          <span className="min-w-[115px] border-l border-slate-900 px-3 py-1.5 text-right font-mono text-sm font-extrabold tabular-nums">
            {formatNumber(invoice.grandTotal)}
          </span>
        </div>
      </div>

      {/* HSN/SAC Tax Summary + Amount in Words */}
      <div className="border-b border-slate-900 px-3 py-2.5">
        <div className="overflow-x-auto">
          <table className="w-full max-w-xl border-collapse text-[10.5px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-900">
                <th className="py-1 pr-3 text-left font-bold">HSN/SAC</th>
                <th className="py-1 pr-3 text-left font-bold">Tax Rate</th>
                <th className="py-1 pr-3 text-right font-bold">Taxable Amt.</th>
                <th className="py-1 pr-3 text-right font-bold">CGST Amt.</th>
                <th className="py-1 pr-3 text-right font-bold">SGST Amt.</th>
                <th className="py-1 pr-3 text-right font-bold">IGST Amt.</th>
                <th className="py-1 text-right font-bold">Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {taxBuckets.map((b, i) => {
                const totTax = round2(b.cgst + b.sgst + b.igst);
                return (
                  <tr key={`${b.hsn}-${b.rate}-${i}`}>
                    <td className="py-1 pr-3 font-mono">{b.hsn}</td>
                    <td className="py-1 pr-3 font-mono">
                      {b.rate === 0 ? 'Exempt' : `${b.rate}%`}
                    </td>
                    <td className="py-1 pr-3 text-right font-mono tabular-nums">
                      {formatNumber(b.taxable)}
                    </td>
                    <td className="py-1 pr-3 text-right font-mono tabular-nums">
                      {b.cgst > 0 ? formatNumber(b.cgst) : '--'}
                    </td>
                    <td className="py-1 pr-3 text-right font-mono tabular-nums">
                      {b.sgst > 0 ? formatNumber(b.sgst) : '--'}
                    </td>
                    <td className="py-1 pr-3 text-right font-mono tabular-nums">
                      {b.igst > 0 ? formatNumber(b.igst) : '--'}
                    </td>
                    <td className="py-1 text-right font-mono tabular-nums">
                      {formatNumber(totTax)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs font-bold text-slate-950">
          Amount in Words : {invoice.amountInWords}
        </p>
      </div>

      {/* Bank Details & Total Outstanding Band */}
      <div className="border-b border-slate-900">
        <div className="px-3 py-2 text-[11px]">
          <div className="flex flex-wrap gap-x-6 gap-y-0.5">
            <span className="font-bold">Bank Details :</span>
            <span>
              Bank Name : <strong>{company.bankName || '-'}</strong>
            </span>
            <span>
              Bank Branch : <strong>{company.branch || '-'}</strong>
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-6 gap-y-0.5 pl-0 sm:pl-24 font-mono text-[10.5px]">
            <span>Account No : {company.accountNumber || '-'}</span>
            <span>IFSC Code : {company.ifscCode || '-'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 px-3 py-1.5 text-xs">
          <div className="font-mono text-[11px] text-slate-700">
            Prev. Balance: Rs. {formatNumber(invoice.previousBalance)} &nbsp;|&nbsp; Payment
            Received ({invoice.paymentMode}): Rs. {formatNumber(invoice.paymentReceived)}
          </div>
          <div className="ml-auto flex items-center gap-4 font-bold text-slate-950">
            <span>Total Outstanding:</span>
            <span className="font-mono text-sm tabular-nums">
              {formatNumber(Math.abs(invoice.totalOutstanding))}{' '}
              {invoice.totalOutstanding >= 0 ? 'Dr' : 'Cr'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom 3-Zone Footer: Terms | Center Stamp | Signature & Company Seal */}
      <div className="grid grid-cols-1 text-[10.5px] sm:grid-cols-12">
        <div className="border-b border-slate-900 p-3 sm:col-span-5 sm:border-b-0 sm:border-r">
          <p className="inline-block border-b border-slate-800 font-bold text-slate-900">
            Terms &amp; Conditions
          </p>
          <p className="mt-1 font-semibold">E.&amp; O.E.</p>
          <p className="mt-0.5 whitespace-pre-line leading-relaxed text-slate-800">
            {company.termsAndConditions}
          </p>
        </div>

        <div className="flex items-center justify-center p-3 sm:col-span-3">
          <div className="rounded-lg border-2 border-double border-slate-900 px-3 py-2 text-center font-bold leading-tight text-slate-900">
            {invoice.totalGst === 0 ? (
              <>
                <p>ANIMAL FEED</p>
                <p>SUPPLEMENT</p>
                <div className="my-1 border-t border-slate-800" />
                <p>GST / TAX</p>
                <p>FREE ITEM</p>
              </>
            ) : (
              <>
                <p>VETERINARY</p>
                <p>PHARMACEUTICALS</p>
                <div className="my-1 border-t border-slate-800" />
                <p>GST TAXABLE</p>
                <p>SUPPLY</p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between p-3 text-right sm:col-span-4">
          <p className="text-xs font-bold text-slate-950">
            For {(company.companyName || 'ROYAL KING VET PHARMA').toUpperCase()}
          </p>
          <div className="my-2 text-center text-slate-500">
            <p className="text-xs font-bold tracking-wide uppercase">
              {company.companyName || 'ROYAL KING VET PHARMA'}
            </p>
            <p className="text-[10px]">
              {[company.address, company.city].filter(Boolean).join(', ')}
            </p>
          </div>
          <p className="text-xs font-bold text-slate-950">
            {company.authorizedSignatory || 'Authorised Signatory'}
          </p>
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
              copyLabel="Original Copy"
            />
          )}
          {(copyMode === 'both' || copyMode === 'duplicate') && (
            <InvoiceSheet
              company={company}
              invoice={invoice}
              items={items}
              copyLabel="Duplicate Copy"
            />
          )}
        </div>
      </div>
    </div>
  );
};
