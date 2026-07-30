import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

async function fetchLogs(from, to) {
  try {
    const res = await fetch(`${API_BASE_URL}/crowd/logs?from_date=${from}&to_date=${to}`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

async function fetchAlertLogs(from, to) {
  try {
    // Fetch both resolved and unresolved alerts so the report is a complete history
    const [unresolvedRes, resolvedRes] = await Promise.all([
      fetch(`${API_BASE_URL}/alerts?resolved=false&from_date=${from}&to_date=${to}`),
      fetch(`${API_BASE_URL}/alerts?resolved=true&from_date=${from}&to_date=${to}`),
    ]);
    const unresolved = unresolvedRes.ok ? await unresolvedRes.json() : [];
    const resolved   = resolvedRes.ok   ? await resolvedRes.json()   : [];
    // Merge and sort by triggered_at descending
    return [...unresolved, ...resolved].sort((a, b) =>
      new Date(b.triggered_at || 0) - new Date(a.triggered_at || 0)
    );
  } catch { return []; }
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function drawPageHeader(doc, fromDate, toDate, pageW) {
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, pageW, 36, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('CrowdSense', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(165, 180, 252);
  doc.text('Intelligent Crowd Control System  —  Activity Report', 14, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(199, 210, 254);
  doc.text(`Period: ${fromDate}  to  ${toDate}`, 14, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`, pageW - 14, 30, { align: 'right' });
}

function drawSectionTitle(doc, text, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(79, 70, 229);
  doc.text(text, 14, y);
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.35);
  doc.line(14, y + 2, 196, y + 2);
  return y + 9;
}

function kpiBox(doc, x, y, w, h, label, value, bgRGB, valueRGB) {
  doc.setFillColor(...bgRGB);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F');
  doc.setDrawColor(220, 220, 235);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(label.toUpperCase(), x + 5, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...valueRGB);
  doc.text(String(value), x + 5, y + 19);
}

export async function generateReport({ fromDate, toDate, stats, loggedInUser, userRole }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const addFooter = () => {
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFillColor(248, 250, 252);
      doc.rect(0, pageH - 11, pageW, 11, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(0, pageH - 11, pageW, pageH - 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `CrowdSense  |  User: ${loggedInUser?.username || userRole}  |  Role: ${userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}`,
        14, pageH - 4
      );
      doc.text(`Page ${i} of ${total}`, pageW - 14, pageH - 4, { align: 'right' });
    }
  };

  // ── Page 1 ───────────────────────────────────────────────────────────────
  drawPageHeader(doc, fromDate, toDate, pageW);
  let y = 46;

  // KPI row
  y = drawSectionTitle(doc, 'Summary Statistics', y);
  const bw = 43, bh = 27, gap = 3.5, sx = 14;
  kpiBox(doc, sx,              y, bw, bh, 'Current Occupancy', stats.currentOccupancy, [238,242,255], [79,70,229]);
  kpiBox(doc, sx+bw+gap,       y, bw, bh, 'Max Capacity',      stats.maxCapacity,      [240,253,244], [5,150,105]);
  kpiBox(doc, sx+(bw+gap)*2,   y, bw, bh, 'Total Entries',     stats.entries,          [240,253,244], [5,150,105]);
  kpiBox(doc, sx+(bw+gap)*3,   y, bw, bh, 'Total Exits',       stats.exits,            [254,242,242], [220,38,38]);
  y += bh + 12;

  // Fetch data in parallel
  const [logs, alertLogs] = await Promise.all([
    fetchLogs(fromDate, toDate),
    fetchAlertLogs(fromDate, toDate),
  ]);

  // ── Crowd log table ──────────────────────────────────────────────────────
  y = drawSectionTitle(doc, `Crowd Activity Log  (${logs.length} records)`, y);

  if (logs.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('No crowd log data found for the selected date range.', 14, y + 4);
    y += 14;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Timestamp', 'Mode', 'Source', 'Crowd Count', 'Delta', 'Confidence']],
      body: logs.slice(0, 300).map(r => [
        fmtDate(r.timestamp || r.created_at),
        r.mode   || '—',
        r.source || '—',
        r.crowd_count ?? '—',
        r.delta != null ? (r.delta > 0 ? `+${r.delta}` : String(r.delta)) : '—',
        r.confidence != null ? `${(r.confidence * 100).toFixed(1)}%` : '—',
      ]),
      styles:           { fontSize: 7.5, cellPadding: 2.8, textColor: [15, 23, 42] },
      headStyles:       { fillColor: [30, 27, 75], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 38 },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => drawPageHeader(doc, fromDate, toDate, pageW),
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  // ── Alerts table ─────────────────────────────────────────────────────────
  if (y > pageH - 60) { doc.addPage(); drawPageHeader(doc, fromDate, toDate, pageW); y = 46; }
  y = drawSectionTitle(doc, `Alert Log  (${alertLogs.length} records)`, y);

  if (alertLogs.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('No alerts recorded for the selected date range.', 14, y + 4);
  } else {
    const severityColor = (s) => {
      switch ((s || '').toLowerCase()) {
        case 'critical': return [220, 38, 38];
        case 'warning':  return [217, 119, 6];
        default:         return [37, 99, 235];
      }
    };
    autoTable(doc, {
      startY: y,
      head: [['Timestamp', 'Severity', 'Crowd', 'Capacity', 'Message']],
      body: alertLogs.map(r => [
        fmtDate(r.triggered_at || r.timestamp || r.created_at),
        (r.severity || '—').toUpperCase(),
        r.crowd_count  ?? '—',
        r.max_capacity ?? '—',
        r.message || '—',
      ]),
      styles:           { fontSize: 7.5, cellPadding: 2.8, textColor: [15, 23, 42] },
      headStyles:       { fillColor: [153, 27, 27], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [255, 249, 249] },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { halign: 'center', fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          data.cell.styles.textColor = severityColor(data.cell.raw);
        }
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => drawPageHeader(doc, fromDate, toDate, pageW),
    });
  }

  addFooter();
  doc.save(`CrowdSense_Report_${fromDate}_to_${toDate}.pdf`);
}
