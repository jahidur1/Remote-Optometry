
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

/**
 * Exports data to CSV
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
 * Exports roster data to a highly readable Excel-compatible CSV format
 */
export function exportRosterReport(filename: string, assignments: any[], employees: any[], shifts: any[]) {
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  const reportData = employees.map(emp => {
    const row: any = {
      'Employee ID': emp.id,
      'Full Name': emp.fullName,
      'Email': emp.email,
      'Department': emp.department || 'N/A',
      'Designation': emp.designation || 'N/A'
    };
    
    DAYS.forEach(day => {
      const assignment = assignments.find(a => a.employeeId === emp.id && a.dayOfWeek === day);
      const shift = shifts.find(s => s.id === assignment?.shiftId);
      row[day] = assignment ? `${shift?.name} (${shift?.startTime}-${shift?.endTime})` : 'OFF/UNASSIGNED';
    });
    
    return row;
  });

  exportToCSV(filename, reportData);
}
