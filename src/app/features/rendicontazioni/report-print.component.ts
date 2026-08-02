import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { jsPDF } from 'jspdf';
import { ReportingApiService, MonthlyReportDto } from '../../reporting/reporting-api.service';

function formatMonth(iso: string): string {
  const [year, mon] = iso.split('-');
  const names = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  return `${names[parseInt(mon, 10) - 1]} ${year}`;
}

@Component({
  selector: 'app-report-print',
  template: `
    <div class="print-page">
      <!-- Toolbar (hidden in print/PDF) -->
      <div class="toolbar no-print">
        @if (loading()) {
          <span class="loading-msg">Caricamento…</span>
        } @else if (error()) {
          <span class="error-msg">Errore nel caricamento del report</span>
        } @else {
          <button class="btn-pdf" (click)="savePdf()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 15V3m0 12-4-4m4 4 4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17"/>
            </svg>
            Scarica PDF
          </button>
        }
      </div>

      @if (report(); as r) {
        <div class="busta-paga" id="bp-content">

          <!-- Header -->
          <div class="bp-header">
            <div class="company-info">
              <div class="company-name">Imprendig</div>
              <div class="company-sub">Report compenso mensile</div>
            </div>
            <div class="period-badge">{{ monthLabel() }}</div>
          </div>

          <!-- Dipendente -->
          <div class="bp-employee">
            <div class="emp-avatar">{{ r.employee.name.charAt(0).toUpperCase() }}</div>
            <div class="emp-details">
              <div class="emp-name">{{ r.employee.name }}</div>
              <div class="emp-meta">
                {{ r.employee.type === 'seller' ? 'Venditore' : 'Setter' }}
                @if (r.employee.email) { · {{ r.employee.email }} }
              </div>
            </div>
          </div>

          <!-- Sezione 1: Provvigioni -->
          @if (r.commissions.length > 0) {
            <div class="bp-section">
              <div class="section-title">Provvigioni su vendite</div>
              <table class="bp-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Piano</th>
                    <th>Rata</th>
                    <th class="text-right">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of r.commissions; track c.id) {
                    <tr>
                      <td>{{ c.customerName }}</td>
                      <td class="muted">{{ c.planName }}</td>
                      <td class="muted">
                        @if (c.installmentNumber) {
                          {{ c.installmentNumber }}/{{ c.totalInstallments ?? '?' }}
                        }
                      </td>
                      <td class="text-right">€ {{ fmt(c.amount) }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="subtotal-row">
                    <td colspan="3">Subtotale provvigioni</td>
                    <td class="text-right">€ {{ fmt(r.subtotalCommissions) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }

          <!-- Sezione 2: Commesse (timesheet) -->
          @if (r.timesheetItems.length > 0) {
            <div class="bp-section">
              <div class="section-title">Commesse</div>
              <table class="bp-table">
                <thead>
                  <tr>
                    <th>Descrizione</th>
                    <th>Tipo</th>
                    <th class="text-right">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of r.timesheetItems; track item.id) {
                    <tr>
                      <td>{{ item.description }}</td>
                      <td class="muted">
                        @if (item.type === 'fixed') { Fisso }
                        @else { {{ item.percentageRate }}% di €{{ fmt(item.baseAmount ?? 0) }} }
                      </td>
                      <td class="text-right">€ {{ fmt(item.computedAmount) }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="subtotal-row">
                    <td colspan="2">Subtotale commesse</td>
                    <td class="text-right">€ {{ fmt(r.subtotalTimesheetItems) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }

          <!-- Riepilogo finale -->
          <div class="bp-summary">
            <div class="summary-line">
              <span>Totale provvigioni</span>
              <span>€ {{ fmt(r.subtotalCommissions) }}</span>
            </div>
            <div class="summary-line">
              <span>Totale commesse</span>
              <span>€ {{ fmt(r.subtotalTimesheetItems) }}</span>
            </div>
            <div class="summary-line gross-line">
              <span>Totale lordo</span>
              <span>€ {{ fmt(r.grossTotal) }}</span>
            </div>
            @if (r.balance.current !== 0) {
              <div class="summary-line balance-line" [class.neg]="r.balance.current < 0" [class.pos]="r.balance.current > 0">
                <span>
                  Saldo residuo
                  @if (r.balance.notes) { <small>({{ r.balance.notes }})</small> }
                </span>
                <span>{{ r.balance.current >= 0 ? '+' : '' }}€ {{ fmt(r.balance.current) }}</span>
              </div>
            }
            <div class="summary-divider"></div>
            <div class="summary-line net-line">
              <span>NETTO DA PAGARE</span>
              <span class="net-amount">€ {{ fmt(r.netPayable) }}</span>
            </div>
            @if (r.balanceAfterPayment !== 0) {
              <div class="summary-note">
                Saldo dopo pagamento:
                <strong [class.neg]="r.balanceAfterPayment < 0" [class.pos]="r.balanceAfterPayment > 0">
                  {{ r.balanceAfterPayment >= 0 ? '+' : '' }}€ {{ fmt(r.balanceAfterPayment) }}
                </strong>
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="bp-footer">
            Documento generato il {{ today() }} · Imprendig
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .print-page {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
      padding: 24px;
    }

    /* ── Toolbar ─── */
    .toolbar {
      max-width: 800px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .btn-pdf {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 20px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background .15s;
    }
    .btn-pdf:hover { background: #4338ca; }

    .loading-msg, .error-msg { font-size: 14px; color: #6b7280; }
    .error-msg { color: #dc2626; }

    /* ── Busta paga card ─── */
    .busta-paga {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,.12);
      padding: 40px 48px;
    }

    /* ── Header ─── */
    .bp-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 2px solid #e5e7eb;
    }

    .company-name {
      font-size: 22px;
      font-weight: 800;
      color: #111827;
      letter-spacing: -.02em;
    }

    .company-sub {
      font-size: 12px;
      color: #6b7280;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: .06em;
    }

    .period-badge {
      background: #4f46e5;
      color: white;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 20px;
    }

    /* ── Employee block ─── */
    .bp-employee {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 32px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 12px;
    }

    .emp-avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #4f46e5;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .emp-name { font-size: 20px; font-weight: 700; color: #111827; }
    .emp-meta { font-size: 13px; color: #6b7280; margin-top: 4px; }

    /* ── Sections ─── */
    .bp-section { margin-bottom: 28px; }

    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #9ca3af;
      margin-bottom: 10px;
    }

    /* ── Table ─── */
    .bp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .bp-table th {
      text-align: left;
      padding: 7px 10px;
      background: #f9fafb;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #9ca3af;
      letter-spacing: .04em;
      border-top: 1px solid #f3f4f6;
      border-bottom: 1px solid #f3f4f6;
    }

    .bp-table td {
      padding: 9px 10px;
      border-bottom: 1px solid #f9fafb;
      color: #374151;
      vertical-align: middle;
    }

    .bp-table tbody tr:last-child td { border-bottom: none; }
    .bp-table .muted { color: #9ca3af; }
    .bp-table .text-right { text-align: right; }

    .bp-table tfoot td {
      padding: 10px 10px 2px;
      border-top: 1px solid #e5e7eb;
    }

    .subtotal-row { font-weight: 600; color: #111827; }
    .subtotal-row .text-right { color: #4f46e5; }

    /* ── Summary ─── */
    .bp-summary {
      background: #f9fafb;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 9px;
      margin-top: 8px;
    }

    .summary-line {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: #374151;
    }

    .gross-line { font-weight: 600; color: #111827; }
    .balance-line { font-size: 13px; }
    .balance-line.neg { color: #dc2626; }
    .balance-line.pos { color: #16a34a; }

    .summary-divider { height: 1px; background: #d1d5db; margin: 4px 0; }

    .net-line { font-size: 16px; font-weight: 700; color: #111827; }
    .net-amount { font-size: 24px; font-weight: 800; color: #4f46e5; }

    .summary-note { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .neg { color: #dc2626; }
    .pos { color: #16a34a; }

    /* ── Footer ─── */
    .bp-footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #f3f4f6;
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
      letter-spacing: .02em;
    }

    /* ── Print / Save as PDF ─── */
    @media print {
      @page {
        size: A4;
        margin: 1.5cm 2cm;
      }

      .no-print { display: none !important; }

      .print-page {
        background: white;
        padding: 0;
        min-height: auto;
      }

      .busta-paga {
        box-shadow: none;
        border-radius: 0;
        padding: 0;
        max-width: 100%;
      }
    }
  `],
})
export class ReportPrintComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ReportingApiService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly report = signal<MonthlyReportDto | null>(null);
  readonly monthLabel = signal('');
  readonly downloading = signal(false);

  private empName = '';
  private month = '';

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    const type = params.get('type') as 'seller' | 'setter' | null;
    const id = Number(params.get('id'));
    this.month = params.get('month') ?? '';

    if (!type || !id || !this.month) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }

    this.monthLabel.set(formatMonth(this.month));

    this.api.getReport(type, id, this.month).subscribe({
      next: data => {
        this.report.set(data);
        this.empName = data.employee.name;
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  savePdf() {
    const r = this.report();
    if (!r) return;
    this.downloading.set(true);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const L = 18;
      const R = 192;
      const W = R - L;
      const ACCENT: [number, number, number] = [79, 70, 229];
      const INK: [number, number, number] = [17, 24, 39];
      const MUTED: [number, number, number] = [107, 114, 128];
      const BORDER: [number, number, number] = [229, 231, 235];

      let y = 22;

      // ── Header ──────────────────────────────────────────────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...INK);
      doc.text('Imprendig', L, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text('REPORT COMPENSO MENSILE', L, y + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...ACCENT);
      doc.text(this.monthLabel(), R, y, { align: 'right' });

      y += 11;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(L, y, R, y);

      y += 11;

      // ── Dipendente ──────────────────────────────────────────
      doc.setFillColor(...ACCENT);
      doc.circle(L + 6, y, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(r.employee.name.charAt(0).toUpperCase(), L + 6, y + 1, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...INK);
      doc.text(r.employee.name, L + 15, y - 1);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      const roleLabel = r.employee.type === 'seller' ? 'Venditore' : 'Setter';
      const metaLine = r.employee.email ? `${roleLabel} · ${r.employee.email}` : roleLabel;
      doc.text(metaLine, L + 15, y + 5);

      y += 17;

      // ── Helper: section table ──────────────────────────────
      const ROW_H = 7;

      const drawTable = (
        title: string,
        headers: string[],
        rows: string[][],
        colWidths: number[],
        aligns: Array<'left' | 'right'>,
        subtotalLabel: string,
        subtotalValue: string,
      ) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(title, L, y);
        y += 5;

        // Header row
        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.2);
        doc.rect(L, y, W, ROW_H, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        let x = L;
        headers.forEach((h, i) => {
          const xPos = aligns[i] === 'right' ? x + colWidths[i] - 2 : x + 2;
          doc.text(h, xPos, y + 4.5, { align: aligns[i] });
          x += colWidths[i];
        });
        y += ROW_H;

        // Data rows
        rows.forEach(row => {
          doc.setDrawColor(...BORDER);
          doc.setLineWidth(0.2);
          doc.rect(L, y, W, ROW_H, 'D');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...INK);
          let x2 = L;
          row.forEach((cell, i) => {
            if (i > 0) doc.setTextColor(...MUTED);
            else doc.setTextColor(...INK);
            const xPos = aligns[i] === 'right' ? x2 + colWidths[i] - 2 : x2 + 2;
            doc.text(cell, xPos, y + 4.5, { align: aligns[i] });
            x2 += colWidths[i];
          });
          y += ROW_H;
        });

        // Subtotal row
        doc.setFillColor(238, 240, 251);
        doc.rect(L, y, W, ROW_H, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...ACCENT);
        doc.text(subtotalLabel, L + 2, y + 4.5);
        doc.text(subtotalValue, R - 2, y + 4.5, { align: 'right' });
        y += ROW_H + 10;
      };

      // ── Provvigioni ─────────────────────────────────────────
      if (r.commissions.length > 0) {
        drawTable(
          'PROVVIGIONI SU VENDITE',
          ['CLIENTE', 'PIANO', 'RATA', 'IMPORTO'],
          r.commissions.map(c => [
            c.customerName,
            c.planName,
            c.installmentNumber ? `${c.installmentNumber}/${c.totalInstallments ?? '?'}` : '—',
            `€ ${this.fmt(c.amount)}`,
          ]),
          [58, 58, 20, W - 136],
          ['left', 'left', 'left', 'right'],
          'Subtotale provvigioni',
          `€ ${this.fmt(r.subtotalCommissions)}`,
        );
      }

      // ── Commesse (timesheet) ────────────────────────────────
      if (r.timesheetItems.length > 0) {
        drawTable(
          'COMMESSE',
          ['DESCRIZIONE', 'TIPO', 'IMPORTO'],
          r.timesheetItems.map(item => [
            item.description,
            item.type === 'fixed'
              ? 'Fisso'
              : `${item.percentageRate}% di €${this.fmt(item.baseAmount ?? 0)}`,
            `€ ${this.fmt(item.computedAmount)}`,
          ]),
          [90, W - 90 - 30, 30],
          ['left', 'left', 'right'],
          'Subtotale commesse',
          `€ ${this.fmt(r.subtotalTimesheetItems)}`,
        );
      }

      // ── Riepilogo ────────────────────────────────────────────
      const hasBalance = r.balance.current !== 0;
      const summaryRows = 3 + (hasBalance ? 1 : 0);
      const summaryH = summaryRows * ROW_H + 14;
      doc.setDrawColor(...BORDER);
      doc.setFillColor(249, 250, 251);
      doc.setLineWidth(0.3);
      doc.roundedRect(L, y, W, summaryH, 2, 2, 'FD');

      const sumLine = (label: string, value: string, bold = false, color: [number, number, number] = MUTED) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...(bold ? INK : MUTED));
        doc.text(label, L + 4, y + 5);
        doc.setTextColor(...color);
        doc.text(value, R - 4, y + 5, { align: 'right' });
        y += ROW_H;
      };

      sumLine('Totale provvigioni', `€ ${this.fmt(r.subtotalCommissions)}`);
      sumLine('Totale commesse', `€ ${this.fmt(r.subtotalTimesheetItems)}`);
      sumLine('Totale lordo', `€ ${this.fmt(r.grossTotal)}`, true, INK);
      if (hasBalance) {
        const bColor: [number, number, number] = r.balance.current >= 0 ? [21, 128, 61] : [185, 28, 28];
        const bLabel = `Saldo residuo${r.balance.notes ? ` (${r.balance.notes})` : ''}`;
        const bValue = `${r.balance.current >= 0 ? '+' : ''}€ ${this.fmt(r.balance.current)}`;
        sumLine(bLabel, bValue, false, bColor);
      }

      y += 3;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(L + 4, y, R - 4, y);
      y += 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text('NETTO DA PAGARE', L + 4, y);
      doc.setFontSize(13);
      doc.setTextColor(...ACCENT);
      doc.text(`€ ${this.fmt(r.netPayable)}`, R - 4, y, { align: 'right' });
      y += 16;

      // ── Footer ───────────────────────────────────────────────
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Documento generato il ${this.today()} · Imprendig`, 105, y, { align: 'center' });

      doc.save(`${r.employee.name.replace(/\s+/g, '_')}_${this.month}.pdf`);
    } catch (e) {
      console.error('PDF generation failed', e);
    } finally {
      this.downloading.set(false);
    }
  }

  fmt(n: number | null | undefined): string {
    return Number(n ?? 0).toFixed(2);
  }

  today(): string {
    return new Date().toLocaleDateString('it-IT');
  }
}
