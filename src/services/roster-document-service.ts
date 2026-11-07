'use server';

import { jsPDF } from 'jspdf';

/**
 * ROC WORKFORCE — PREMIUM CLINICAL PDF ORCHESTRATOR v1.0
 * 
 * Generates high-fidelity PDF documents for professional roster briefings.
 * DESIGN: Corporate Modern, Navy & White.
 * ADVANTAGE: Unlimited scaling without byte-limit sharpness loss.
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
  logoBase64?: string;
  nextTwoDays: RosterDay[];
}): Promise<Buffer> {
  const { employeeName, employeeId, logoBase64, nextTwoDays } = input;
  
  // 1. Initialize A4 Document (72 DPI internal units)
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

  // 2. Background Pulse
  doc.setFillColor(bgSoft);
  doc.rect(0, 0, 210, 297, 'F');

  // 3. Brand Header Hub
  doc.setTextColor(primaryNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TEAM REMOTE OPTOMETRY', 20, 25);
  
  doc.setTextColor(secondaryBlue);
  doc.setFontSize(7);
  doc.text('WORKFORCE SHIFT SCHEDULE', 20, 30);

  if (logoBase64) {
    try {
      // Proportional Logo Placement
      doc.addImage(logoBase64, 'PNG', pageWidth - 60, 15, 40, 20, undefined, 'FAST');
    } catch (e) {
      console.warn("PDF_LOGO_ALERT: Invalid logo buffer.");
    }
  }

  // 4. Professional Identity Greeting
  doc.setTextColor(textMain);
  doc.setFontSize(18);
  doc.text(`HELLO, ${employeeName.split(' ')[0]}`, 20, 55);
  
  doc.setTextColor(textSecondary);
  doc.setFontSize(8);
  doc.text(`ID TRACE: ${employeeId}`, 20, 62);

  // 5. Clinical Schedule Matrix
  doc.setTextColor(primaryNavy);
  doc.setFontSize(9);
  doc.text('YOUR UPCOMING SCHEDULE', 20, 85);
  doc.setDrawColor(226, 232, 240);
  doc.line(75, 84, pageWidth - 20, 84);

  let yOffset = 95;
  nextTwoDays.forEach((d, i) => {
    const isOff = d.shift.toUpperCase().includes('WEEK OFF') || d.shift.toUpperCase().includes('WEEK-OFF');
    const indicatorColor = isOff ? '#10B981' : (i === 0 ? secondaryBlue : primaryNavy);

    // Day Card Container
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor('#FFFFFF');
    doc.roundedRect(20, yOffset, pageWidth - 40, 35, 3, 3, 'FD');

    // Left Border Pulse
    doc.setFillColor(indicatorColor);
    doc.rect(20, yOffset, 2, 35, 'F');

    // Card Content
    doc.setTextColor(textSecondary);
    doc.setFontSize(7);
    doc.text(`DAY 0${i + 1} — ${d.day}`, 30, yOffset + 12);
    
    doc.setTextColor(textMain);
    doc.setFontSize(10);
    doc.text(d.date, 30, yOffset + 22);

    doc.setTextColor(isOff ? '#10B981' : primaryNavy);
    doc.setFontSize(14);
    doc.text(d.shift, pageWidth - 30, yOffset + 15, { align: 'right' });
    
    if (!isOff) {
      doc.setTextColor(secondaryBlue);
      doc.setFontSize(9);
      doc.text(d.time, pageWidth - 30, yOffset + 24, { align: 'right' });
    }

    yOffset += 45;
  });

  // 6. Institutional Protocol Notice
  doc.setDrawColor(226, 232, 240);
  doc.setLineDashPattern([2, 2], 0);
  doc.setFillColor('#FFFFFF');
  doc.roundedRect(20, 210, pageWidth - 40, 25, 3, 3, 'FD');
  
  doc.setTextColor(textSecondary);
  doc.setFontSize(8);
  const reminder = "Please report to the office on time and follow your assigned shift timings. Wishing you a productive day!";
  doc.text(doc.splitTextToSize(reminder, pageWidth - 60), 30, 222);

  // 7. Corporate Footer
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(226, 232, 240);
  doc.line(20, 255, pageWidth - 20, 255);

  doc.setTextColor(primaryNavy);
  doc.setFontSize(9);
  doc.text('TEAM REMOTE OPTOMETRY', pageWidth / 2, 268, { align: 'center' });
  
  doc.setTextColor('#94A3B8');
  doc.setFontSize(7);
  doc.text('YOUR SCHEDULE. YOUR RESPONSIBILITY. YOUR TEAM.', pageWidth / 2, 275, { align: 'center' });

  // 8. Secure Buffer Dispatch
  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}
