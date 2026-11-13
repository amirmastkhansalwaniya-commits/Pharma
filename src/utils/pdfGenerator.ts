import { jsPDF } from 'jspdf';
import type { CompanyProfile, Invoice, InvoiceItem } from '../types/billing';
import { formatDateDisplay, round2 } from './billingMath';

export type PdfCopyMode = 'both' | 'original' | 'duplicate';

function pdfAmt(val: number): string {
  const n = Number.isFinite(val) ? val : 0;
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pdfRs(val: number): string {
  return `Rs. ${pdfAmt(val)}`;
}

function drawCompanyCrest(doc: jsPDF, x: number, y: number, size: number) {
  // Emerald rounded square crest
  doc.setFillColor(15, 76, 58);
  doc.roundedRect(x, y, size, size, 2.5, 2.5, 'F');

  // Gold crown polygon approximation using triangles
  doc.setFillColor(232, 185, 49);
  const cx = x + size / 2;
  const topY = y + size * 0.16;
  const baseY = y + size * 0.36;
  doc.triangle(cx - size * 0.28, baseY, cx - size * 0.22, topY + 1, cx - size * 0.08, baseY, 'F');
  doc.triangle(cx - size * 0.12, baseY, cx, topY, cx + size * 0.12, baseY, 'F');
  doc.triangle(cx + size * 0.08, baseY, cx + size * 0.22, topY + 1, cx + size * 0.28, baseY, 'F');
  doc.rect(cx - size * 0.28, baseY, size * 0.56, size * 0.06, 'F');

  // White veterinary cross
  doc.setFillColor(255, 255, 255);
  const crossTop = y + size * 0.48;
  const crossH = size * 0.38;
  const crossW = size * 0.14;
  doc.rect(cx - crossW / 2, crossTop, crossW, crossH, 'F');
  doc.rect(cx - crossH / 2, crossTop + (crossH - crossW) / 2, crossH, crossW, 'F');
}

function drawCompanyStamp(doc: jsPDF, cx: number, cy: number, companyName: string) {
  doc.saveGraphicsState();
  doc.setDrawColor(15, 76, 58);
  doc.setTextColor(15, 76, 58);

  doc.setLineWidth(0.6);
  doc.circle(cx, cy, 12.5, 'S');
  doc.setLineWidth(0.25);
  doc.circle(cx, cy, 10.2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  const shortTitle = companyName.length > 22 ? companyName.slice(0, 22) : companyName;
  doc.text(shortTitle, cx, cy - 4.2, { align: 'center' });

  doc.setFontSize(6);
  doc.text('AUTHORIZED', cx, cy + 0.8, { align: 'center' });
  doc.setFontSize(5);
  doc.text('COMPANY SEAL', cx, cy + 4.8, { align: 'center' });

  doc.restoreGraphicsState();
}

function renderInvoiceCopyPage(
  doc: jsPDF,
  company: CompanyProfile,
  invoice: Invoice,
  items: InvoiceItem[],
  copyLabel: string,
  isFirstPageOfDoc: boolean
) {
  if (!isFirstPageOfDoc) {
    doc.addPage();
  }

  const pageWidth = 210;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm

  const drawOuterBorder = () => {
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.35);
    doc.rect(margin, margin, contentWidth, 277);
  };

  drawOuterBorder();

  // Header band
  let y = margin;
  doc.setFillColor(244, 248, 246);
  doc.rect(margin, y, contentWidth, 30, 'F');
  doc.setDrawColor(15, 76, 58);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 30, margin + contentWidth, y + 30);

  drawCompanyCrest(doc, margin + 4, y + 5, 19);

  // Company Title & Details
  doc.setTextColor(15, 76, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(company.companyName || 'ROYAL KING VET PHARMA', margin + 27, y + 9.5);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(company.tagline || 'Veterinary Pharmaceuticals & Animal Healthcare', margin + 27, y + 14);

  const addrLine = [company.address, company.city, `${company.state} - ${company.pincode}`]
    .filter(Boolean)
    .join(', ');
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(7.5);
  const addrLines = doc.splitTextToSize(addrLine, 102);
  doc.text(addrLines.slice(0, 2), margin + 27, y + 18.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(
    `GSTIN: ${company.gstin || '-'}   |   D.L. No.: ${company.dlNumber || '-'}`,
    margin + 27,
    y + 26.8
  );

  // Top-right Tax Invoice + Copy Badge
  doc.setFillColor(15, 76, 58);
  doc.roundedRect(margin + contentWidth - 54, y + 3.5, 50, 7, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('TAX INVOICE', margin + contentWidth - 29, y + 8.3, { align: 'center' });

  doc.setDrawColor(15, 76, 58);
  doc.setLineWidth(0.3);
  doc.rect(margin + contentWidth - 54, y + 12, 50, 6.2);
  doc.setTextColor(15, 76, 58);
  doc.setFontSize(6.8);
  doc.text(copyLabel, margin + contentWidth - 29, y + 16.1, { align: 'center' });

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Ph: ${company.phone}`, margin + contentWidth - 4, y + 23, { align: 'right' });
  doc.text(company.email, margin + contentWidth - 4, y + 27, { align: 'right' });

  // Customer & Invoice Metadata Box
  y += 30;
  const metaHeight = 32;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.line(margin + 108, y, margin + 108, y + metaHeight);
  doc.line(margin, y + metaHeight, margin + contentWidth, y + metaHeight);

  // Left: Billed To & Shipped To
  doc.setTextColor(15, 76, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('BILLED TO (CUSTOMER):', margin + 3, y + 4.5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.text(invoice.customerName || 'Walk-in Customer', margin + 3, y + 9.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  const custAddr = doc.splitTextToSize(invoice.customerAddress || '-', 100);
  doc.text(custAddr.slice(0, 2), margin + 3, y + 13.5);

  doc.setFont('helvetica', 'bold');
  doc.text(
    `Mobile: ${invoice.customerMobile || '-'}    |    GSTIN: ${invoice.customerGstin || 'Unregistered'}`,
    margin + 3,
    y + 22
  );

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('SHIPPED TO:', margin + 3, y + 26.2);
  doc.setFont('helvetica', 'normal');
  const shipAddr = doc.splitTextToSize(
    invoice.shippingAddress || invoice.customerAddress || '-',
    82
  );
  doc.text(shipAddr[0] || '-', margin + 21, y + 26.2);

  // Right: Invoice Meta
  const rx = margin + 111;
  const labelW = 30;
  const metaRows: [string, string][] = [
    ['Invoice No.:', invoice.invoiceNumber],
    ['Invoice Date:', formatDateDisplay(invoice.invoiceDate)],
    ['Place of Supply:', `${invoice.placeOfSupply} (${invoice.placeOfSupplyCode})`],
    [
      'Supply Type:',
      invoice.taxType === 'intrastate' ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)',
    ],
    ['Status:', invoice.status === 'draft' ? 'DRAFT COPY' : 'FINAL TAX INVOICE'],
  ];

  metaRows.forEach(([lbl, val], idx) => {
    const ry = y + 5.5 + idx * 5.6;
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(lbl, rx, ry);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(val, rx + labelW, ry);
  });

  // Product Table Header
  y += metaHeight;
  const cols = [
    { label: '#', w: 6, align: 'center' as const },
    { label: 'Product Description', w: 40, align: 'left' as const },
    { label: 'HSN', w: 14, align: 'center' as const },
    { label: 'Batch No.', w: 17, align: 'center' as const },
    { label: 'Mfg / Exp', w: 20, align: 'center' as const },
    { label: 'Qty', w: 16, align: 'right' as const },
    { label: 'MRP', w: 15, align: 'right' as const },
    { label: 'Rate', w: 15, align: 'right' as const },
    { label: 'Taxable', w: 17, align: 'right' as const },
    { label: 'GST', w: 11, align: 'right' as const },
    { label: 'Total', w: 19, align: 'right' as const },
  ]; // total = 190mm

  const drawTableHeader = (startY: number) => {
    doc.setFillColor(15, 76, 58);
    doc.rect(margin, startY, contentWidth, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);

    let cx = margin;
    for (const col of cols) {
      const tx =
        col.align === 'center'
          ? cx + col.w / 2
          : col.align === 'right'
            ? cx + col.w - 1.5
            : cx + 1.5;
      doc.text(col.label, tx, startY + 5, { align: col.align });
      cx += col.w;
    }
    return startY + 7.5;
  };

  y = drawTableHeader(y);

  // Table Rows
  items.forEach((item, index) => {
    const nameLines = doc.splitTextToSize(item.productName || '-', cols[1].w - 3);
    const rowH = Math.max(8.2, nameLines.length * 3.5 + 3.2);

    if (y + rowH > 220) {
      // Continue onto next page
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Continued on next page...', margin + contentWidth - 3, 282, { align: 'right' });

      doc.addPage();
      drawOuterBorder();
      doc.setFillColor(244, 248, 246);
      doc.rect(margin, margin, contentWidth, 12, 'F');
      doc.setTextColor(15, 76, 58);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(
        `${company.companyName} — Invoice ${invoice.invoiceNumber} (${copyLabel}) [Cont.]`,
        margin + 4,
        margin + 7.8
      );
      y = drawTableHeader(margin + 12);
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowH, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + contentWidth, y + rowH);

    // Vertical dividers
    let vx = margin;
    for (let c = 0; c < cols.length - 1; c++) {
      vx += cols[c].w;
      doc.line(vx, y, vx, y + rowH);
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);

    const mfgShort = item.mfgDate ? item.mfgDate.slice(2, 7) : '-';
    const expShort = item.expiryDate ? item.expiryDate.slice(2, 7) : '-';

    let cx = margin;
    // #
    doc.text(String(index + 1), cx + cols[0].w / 2, y + 4.5, { align: 'center' });
    cx += cols[0].w;
    // Product Name
    doc.setFont('helvetica', 'bold');
    doc.text(nameLines, cx + 1.5, y + 4.2);
    doc.setFont('helvetica', 'normal');
    cx += cols[1].w;
    // HSN
    doc.text(item.hsnCode || '-', cx + cols[2].w / 2, y + 4.5, { align: 'center' });
    cx += cols[2].w;
    // Batch
    doc.text(item.batchNumber || '-', cx + cols[3].w / 2, y + 4.5, { align: 'center' });
    cx += cols[3].w;
    // Mfg / Exp
    doc.setFontSize(6.2);
    doc.text(`${mfgShort} / ${expShort}`, cx + cols[4].w / 2, y + 4.5, { align: 'center' });
    doc.setFontSize(6.8);
    cx += cols[4].w;
    // Qty + Unit
    doc.text(`${item.quantity} ${item.unit}`, cx + cols[5].w - 1.5, y + 4.5, { align: 'right' });
    cx += cols[5].w;
    // MRP
    doc.text(pdfAmt(item.mrp), cx + cols[6].w - 1.5, y + 4.5, { align: 'right' });
    cx += cols[6].w;
    // Rate
    doc.text(pdfAmt(item.price), cx + cols[7].w - 1.5, y + 4.5, { align: 'right' });
    cx += cols[7].w;
    // Taxable
    doc.text(pdfAmt(item.taxableAmount), cx + cols[8].w - 1.5, y + 4.5, { align: 'right' });
    cx += cols[8].w;
    // GST %
    doc.text(`${item.taxRate}%`, cx + cols[9].w - 1.5, y + 4.5, { align: 'right' });
    cx += cols[9].w;
    // Total
    doc.setFont('helvetica', 'bold');
    doc.text(pdfAmt(item.lineTotal), cx + cols[10].w - 1.5, y + 4.5, { align: 'right' });
  });

  // Ensure bottom summary sits cleanly at the lower half of the page
  const summaryStartY = Math.max(y + 4, 186);
  if (summaryStartY > 218) {
    doc.addPage();
    drawOuterBorder();
    y = margin + 4;
  } else {
    y = summaryStartY;
  }

  // Tax Summary Breakdown + Grand Totals Box
  const leftW = 112;
  const rightW = contentWidth - leftW; // 78mm
  const boxH = 54;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  doc.line(margin + leftW, y, margin + leftW, y + boxH);
  doc.line(margin, y + boxH, margin + contentWidth, y + boxH);

  // Left Side: Tax Rate Summary Table + Amount in Words
  let ly = y + 4;
  doc.setTextColor(15, 76, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('GST TAX BREAKDOWN SUMMARY', margin + 3, ly);

  // Group items by taxRate
  const taxBuckets = new Map<
    number,
    { taxable: number; cgst: number; sgst: number; igst: number }
  >();
  for (const it of items) {
    const prev = taxBuckets.get(it.taxRate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    taxBuckets.set(it.taxRate, {
      taxable: round2(prev.taxable + it.taxableAmount),
      cgst: round2(prev.cgst + it.cgstAmount),
      sgst: round2(prev.sgst + it.sgstAmount),
      igst: round2(prev.igst + it.igstAmount),
    });
  }

  ly += 2;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin + 3, ly, leftW - 6, 5, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(6.5);
  doc.text('GST %', margin + 5, ly + 3.6);
  doc.text('Taxable', margin + 32, ly + 3.6, { align: 'right' });
  doc.text('CGST', margin + 54, ly + 3.6, { align: 'right' });
  doc.text('SGST', margin + 76, ly + 3.6, { align: 'right' });
  doc.text('IGST', margin + 105, ly + 3.6, { align: 'right' });

  ly += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  Array.from(taxBuckets.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 4)
    .forEach(([rate, vals]) => {
      ly += 4.3;
      doc.text(`${rate}%`, margin + 5, ly);
      doc.text(pdfAmt(vals.taxable), margin + 32, ly, { align: 'right' });
      doc.text(pdfAmt(vals.cgst), margin + 54, ly, { align: 'right' });
      doc.text(pdfAmt(vals.sgst), margin + 76, ly, { align: 'right' });
      doc.text(pdfAmt(vals.igst), margin + 105, ly, { align: 'right' });
    });

  // Amount in Words
  const wordsY = y + 32;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, wordsY - 3, margin + leftW, wordsY - 3);
  doc.setTextColor(15, 76, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('AMOUNT IN WORDS:', margin + 3, wordsY + 1);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  const wordsWrapped = doc.splitTextToSize(invoice.amountInWords || '-', leftW - 6);
  doc.text(wordsWrapped.slice(0, 3), margin + 3, wordsY + 5.5);

  // Right Side: Totals & Balance
  const rStart = margin + leftW + 3;
  const rEnd = margin + contentWidth - 3;
  let ry = y + 5;

  const drawTotalRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 8 : 7.4);
    doc.setTextColor(bold ? 15 : 51, bold ? 23 : 65, bold ? 42 : 85);
    doc.text(label, rStart, ry);
    doc.text(value, rEnd, ry, { align: 'right' });
    ry += 5.2;
  };

  drawTotalRow('Taxable Subtotal:', pdfRs(invoice.subtotalTaxable));
  if (invoice.taxType === 'intrastate') {
    drawTotalRow('Total CGST:', pdfRs(invoice.totalCgst));
    drawTotalRow('Total SGST:', pdfRs(invoice.totalSgst));
  } else {
    drawTotalRow('Total IGST:', pdfRs(invoice.totalIgst));
  }
  drawTotalRow('Round Off:', pdfRs(invoice.roundOff));

  // Grand Total Highlight Band
  doc.setFillColor(15, 76, 58);
  doc.rect(margin + leftW, ry - 3.5, rightW, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('GRAND TOTAL', rStart, ry + 1.5);
  doc.text(pdfRs(invoice.grandTotal), rEnd, ry + 1.5, { align: 'right' });
  ry += 9.5;

  drawTotalRow('Previous Balance:', pdfRs(invoice.previousBalance));
  drawTotalRow(`Payment Received (${invoice.paymentMode}):`, pdfRs(invoice.paymentReceived));

  // Total Outstanding Highlight
  doc.setFillColor(241, 245, 249);
  doc.rect(margin + leftW, ry - 3.5, rightW, 7.5, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TOTAL OUTSTANDING:', rStart, ry + 1.5);
  doc.text(pdfRs(invoice.totalOutstanding), rEnd, ry + 1.5, { align: 'right' });

  // Bank Details, Terms & Conditions + Signature/Stamp
  y += boxH;
  const footerH = 287 - y;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin + leftW, y, margin + leftW, y + footerH);

  // Left: Bank Details + Terms
  doc.setTextColor(15, 76, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('BANK DETAILS FOR PAYMENT:', margin + 3, y + 4.5);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `Bank: ${company.bankName}  |  Branch: ${company.branch}`,
    margin + 3,
    y + 8.8
  );
  doc.text(
    `A/C Name: ${company.accountName}  |  A/C No.: ${company.accountNumber}  |  IFSC: ${company.ifscCode}`,
    margin + 3,
    y + 12.6
  );

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y + 15.5, margin + leftW, y + 15.5);

  doc.setTextColor(15, 76, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('TERMS & CONDITIONS:', margin + 3, y + 19.5);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  const termLines = doc.splitTextToSize(company.termsAndConditions || '', leftW - 6);
  doc.text(termLines.slice(0, 5), margin + 3, y + 23.5);

  // Right: Stamp & Authorized Signature
  doc.setTextColor(15, 76, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`For ${company.companyName}`, rEnd, y + 5.5, { align: 'right' });

  drawCompanyStamp(doc, margin + leftW + 21, y + 20, company.companyName);

  doc.setDrawColor(100, 116, 139);
  doc.line(margin + leftW + 40, y + 27, rEnd, y + 27);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text(company.authorizedSignatory || 'Authorized Signatory', rEnd, y + 31.2, {
    align: 'right',
  });

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Receiver Signature', margin + leftW + 4, y + 35);
}

export function buildInvoicePdf(
  company: CompanyProfile,
  invoice: Invoice,
  items: InvoiceItem[],
  copyMode: PdfCopyMode = 'both'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  if (copyMode === 'both') {
    renderInvoiceCopyPage(doc, company, invoice, items, 'ORIGINAL FOR RECIPIENT', true);
    renderInvoiceCopyPage(doc, company, invoice, items, 'DUPLICATE FOR OFFICE / TRANSPORTER', false);
  } else if (copyMode === 'original') {
    renderInvoiceCopyPage(doc, company, invoice, items, 'ORIGINAL FOR RECIPIENT', true);
  } else {
    renderInvoiceCopyPage(doc, company, invoice, items, 'DUPLICATE FOR OFFICE / TRANSPORTER', true);
  }

  return doc;
}

export function downloadInvoicePdfOffline(
  company: CompanyProfile,
  invoice: Invoice,
  items: InvoiceItem[],
  copyMode: PdfCopyMode = 'both'
): void {
  const doc = buildInvoicePdf(company, invoice, items, copyMode);
  const safeInvNo = (invoice.invoiceNumber || 'Invoice').replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`${safeInvNo}_ROYAL_KING_VET_PHARMA.pdf`);
}

export async function shareInvoiceWhatsApp(
  company: CompanyProfile,
  invoice: Invoice,
  items: InvoiceItem[]
): Promise<'shared_file' | 'opened_whatsapp'> {
  const summaryText = [
    `*${company.companyName}*`,
    `Tax Invoice: *${invoice.invoiceNumber}*`,
    `Date: ${formatDateDisplay(invoice.invoiceDate)}`,
    `Customer: ${invoice.customerName}`,
    `Items: ${items.length} item(s)`,
    `Grand Total: Rs. ${pdfAmt(invoice.grandTotal)}`,
    `Previous Balance: Rs. ${pdfAmt(invoice.previousBalance)}`,
    `Payment Received: Rs. ${pdfAmt(invoice.paymentReceived)}`,
    `*Total Outstanding: Rs. ${pdfAmt(invoice.totalOutstanding)}*`,
    `Thank you for your business!`,
  ].join('\n');

  try {
    const doc = buildInvoicePdf(company, invoice, items, 'both');
    const blob = doc.output('blob');
    const safeInvNo = (invoice.invoiceNumber || 'Invoice').replace(/[^a-zA-Z0-9-_]/g, '_');
    const file = new File([blob], `${safeInvNo}_ROYAL_KING_VET_PHARMA.pdf`, {
      type: 'application/pdf',
    });

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        title: `Invoice ${invoice.invoiceNumber} — ${company.companyName}`,
        text: summaryText,
        files: [file],
      });
      return 'shared_file';
    }
  } catch (err) {
    // User cancelled share sheet or file share unsupported; fall back cleanly if not AbortError
    if ((err as { name?: string })?.name === 'AbortError') {
      return 'shared_file';
    }
  }

  const digits = (invoice.customerMobile || '').replace(/\D/g, '');
  const phonePrefix = digits.length === 10 ? `91${digits}` : digits;
  const encoded = encodeURIComponent(summaryText);
  const waUrl = phonePrefix
    ? `https://wa.me/${phonePrefix}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  const link = document.createElement('a');
  link.href = waUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return 'opened_whatsapp';
}
