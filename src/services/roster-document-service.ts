'use server';

import { jsPDF } from 'jspdf';

/**
 * ROC WORKFORCE — PREMIUM CLINICAL PDF ORCHESTRATOR v6.0
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

/**
 * generateRosterPdf
 * Brief 2-day document for daily notifications.
 */
export async function generateRosterPdf(input: {
  employeeName: string;
  employeeId: string;
  officeName?: string;
  logoBase64?: string;
  nextTwoDays: RosterDay[];
}): Promise<Buffer> {
  const { employeeName, employeeId, officeName, logoBase64, nextTwoDays } = input;
  
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

  // 1. Background Layer
  doc.setFillColor(bgSoft);
  doc.rect(0, 0, 210, 297, 'F');

  // 2. Brand Header Hub
  doc.setTextColor(primaryNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TEAM REMOTE OPTOMETRY', 20, 25);
  
  doc.setTextColor(secondaryBlue);
  doc.setFontSize(9);
  doc.text('WORKFORCE SHIFT SCHEDULE', 20, 31);

  if (logoBase64) {
    try {
      const rawB64 = logoBase64.includes(',') ? logoBase64.split(',')[1] : logoBase64;
      doc.addImage(rawB64, 'PNG', pageWidth - 65, 15, 45, 22, undefined, 'FAST');
    } catch (e) {
      console.warn("PDF_LOGO_ALERT: Invalid logo buffer format.");
    }
  }

  // 3. Professional Identity
  doc.setTextColor(textMain);
  doc.setFontSize(22);
  doc.text(`HELLO, ${employeeName.toUpperCase()}`, 20, 60);
  
  doc.setTextColor(textSecondary);
  doc.setFontSize(10);
  const officeStr = officeName ? `| HUB: ${officeName.toUpperCase()}` : '';
  doc.text(`ID TRACE: ${employeeId} ${officeStr}`, 20, 68);

  // 4. Clinical Schedule Header
  doc.setTextColor(primaryNavy);
  doc.setFontSize(11);
  doc.text('YOUR UPCOMING SCHEDULE', 20, 90);
  doc.setDrawColor(226, 232, 240);
  doc.line(80, 89, pageWidth - 20, 89);

  // 5. 2-Day Schedule Matrix
  let yOffset = 100;
  nextTwoDays.forEach((d, i) => {
    const shiftId = (d.shiftId || '').toUpperCase();
    const shiftName = d.shift.toUpperCase();
    const isOff = shiftName.includes('WEEK OFF') || shiftName.includes('WEEK-OFF') || shiftId === 'NONE';

    let indicatorColor = textSecondary;
    if (isOff) indicatorColor = successGreen;
    else if (shiftId === 'SO' || shiftId === 'OP') indicatorColor = secondaryBlue;
    else if (shiftId === 'MD') indicatorColor = accentCyan;
    else if (shiftId.startsWith('C') || shiftId === 'SC') indicatorColor = primaryNavy;

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor('#FFFFFF');
    doc.roundedRect(20, yOffset, pageWidth - 40, 45, 4, 4, 'FD');

    doc.setFillColor(indicatorColor);
    doc.rect(20, yOffset, 3, 45, 'F');

    doc.setTextColor(textSecondary);
    doc.setFontSize(9);
    doc.text(`DAY 0${i + 1} — ${d.day}`, 30, yOffset + 15);
    
    doc.setTextColor(textMain);
    doc.setFontSize(12);
    doc.text(d.date, 30, yOffset + 25);

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

  // 6. Institutional Protocol Notice
  doc.setDrawColor(226, 232, 240);
  doc.setLineDashPattern([2, 2], 0);
  doc.setFillColor('#FFFFFF');
  doc.roundedRect(20, 225, pageWidth - 40, 30, 4, 4, 'FD');
  
  doc.setTextColor(textSecondary);
  doc.setFontSize(10);
  const reminder = "Please report to the office on time and follow your assigned shift timings. Wishing you a productive day!";
  doc.text(doc.splitTextToSize(reminder, pageWidth - 60), 30, 238);

  // 7. Corporate Footer
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(226, 232, 240);
  doc.line(20, 268, pageWidth - 20, 268);

  doc.setTextColor(primaryNavy);
  doc.setFontSize(11);
  doc.text('TEAM REMOTE OPTOMETRY', pageWidth / 2, 282, { align: 'center' });
  
  doc.setTextColor('#94A3B8');
  doc.setFontSize(8);
  doc.text('YOUR SCHEDULE. YOUR RESPONSIBILITY. YOUR TEAM.', pageWidth / 2, 288, { align: 'center' });

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}

/**
 * generateWeeklyRosterPdf
 * Comprehensive 7-day document for full-week distributions.
 */
export async function generateWeeklyRosterPdf(input: {
  employeeName: string;
  employeeId: string;
  officeName?: string;
  weekRange: string;
  logoBase64?: string;
  rosterDays: RosterDay[];
}): Promise<Buffer> {
  const { employeeName, employeeId, officeName, weekRange, logoBase64, rosterDays } = input;
  
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

  // 1. Background
  doc.setFillColor(bgSoft);
  doc.rect(0, 0, 210, 297, 'F');

  // 2. Header Hub
  doc.setTextColor(primaryNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TEAM REMOTE OPTOMETRY', 20, 20);
  
  doc.setTextColor(secondaryBlue);
  doc.setFontSize(8);
  doc.text('WEEKLY WORKFORCE SCHEDULE', 20, 25);

  if (logoBase64) {
    try {
      const rawB64 = logoBase64.includes(',') ? logoBase64.split(',')[1] : logoBase64;
      doc.addImage(rawB64, 'PNG', pageWidth - 55, 12, 35, 17, undefined, 'FAST');
    } catch (e) {}
  }

  // 3. Identity Trace - Full Legal Name
  doc.setTextColor(textMain);
  doc.setFontSize(18);
  doc.text(`HELLO, ${employeeName.toUpperCase()}`, 20, 45);
  
  doc.setTextColor(textSecondary);
  doc.setFontSize(9);
  const officeStr = officeName ? `| HUB: ${officeName.toUpperCase()}` : '';
  doc.text(`ID: ${employeeId} ${officeStr} | CYCLE: ${weekRange.toUpperCase()}`, 20, 52);

  // 4. Section Header
  doc.setTextColor(primaryNavy);
  doc.setFontSize(10);
  doc.text('YOUR WEEKLY ROSTER', 20, 68);
  doc.setDrawColor(226, 232, 240);
  doc.line(65, 67, pageWidth - 20, 67);

  // 5. 7-Day Clinical Matrix
  let yOffset = 75;
  rosterDays.forEach((d) => {
    const shiftId = (d.shiftId || '').toUpperCase();
    const shiftName = d.shift.toUpperCase();
    const isOff = shiftName.includes('WEEK OFF') || shiftName.includes('WEEK-OFF') || shiftId === 'NONE';

    let indicatorColor = textSecondary;
    if (isOff) indicatorColor = successGreen;
    else if (shiftId === 'SO' || shiftId === 'OP') indicatorColor = secondaryBlue;
    else if (shiftId === 'MD') indicatorColor = accentCyan;
    else if (shiftId.startsWith('C') || shiftId === 'SC') indicatorColor = primaryNavy;

    // Daily Card
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor('#FFFFFF');
    doc.roundedRect(20, yOffset, pageWidth - 40, 26, 3, 3, 'FD');

    // Vertical Pulse Indicator
    doc.setFillColor(indicatorColor);
    doc.rect(20, yOffset, 2, 26, 'F');

    // Temporal Meta
    doc.setTextColor(textSecondary);
    doc.setFontSize(8);
    doc.text(d.day.toUpperCase(), 28, yOffset + 10);
    doc.setTextColor(textMain);
    doc.setFontSize(9);
    doc.text(d.date, 28, yOffset + 17);

    // Shift Metadata
    doc.setTextColor(isOff ? successGreen : primaryNavy);
    doc.setFontSize(14);
    doc.text(d.shift, pageWidth - 30, yOffset + 13, { align: 'right' });
    
    if (!isOff) {
      doc.setTextColor(secondaryBlue);
      doc.setFontSize(9);
      doc.text(d.time, pageWidth - 30, yOffset + 20, { align: 'right' });
    }

    yOffset += 28;
  });

  // 6. Professional Compliance Note
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor('#FFFFFF');
  doc.roundedRect(20, 271, pageWidth - 40, 10, 2, 2, 'F');
  doc.setTextColor(textSecondary);
  doc.setFontSize(8);
  doc.text("Please report to the office on time and follow your assigned shift timings.", pageWidth / 2, 277, { align: 'center' });

  // 7. Corporate Footer Hub
  doc.setDrawColor(226, 232, 240);
  doc.line(20, 282, pageWidth - 20, 282);
  doc.setTextColor(primaryNavy);
  doc.setFontSize(10);
  doc.text('TEAM REMOTE OPTOMETRY', pageWidth / 2, 290, { align: 'center' });
  doc.setTextColor('#94A3B8');
  doc.setFontSize(7);
  doc.text('YOUR SCHEDULE. YOUR RESPONSIBILITY. YOUR TEAM.', pageWidth / 2, 295, { align: 'center' });

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}
