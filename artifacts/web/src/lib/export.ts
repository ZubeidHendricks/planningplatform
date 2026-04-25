export function exportToCSV(
  headers: string[],
  rows: (string | number | null)[][],
  filename: string,
): void {
  const escape = (val: string | number | null): string => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const csv = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n');

  downloadFile(csv, filename + '.csv', 'text/csv;charset=utf-8;');
}

export function exportToJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, filename + '.json', 'application/json');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportToPNG(element: HTMLElement, filename: string): Promise<void> {
  const canvas = document.createElement('canvas');
  const rect = element.getBoundingClientRect();
  const scale = 2;
  canvas.width = rect.width * scale;
  canvas.height = rect.height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);
  ctx.fillStyle = getComputedStyle(element).backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, rect.width, rect.height);

  const svgData = new XMLSerializer().serializeToString(element);
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        resolve();
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      resolve();
    };
    img.src = svgUrl;
  });
}
