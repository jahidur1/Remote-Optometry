
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

/**
 * Exports data to CSV with generic structure
 */
export function exportToCSV(filename: string, data: any[]) {
  const worksheet = XLSX.utils.json_to_sheet(data);
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
 * Exports roster data to a highly readable Excel-compatible format.
 * Includes Professional details, Weekly Offs, and exact Shift Timings.
 */
export function exportRosterReport(
  filename: string, 
  assignments: any[], 
  employees: any[], 
  shifts: any[],
  bookings: any[] // Confirmed Weekly Offs
) {
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  const reportData = employees.map(emp => {
    // Find confirmed weekly off for this specific employee
    const userOff = bookings.find(b => b.employeeId === emp.id)?.dayOfWeek || 'UNSET';

    const row: any = {
      'Professional ID': emp.id,
      'Full Name': emp.fullName,
      'Email': emp.email,
      'Department': emp.department || 'CLINICAL',
      'Designation': emp.designation || 'N/A',
      'Confirmed Weekly-Off': userOff
    };
    
    DAYS.forEach(day => {
      const assignment = assignments.find(a => a.employeeId === emp.id && a.dayOfWeek === day);
      const shift = shifts.find(s => s.id === assignment?.shiftId);
      
      // Determine label: Check if it's the confirmed off day or a scheduled shift
      if (day === userOff) {
        row[day] = 'PROTECTED WEEKLY-OFF';
      } else if (assignment && shift) {
        row[day] = `${shift.name} [${shift.startTime}-${shift.endTime}]`;
      } else {
        row[day] = 'UNASSIGNED';
      }
    });
    
    return row;
  });

  // Create workbook for a more structured export if needed, otherwise stick to standard high-quality CSV
  const worksheet = XLSX.utils.json_to_sheet(reportData);
  
  // Set column widths for Excel readability
  const wscols = [
    {wch: 15}, // ID
    {wch: 25}, // Name
    {wch: 30}, // Email
    {wch: 20}, // Dept
    {wch: 20}, // Desig
    {wch: 25}, // Weekly Off
    ...Array(7).fill({wch: 30}) // Days
  ];
  worksheet['!cols'] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Roster");
  
  // Generate download
  XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
