import * as XLSX from 'xlsx';
import { format } from 'date-fns';

/**
 * Exports structured JSON data to a standard CSV file.
 * Enhanced with formula injection protection (strip leading = + - @).
 */
export function exportToCSV(filename: string, data: any[]) {
  const sanitize = (val: any) => {
    if (typeof val === 'string' && /^[=+\-@]/.test(val)) return `'${val}`;
    return val;
  };

  const sanitizedData = data.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(key => newRow[key] = sanitize(row[key]));
    return newRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(sanitizedData);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Generates a professional Excel (.xlsx) roster report with specific sheet formatting.
 * Handles the distinction between 'Closing' and 'Closing 2' while marking Weekly-Offs clearly.
 */
export function exportRosterReport(
  filename: string, 
  assignments: any[], 
  employees: any[], 
  shifts: any[],
  bookings: any[]
) {
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  const reportData = employees.map(emp => {
    // Determine the FCFS confirmed weekly off for this specific professional
    const userOff = bookings.find(b => b.employeeId === emp.id)?.dayOfWeek || 'NOT_BOOKED';

    const row: any = {
      'Professional ID': emp.id,
      'Full Name': emp.fullName,
      'Office': emp.office?.replace('_', ' ') || 'N/A',
      'Clinical Unit': emp.department || 'CLINICAL',
      'Designation': emp.designation || 'STAFF',
      'Secured Weekly-Off': userOff
    };
    
    DAYS.forEach(day => {
      const assignment = assignments.find(a => a.employeeId === emp.id && a.dayOfWeek === day);
      const shift = shifts.find(s => s.id === assignment?.shiftId);
      
      if (day === userOff) {
        row[day] = 'PROTECTED WEEKLY-OFF';
      } else if (assignment && shift) {
        row[day] = `${shift.name} [${shift.startTime} - ${shift.endTime}]`;
      } else {
        row[day] = 'UNASSIGNED / LEAVE';
      }
    });
    
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(reportData);
  
  // Institutional Readability: Standard Column Widths
  const wscols = [
    {wch: 15}, // ID
    {wch: 25}, // Name
    {wch: 15}, // Office
    {wch: 20}, // Dept
    {wch: 20}, // Desig
    {wch: 20}, // Weekly Off
    ...Array(7).fill({wch: 32}) // Days with Timings
  ];
  worksheet['!cols'] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clinical Roster");
  
  XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
