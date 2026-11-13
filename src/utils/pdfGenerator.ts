import { jsPDF } from 'jspdf';
import type { CompanyProfile, Invoice, InvoiceItem } from '../types/billing';
import { formatDateDisplay, formatMonthYear, round2 } from './billingMath';

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

function drawRectangularCompanyStamp(
  doc: jsPDF,
  cx: number,
  cy: number,
  company: CompanyProfile
) {
  doc.saveGraphicsState();
  doc.setDrawColor(100, 116, 139);
  doc.setTextColor(100, 116, 139);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const title = (company.companyName || 'ROYAL KING VET PHARMA').toUpperCase();
  doc.text(title, cx, cy - 2, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  const sub = [company.address, company.city].filter(Boolean).join(', ');
  const lines = doc.splitTextToSize(sub, 58);
  doc.text(lines.slice(0, 2), cx, cy + 2.2, { align: 'center' });
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
  const margin = 8;
  const contentWidth = pageWidth - margin * 2; // 194mm
  const outerBottom = 289;
  const rightColX = margin + 102;

  const drawOuterBorder = () => {
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.35);
    doc.rect(margin, margin, contentWidth, outerBottom - margin);
  };

  drawOuterBorder();

  // 1. TOP HEADER BAND
  let y = margin;
  const headerH = 27;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.line(margin, y + headerH, margin + contentWidth, y + headerH);

  // Top-left GSTIN & D.L. No.
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`GSTIN  :  ${company.gstin || '-'}`, margin + 2.5, y + 4.8);
  if (company.dlNumber) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`D.L. No.: ${company.dlNumber}`, margin + 2.5, y + 8.8);
  }

  // Top-right Copy Label
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  doc.text(copyLabel, margin + contentWidth - 2.5, y + 5, { align: 'right' });

  // Centered Company Identity
  const docTitle =
    invoice.invoiceTypeLabel || (invoice.totalGst > 0 ? 'TAX INVOICE' : 'BILL OF SUPPLY');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(docTitle, pageWidth / 2, y + 5.2, { align: 'center' });

  doc.setFontSize(14.5);
  doc.text((company.companyName || 'ROYAL KING VET PHARMA').toUpperCase(), pageWidth / 2, y + 11.2, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const addrLine = [
    company.address,
    company.city ? `${company.city}${company.pincode ? ` (${company.pincode})` : ''}` : '',
    company.state,
  ]
    .filter(Boolean)
    .join(', ');
  const wrappedCompanyAddr = doc.splitTextToSize(addrLine, 125);
  doc.text(wrappedCompanyAddr.slice(0, 2), pageWidth / 2, y + 15.8, { align: 'center' });

  doc.setFontSize(7.4);
  const contactLine = [
    company.phone ? `Contact No : ${company.phone}` : '',
    company.email ? company.email : '',
  ]
    .filter(Boolean)
    .join('   |   ');
  doc.text(contactLine, pageWidth / 2, y + 24.5, { align: 'center' });

  // 2. INVOICE & TRANSPORT METADATA ROW
  y += headerH;
  const metaRowH = 15.5;
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.25);
  doc.line(rightColX, y, rightColX, y + metaRowH);
  doc.line(margin, y + metaRowH, margin + contentWidth, y + metaRowH);

  doc.setFontSize(7.5);
  const leftMeta: [string, string][] = [
    ['Invoice No.', invoice.invoiceNumber],
    ['Dated', formatDateDisplay(invoice.invoiceDate)],
    ['Place of Supply', `${invoice.placeOfSupply} (${invoice.placeOfSupplyCode})`],
  ];
  leftMeta.forEach(([lbl, val], idx) => {
    const ry = y + 4.5 + idx * 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(lbl, margin + 2.5, ry);
    doc.text(':', margin + 28, ry);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(val || '-', margin + 31, ry);
  });

  const rightMeta: [string, string][] = [
    ['Transport', invoice.transport || 'Self'],
    ['Vehicle No.', invoice.vehicleNo || '-'],
    ['Station', invoice.station || '-'],
  ];
  rightMeta.forEach(([lbl, val], idx) => {
    const ry = y + 4.5 + idx * 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(lbl, rightColX + 2.5, ry);
    doc.text(':', rightColX + 25, ry);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(val || '-', rightColX + 28, ry);
  });

  // 3. BILLED TO & SHIPPED TO ROW
  y += metaRowH;
  const partyRowH = 29;
  doc.line(rightColX, y, rightColX, y + partyRowH);
  doc.line(margin, y + partyRowH, margin + contentWidth, y + partyRowH);

  const renderPartyCol = (
    x: number,
    heading: string,
    name: string,
    address: string,
    mobile: string,
    pincode: string,
    gstin: string
  ) => {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(heading, x + 2.5, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(name || 'Walk-in Customer', x + 2.5, y + 8.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    const addrLines = doc.splitTextToSize(address || '-', 88);
    doc.text(addrLines.slice(0, 2), x + 2.5, y + 12.6);

    const footerRows: [string, string][] = [
      ['Party Mobile No', mobile || '-'],
      ['Party Pincode', pincode || '-'],
      ['GSTIN / UIN', gstin || '-'],
    ];
    footerRows.forEach(([lbl, val], idx) => {
      const fy = y + 20.5 + idx * 3.6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(lbl, x + 2.5, fy);
      doc.text(':', x + 28, fy);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(val, x + 31, fy);
    });
  };

  renderPartyCol(
    margin,
    'Billed To  :',
    invoice.customerName,
    invoice.customerAddress,
    invoice.customerMobile,
    invoice.customerPincode || '',
    invoice.customerGstin
  );
  renderPartyCol(
    rightColX,
    'Shipped To :',
    invoice.customerName,
    invoice.shippingAddress || invoice.customerAddress,
    invoice.customerMobile,
    invoice.customerPincode || '',
    invoice.customerGstin
  );

  // 4. FULL-HEIGHT PRODUCT TABLE
  y += partyRowH;
  const cols = [
    { label: 'S No.', w: 9, align: 'center' as const },
    { label: 'Description of Goods', w: 46, align: 'left' as const },
    { label: 'HSN Code', w: 17, align: 'center' as const },
    { label: 'Batch No.', w: 17, align: 'center' as const },
    { label: 'Mfg. Date', w: 16, align: 'center' as const },
    { label: 'Exp. Date', w: 16, align: 'center' as const },
    { label: 'Qty.', w: 11, align: 'right' as const },
    { label: 'Unit', w: 12, align: 'left' as const },
    { label: 'Price', w: 15, align: 'right' as const },
    { label: 'MRP', w: 15, align: 'right' as const },
    { label: 'Amount in (Rs.)', w: 20, align: 'right' as const },
  ]; // sum = 194mm

  const drawVerticalGridLines = (topY: number, bottomY: number) => {
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.2);
    let vx = margin;
    for (let c = 0; c < cols.length - 1; c++) {
      vx += cols[c].w;
      doc.line(vx, topY, vx, bottomY);
    }
  };

  const drawTableHeader = (startY: number) => {
    const hdrH = 8.5;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, startY, contentWidth, hdrH, 'F');
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.25);
    doc.line(margin, startY + hdrH, margin + contentWidth, startY + hdrH);

    doc.setTextColor(15, 23, 42);
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
      const lines = doc.splitTextToSize(col.label, col.w - 2);
      doc.text(lines, tx, lines.length > 1 ? startY + 3.6 : startY + 5.4, { align: col.align });
      cx += col.w;
    }
    return startY + hdrH;
  };

  const tableTopY = y;
  y = drawTableHeader(y);
  let currentSectionTopY = tableTopY;
  const fixedTableBottomY = 188;

  items.forEach((item, index) => {
    const descText =
      item.taxRate > 0
        ? `${item.productName}\n(GST @ ${item.taxRate}%${item.discountPercent > 0 ? `, Disc ${item.discountPercent}%` : ''})`
        : item.productName;
    const nameLines = doc.splitTextToSize(descText || '-', cols[1].w - 3);
    const rowH = Math.max(7.5, nameLines.length * 3.4 + 2.5);

    if (y + rowH > 186) {
      drawVerticalGridLines(currentSectionTopY, y);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Continued on next page...', margin + contentWidth - 3, 284, { align: 'right' });

      doc.addPage();
      drawOuterBorder();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `${company.companyName} — ${invoice.invoiceNumber} (${copyLabel}) [Cont.]`,
        margin + 3,
        margin + 6
      );
      doc.line(margin, margin + 8.5, margin + contentWidth, margin + 8.5);
      currentSectionTopY = margin + 8.5;
      y = drawTableHeader(currentSectionTopY);
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.9);

    let cx = margin;
    // S No.
    doc.text(String(index + 1), cx + cols[0].w / 2, y + 4.2, { align: 'center' });
    cx += cols[0].w;
    // Description
    doc.setFont('helvetica', 'bold');
    doc.text(nameLines, cx + 1.5, y + 4.1);
    doc.setFont('helvetica', 'normal');
    cx += cols[1].w;
    // HSN Code
    doc.text(item.hsnCode || '-', cx + cols[2].w / 2, y + 4.2, { align: 'center' });
    cx += cols[2].w;
    // Batch No.
    doc.text(item.batchNumber || '-', cx + cols[3].w / 2, y + 4.2, { align: 'center' });
    cx += cols[3].w;
    // Mfg. Date
    doc.text(formatMonthYear(item.mfgDate), cx + cols[4].w / 2, y + 4.2, { align: 'center' });
    cx += cols[4].w;
    // Exp. Date
    doc.text(formatMonthYear(item.expiryDate), cx + cols[5].w / 2, y + 4.2, { align: 'center' });
    cx += cols[5].w;
    // Qty
    doc.text(String(item.quantity), cx + cols[6].w - 1.5, y + 4.2, { align: 'right' });
    cx += cols[6].w;
    // Unit
    doc.text(item.unit || '-', cx + 1.5, y + 4.2);
    cx += cols[7].w;
    // Price
    doc.text(pdfAmt(item.price), cx + cols[8].w - 1.5, y + 4.2, { align: 'right' });
    cx += cols[8].w;
    // MRP
    doc.text(pdfAmt(item.mrp), cx + cols[9].w - 1.5, y + 4.2, { align: 'right' });
    cx += cols[9].w;
    // Amount in Rs. (Taxable amount before tax, matching classic Indian pharma layout)
    doc.setFont('helvetica', 'bold');
    doc.text(pdfAmt(item.taxableAmount), cx + cols[10].w - 1.5, y + 4.2, { align: 'right' });

    y += rowH;
  });

  // Extend vertical lines down to fixedTableBottomY on the final page
  const actualTableBottom = Math.max(y + 4, fixedTableBottomY);
  drawVerticalGridLines(currentSectionTopY, actualTableBottom);
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.line(margin, actualTableBottom, margin + contentWidth, actualTableBottom);

  y = actualTableBottom;

  // 5. GRAND TOTAL ROW (matching photo)
  const gtRowH = 7;
  doc.line(margin, y + gtRowH, margin + contentWidth, y + gtRowH);
  doc.line(margin + contentWidth - 35, y, margin + contentWidth - 35, y + gtRowH);

  if (invoice.totalGst > 0 || invoice.roundOff !== 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const taxNote =
      invoice.taxType === 'intrastate'
        ? `Sub Total: ${pdfAmt(invoice.subtotalTaxable)}  |  CGST: ${pdfAmt(invoice.totalCgst)}  |  SGST: ${pdfAmt(invoice.totalSgst)}  |  Round Off: ${pdfAmt(invoice.roundOff)}`
        : `Sub Total: ${pdfAmt(invoice.subtotalTaxable)}  |  IGST: ${pdfAmt(invoice.totalIgst)}  |  Round Off: ${pdfAmt(invoice.roundOff)}`;
    doc.text(taxNote, margin + 2.5, y + 4.7);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Grand Total (Rs.)', margin + contentWidth - 37.5, y + 4.8, { align: 'right' });
  doc.setFontSize(8.8);
  doc.text(pdfAmt(invoice.grandTotal), margin + contentWidth - 2.5, y + 4.8, { align: 'right' });

  y += gtRowH;

  // 6. HSN/SAC TAX BREAKDOWN + AMOUNT IN WORDS
  const taxBuckets = new Map<
    string,
    { hsn: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number }
  >();
  for (const it of items) {
    const key = `${it.hsnCode || '-'}_${it.taxRate}`;
    const prev = taxBuckets.get(key) || {
      hsn: it.hsnCode || '-',
      rate: it.taxRate,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    };
    taxBuckets.set(key, {
      ...prev,
      taxable: round2(prev.taxable + it.taxableAmount),
      cgst: round2(prev.cgst + it.cgstAmount),
      sgst: round2(prev.sgst + it.sgstAmount),
      igst: round2(prev.igst + it.igstAmount),
    });
  }

  let ty = y + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(15, 23, 42);
  doc.text('HSN/SAC', margin + 2.5, ty);
  doc.text('Tax Rate', margin + 22, ty);
  doc.text('Taxable Amt.', margin + 56, ty, { align: 'right' });
  doc.text('CGST Amt.', margin + 78, ty, { align: 'right' });
  doc.text('SGST Amt.', margin + 100, ty, { align: 'right' });
  doc.text('IGST Amt.', margin + 122, ty, { align: 'right' });
  doc.text('Total Tax', margin + 146, ty, { align: 'right' });

  doc.setDrawColor(148, 163, 184);
  doc.line(margin + 2.5, ty + 1.2, margin + 146, ty + 1.2);

  doc.setFont('helvetica', 'normal');
  Array.from(taxBuckets.values())
    .slice(0, 4)
    .forEach((b) => {
      ty += 4;
      const totTax = round2(b.cgst + b.sgst + b.igst);
      doc.text(b.hsn, margin + 2.5, ty);
      doc.text(b.rate === 0 ? 'Exempt' : `${b.rate}%`, margin + 22, ty);
      doc.text(pdfAmt(b.taxable), margin + 56, ty, { align: 'right' });
      doc.text(b.cgst > 0 ? pdfAmt(b.cgst) : '--', margin + 78, ty, { align: 'right' });
      doc.text(b.sgst > 0 ? pdfAmt(b.sgst) : '--', margin + 100, ty, { align: 'right' });
      doc.text(b.igst > 0 ? pdfAmt(b.igst) : '--', margin + 122, ty, { align: 'right' });
      doc.text(pdfAmt(totTax), margin + 146, ty, { align: 'right' });
    });

  const wordsY = Math.max(ty + 6.5, y + 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  const wordsText = `Amount in Words : ${invoice.amountInWords}`;
  const wrappedWords = doc.splitTextToSize(wordsText, contentWidth - 5);
  doc.text(wrappedWords.slice(0, 2), margin + 2.5, wordsY);

  y = wordsY + (wrappedWords.length > 1 ? 7 : 3.5);
  doc.setDrawColor(30, 41, 59);
  doc.line(margin, y, margin + contentWidth, y);

  // 7. BANK DETAILS + PREVIOUS BALANCE / PAYMENT / TOTAL OUTSTANDING
  const bankH = 17.5;
  doc.line(margin, y + bankH, margin + contentWidth, y + bankH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.text('Bank Details :', margin + 2.5, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Bank Name : ${company.bankName || '-'}     Branch : ${company.branch || '-'}`,
    margin + 24,
    y + 4.5
  );
  doc.text(
    `Account No : ${company.accountNumber || '-'}     IFSC Code : ${company.ifscCode || '-'}`,
    margin + 24,
    y + 8.8
  );

  // Ledger Strip inside lower half of Bank Box
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y + 11, margin + contentWidth, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Prev. Bal: ${pdfRs(invoice.previousBalance)}   |   Paid (${invoice.paymentMode}): ${pdfRs(invoice.paymentReceived)}`,
    margin + 2.5,
    y + 15.2
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const drCrSuffix = invoice.totalOutstanding >= 0 ? 'Dr' : 'Cr';
  doc.text('Total Outstanding:', margin + contentWidth - 36, y + 15.3, { align: 'right' });
  doc.text(
    `${pdfAmt(Math.abs(invoice.totalOutstanding))} ${drCrSuffix}`,
    margin + contentWidth - 2.5,
    y + 15.3,
    { align: 'right' }
  );

  // 8. BOTTOM 3-COLUMN FOOTER: TERMS | CATEGORY STAMP | SIGNATURE & COMPANY SEAL
  y += bankH;
  const footerBottom = outerBottom;
  const footerLeftW = 82;
  const footerCenterW = 44;

  doc.setDrawColor(30, 41, 59);
  doc.line(margin + footerLeftW, y, margin + footerLeftW, footerBottom);

  // Left: Terms & Conditions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('Terms & Conditions', margin + 2.5, y + 4.2);
  doc.setDrawColor(100, 116, 139);
  doc.line(margin + 2.5, y + 4.9, margin + 26, y + 4.9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.text('E.& O.E.', margin + 2.5, y + 8.5);
  const termLines = doc.splitTextToSize(company.termsAndConditions || '', footerLeftW - 5);
  doc.text(termLines.slice(0, 5), margin + 2.5, y + 12);

  // Center: Framed Category / Tax Status Box (just like reference bill)
  const boxX = margin + footerLeftW + 4;
  const boxY = y + 5;
  const boxW = footerCenterW - 6;
  const boxH = 18;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'S');
  doc.setLineWidth(0.2);
  doc.roundedRect(boxX + 0.8, boxY + 0.8, boxW - 1.6, boxH - 1.6, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  if (invoice.totalGst === 0) {
    doc.text('ANIMAL FEED', boxX + boxW / 2, boxY + 5.2, { align: 'center' });
    doc.text('SUPPLEMENT', boxX + boxW / 2, boxY + 9, { align: 'center' });
    doc.line(boxX + 2, boxY + 10.6, boxX + boxW - 2, boxY + 10.6);
    doc.text('GST / TAX', boxX + boxW / 2, boxY + 13.8, { align: 'center' });
    doc.text('FREE ITEM', boxX + boxW / 2, boxY + 16.8, { align: 'center' });
  } else {
    doc.text('VETERINARY', boxX + boxW / 2, boxY + 5.2, { align: 'center' });
    doc.text('PHARMACEUTICALS', boxX + boxW / 2, boxY + 9, { align: 'center' });
    doc.line(boxX + 2, boxY + 10.6, boxX + boxW - 2, boxY + 10.6);
    doc.text('GST TAXABLE', boxX + boxW / 2, boxY + 13.8, { align: 'center' });
    doc.text('SUPPLY', boxX + boxW / 2, boxY + 16.8, { align: 'center' });
  }

  // Right: For ROYAL KING VET PHARMA + Company Stamp + Authorised Signatory
  const sigX = margin + contentWidth - 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.text(`For ${(company.companyName || 'ROYAL KING VET PHARMA').toUpperCase()}`, sigX, y + 5, {
    align: 'right',
  });

  drawRectangularCompanyStamp(doc, margin + footerLeftW + footerCenterW + 32, y + 14.5, company);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(15, 23, 42);
  doc.text(company.authorizedSignatory || 'Authorised Signatory', sigX, footerBottom - 3.5, {
    align: 'right',
  });
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
    renderInvoiceCopyPage(doc, company, invoice, items, 'Original Copy', true);
    renderInvoiceCopyPage(doc, company, invoice, items, 'Duplicate Copy', false);
  } else if (copyMode === 'original') {
    renderInvoiceCopyPage(doc, company, invoice, items, 'Original Copy', true);
  } else {
    renderInvoiceCopyPage(doc, company, invoice, items, 'Duplicate Copy', true);
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
    `${invoice.invoiceTypeLabel || 'TAX INVOICE'}: *${invoice.invoiceNumber}*`,
    `Date: ${formatDateDisplay(invoice.invoiceDate)}`,
    `Customer: ${invoice.customerName}`,
    `Items: ${items.length} item(s)`,
    `Grand Total: Rs. ${pdfAmt(invoice.grandTotal)}`,
    `Previous Balance: Rs. ${pdfAmt(invoice.previousBalance)}`,
    `Payment Received: Rs. ${pdfAmt(invoice.paymentReceived)}`,
    `*Total Outstanding: Rs. ${pdfAmt(Math.abs(invoice.totalOutstanding))} ${invoice.totalOutstanding >= 0 ? 'Dr' : 'Cr'}*`,
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
