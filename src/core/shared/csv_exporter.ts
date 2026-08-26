/**
 * Utility to convert tabular JSON data to CSV and trigger browser download
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const sanitize = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map(h => sanitize(h)).join(',');
  const bodyRows = rows.map(row => row.map(cell => sanitize(cell)).join(',')).join('\n');
  const csvContent = `${headerRow}\n${bodyRows}`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
