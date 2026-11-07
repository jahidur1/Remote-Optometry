'use server';

import { jsPDF } from 'jspdf';

/**
 * ROC WORKFORCE — PREMIUM CLINICAL PDF ORCHESTRATOR v2.0
 * 
 * Generates high-fidelity PDF documents for professional roster briefings.
 * DESIGN: Corporate Modern, Navy & White.
 * ENFORCEMENT: A4 Dimensions, Precise Alignment, Deterministic Rendering.
 */

type RosterDay = {
  date: string;
  day: string;
  shift: string;
  time: string;
  shiftId?: string;
};

export async function generateRosterPdf(input: {
  employeeName: string;
  employeeId: string;
  officeName?: string;
  logoBase64?: string;
  nextTwoDays: RosterDay[];
}): Promise<Buffer> {
  const { employeeName, employeeId, officeName, logoBase64, nextTwoDays } = input;
  
  // 1. Initialize A4 Document (72 DPI internal units)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryNavy = '#102A43';
  const secondaryBlue = '#2563EB';
  const accentCyan = '#22D3EE';
  const textMain = '#172B4D';
  const textSecondary = '#64748B';
  const bgSoft = '#F4F7FB';
  const successGreen = '#10B981';

  // 2. Background Layer
  doc.setFillColor(bgSoft);
  doc.rect(0, 0, 210, 297, 'F');

  // 3. Brand Header Hub
  doc.setTextColor(primaryNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TEAM REMOTE OPTOMETRY', 20, 25);
  
  doc.setTextColor(secondaryBlue);
  doc.setFontSize(9);
  doc.text('WORKFORCE SHIFT SCHEDULE', 20, 31);

  if (logoBase64) {
    try {
      // Proportional Logo Placement
      // jsPDF addImage works best with raw Base64 (strip prefix if present)
      const rawB64 = logoBase64.includes(',') ? logoBase64.split(',')[1] : logoBase64;
      doc.addImage(rawB64, 'PNG', pageWidth - 65, 15, 45, 22, undefined, 'FAST');
    } catch (e) {
      console.warn("PDF_LOGO_ALERT: Invalid logo buffer format.");
    }
  }

  // 4. Professional Identity
  doc.setTextColor(textMain);
  doc.setFontSize(22);
  doc.text(`HELLO, ${employeeName.split(' ')[0]}`, 20, 60);
  
  doc.setTextColor(textSecondary);
  doc.setFontSize(10);
  doc.text(`ID TRACE: ${employeeId} ${officeName ? `| HUB: ${officeName.toUpperCase()}` : ''}`, 20, 68);

  // 5. Clinical Schedule Header
  doc.setTextColor(primaryNavy);
  doc.setFontSize(11);
  doc.text('YOUR UPCOMING SCHEDULE', 20, 90);
  doc.setDrawColor(226, 232, 240);
  doc.line(80, 89, pageWidth - 20, 89);

  // 6. 2-Day Schedule Matrix
  let yOffset = 100;
  nextTwoDays.forEach((d, i) => {
    const shiftId = (d.shiftId || '').toUpperCase();
    const shiftName = d.shift.toUpperCase();
    const isOff = shiftName.includes('WEEK OFF') || shiftName.includes('WEEK-OFF') || shiftId === 'NONE';

    // Determine Indicator Color
    let indicatorColor = textSecondary;
    if (isOff) indicatorColor = successGreen;
    else if (shiftId === 'SO' || shiftId === 'OP') indicatorColor = secondaryBlue;
    else if (shiftId === 'MD') indicatorColor = accentCyan;
    else if (shiftId.startsWith('C') || shiftId === 'SC') indicatorColor = primaryNavy;

    // Card Container
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor('#FFFFFF');
    doc.roundedRect(20, yOffset, pageWidth - 40, 45, 4, 4, 'FD');

    // Indicator Pulse
    doc.setFillColor(indicatorColor);
    doc.rect(20, yOffset, 3, 45, 'F');

    // Day & Date Pulse
    doc.setTextColor(textSecondary);
    doc.setFontSize(9);
    doc.text(`DAY 0${i + 1} — ${d.day}`, 30, yOffset + 15);
    
    doc.setTextColor(textMain);
    doc.setFontSize(12);
    doc.text(d.date, 30, yOffset + 25);

    // Shift Pulse
    doc.setTextColor(isOff ? successGreen : primaryNavy);
    doc.setFontSize(18);
    doc.text(d.shift, pageWidth - 30, yOffset + 22, { align: 'right' });
    
    if (!isOff) {
      doc.setTextColor(secondaryBlue);
      doc.setFontSize(11);
      doc.text(d.time, pageWidth - 30, yOffset + 32, { align: 'right' });
    }

    yOffset += 55;
  });

  // 7. Institutional Protocol Notice
  doc.setDrawColor(226, 232, 240);
  doc.setLineDashPattern([2, 2], 0);
  doc.setFillColor('#FFFFFF');
  doc.roundedRect(20, 225, pageWidth - 40, 30, 4, 4, 'FD');
  
  doc.setTextColor(textSecondary);
  doc.setFontSize(10);
  const reminder = "Please report to the office on time and follow your assigned shift timings. Wishing you a productive day!";
  doc.text(doc.splitTextToSize(reminder, pageWidth - 60), 30, 238);

  // 8. Corporate Footer
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(226, 232, 240);
  doc.line(20, 268, pageWidth - 20, 268);

  doc.setTextColor(primaryNavy);
  doc.setFontSize(11);
  doc.text('TEAM REMOTE OPTOMETRY', pageWidth / 2, 282, { align: 'center' });
  
  doc.setTextColor('#94A3B8');
  doc.setFontSize(8);
  doc.text('YOUR SCHEDULE. YOUR RESPONSIBILITY. YOUR TEAM.', pageWidth / 2, 288, { align: 'center' });

  // 9. Buffer Export
  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}
