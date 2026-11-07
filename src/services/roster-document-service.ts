
'use server';

import { jsPDF } from 'jspdf';

/**
 * ROC WORKFORCE — PREMIUM CLINICAL PDF ORCHESTRATOR v8.0
 * 
 * Generates high-fidelity PDF documents for professional roster briefings.
 * DESIGN: Corporate Modern, Navy & White.
 * INTEGRITY: Strictly uses professional FULL LEGAL NAME and Base64 Logo.
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
  const bgSoft = '#F4F7FB';
  const textMain = '#172B4D';
  const textSecondary = '#64748B';
  const successGreen = '#10B981';

  // 1. Background
  doc.setFillColor(bgSoft);
  doc.rect(0, 0, 210, 297, 'F');

  // 2. Header
  doc.setTextColor(primaryNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TEAM REMOTE OPTOMETRY', 20, 25);
  
  doc.setTextColor(secondaryBlue);
  doc.setFontSize(9);
  doc.text('CLINICAL SHIFT BRIEFING', 20, 31);

  if (logoBase64) {
    try {
      const rawB64 = logoBase64.includes(',') ? logoBase64.split(',')[1] : logoBase64;
      doc.addImage(rawB64, 'PNG', pageWidth - 65, 15, 45, 22, undefined, 'FAST');
    } catch (e) {}
  }

  // 3. Identity Hub
  doc.setTextColor(textMain);
  doc.setFontSize(22);
  doc.text(`HELLO, ${employeeName.toUpperCase()}`, 20, 60);
  
  doc.setTextColor(textSecondary);
  doc.setFontSize(10);
  const officeStr = officeName ? `| HUB: ${officeName.toUpperCase()}` : '';
  doc.text(`ID TRACE: ${employeeId} ${officeStr}`, 20, 68);

  // 4. Matrix
  let yOffset = 85;
  nextTwoDays.forEach((d, i) => {
    const isOff = d.shiftId === 'none' || d.shift.toUpperCase().includes('OFF');

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor('#FFFFFF');
    doc.roundedRect(20, yOffset, pageWidth - 40, 40, 4, 4, 'FD');

    doc.setFillColor(isOff ? successGreen : secondaryBlue);
    doc.rect(20, yOffset, 3, 40, 'F');

    doc.setTextColor(textSecondary);
    doc.setFontSize(9);
    doc.text(`DAY 0${i + 1} — ${d.day.toUpperCase()}`, 30, yOffset + 15);
    
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

    yOffset += 50;
  });

  // 5. Footer
  doc.setTextColor('#94A3B8');
  doc.setFontSize(8);
  doc.text('INSTITUTIONAL SCHEDULE PROTOCOL • V11.0', pageWidth / 2, 285, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * generateWeeklyRosterPdf
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
  const textMain = '#172B4D';
  const textSecondary = '#64748B';
  const bgSoft = '#F4F7FB';
  const successGreen = '#10B981';

  doc.setFillColor(bgSoft);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setTextColor(primaryNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TEAM REMOTE OPTOMETRY', 20, 20);
  
  doc.setTextColor(secondaryBlue);
  doc.setFontSize(8);
  doc.text('WEEKLY CLINICAL ROSTER', 20, 25);

  if (logoBase64) {
    try {
      const rawB64 = logoBase64.includes(',') ? logoBase64.split(',')[1] : logoBase64;
      doc.addImage(rawB64, 'PNG', pageWidth - 55, 12, 35, 17, undefined, 'FAST');
    } catch (e) {}
  }

  doc.setTextColor(textMain);
  doc.setFontSize(18);
  doc.text(`HELLO, ${employeeName.toUpperCase()}`, 20, 45);
  
  doc.setTextColor(textSecondary);
  doc.setFontSize(9);
  const officeStr = officeName ? `| HUB: ${officeName.toUpperCase()}` : '';
  doc.text(`ID: ${employeeId} ${officeStr} | CYCLE: ${weekRange.toUpperCase()}`, 20, 52);

  let yOffset = 70;
  rosterDays.forEach((d) => {
    const isOff = d.shiftId === 'none' || d.shift.toUpperCase().includes('OFF');

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor('#FFFFFF');
    doc.roundedRect(20, yOffset, pageWidth - 40, 26, 3, 3, 'FD');

    doc.setFillColor(isOff ? successGreen : secondaryBlue);
    doc.rect(20, yOffset, 2, 26, 'F');

    doc.setTextColor(textSecondary);
    doc.setFontSize(8);
    doc.text(d.day.toUpperCase(), 28, yOffset + 10);
    doc.setTextColor(textMain);
    doc.setFontSize(9);
    doc.text(d.date, 28, yOffset + 17);

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

  doc.setTextColor('#94A3B8');
  doc.setFontSize(8);
  doc.text('CONFIDENTIAL CLINICAL DOCUMENT • GENERATED BY ROC GOVERNANCE HUB', pageWidth / 2, 290, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}
