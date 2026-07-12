import { Call, Client, CommissionPoint, Deal, Seller } from './models';
import { atTime, TODAY } from './utils';

export const SELLERS: Seller[] = [
  { id: 'marco',  name: 'Marco Bianchi',  initials: 'MB', color: '#4f46e5', role: 'Senior Sales' },
  { id: 'giulia', name: 'Giulia Ferrari', initials: 'GF', color: '#0d9488', role: 'Sales' },
  { id: 'luca',   name: 'Luca Romano',    initials: 'LR', color: '#db8c0e', role: 'Sales' },
  { id: 'sara',   name: 'Sara Conti',     initials: 'SC', color: '#be185d', role: 'Junior Sales' },
];

export const ADMIN: Seller = { id: 'admin', name: 'Elena Riva', initials: 'ER', color: '#1f2937', role: 'Sales Manager' };

export const CALLS: Call[] = [
  { setterId: null, id: 'c01', sellerId: 'marco',  client: 'Andrea Gallo',      company: 'Logitech Italia',    type: 'demo',      status: 'da-fare', statusCode: null,          statusOptionId: null, value: 8500,  when: atTime(TODAY, 0, 9, 30),  link: 'meet.imprendig.it/a-gallo',    notes: null, formCliente: null },
  { setterId: null, id: 'c02', sellerId: 'marco',  client: 'Francesca Neri',    company: 'Sartoria Neri SRL',  type: 'closing',   status: 'da-fare', statusCode: null,          statusOptionId: null, value: 14200, when: atTime(TODAY, 0, 11, 0),  link: 'meet.imprendig.it/f-neri',     notes: null, formCliente: null },
  { setterId: null, id: 'c03', sellerId: 'giulia', client: 'Davide Conte',      company: 'ConteBuild SPA',     type: 'follow-up', status: 'fatta',   statusCode: 'si',          statusOptionId: 1,    value: 6200,  when: atTime(TODAY, 0, 10, 0),  link: 'meet.imprendig.it/d-conte',    notes: 'Cliente interessato, inviato preventivo.', formCliente: null },
  { setterId: null, id: 'c04', sellerId: 'luca',   client: 'Martina Greco',     company: 'Greco Pharma',       type: 'demo',      status: 'da-fare', statusCode: null,          statusOptionId: null, value: 9800,  when: atTime(TODAY, 0, 14, 30), link: 'meet.imprendig.it/m-greco',    notes: null, formCliente: null },
  { setterId: null, id: 'c05', sellerId: 'sara',   client: 'Paolo Riva',        company: 'Riva Logistica',     type: 'follow-up', status: 'no-show', statusCode: 'no-show',     statusOptionId: 4,    value: 4300,  when: atTime(TODAY, 0, 15, 0),  link: 'meet.imprendig.it/p-riva',     notes: null, formCliente: null },
  { setterId: null, id: 'c06', sellerId: 'marco',  client: 'Chiara Fontana',    company: 'Fontana Design',     type: 'demo',      status: 'da-fare', statusCode: null,          statusOptionId: null, value: 5600,  when: atTime(TODAY, 0, 16, 30), link: 'meet.imprendig.it/c-fontana',  notes: null, formCliente: null },
  { setterId: null, id: 'c07', sellerId: 'giulia', client: 'Stefano Marini',    company: 'Marini & Co',        type: 'closing',   status: 'da-fare', statusCode: null,          statusOptionId: null, value: 21000, when: atTime(TODAY, 1, 9, 0),   link: 'meet.imprendig.it/s-marini',   notes: null, formCliente: null },
  { setterId: null, id: 'c08', sellerId: 'luca',   client: 'Valentina Costa',   company: 'Costa Tessile',      type: 'demo',      status: 'da-fare', statusCode: null,          statusOptionId: null, value: 7400,  when: atTime(TODAY, 1, 11, 30), link: 'meet.imprendig.it/v-costa',    notes: null, formCliente: null },
  { setterId: null, id: 'c09', sellerId: 'sara',   client: 'Roberto Esposito',  company: 'Esposito Auto',      type: 'follow-up', status: 'da-fare', statusCode: null,          statusOptionId: null, value: 3900,  when: atTime(TODAY, 1, 14, 0),  link: 'meet.imprendig.it/r-esposito', notes: null, formCliente: null },
  { setterId: null, id: 'c10', sellerId: 'marco',  client: 'Giorgia Ricci',     company: 'Ricci Hotels',       type: 'closing',   status: 'da-fare', statusCode: null,          statusOptionId: null, value: 18500, when: atTime(TODAY, 1, 16, 0),  link: 'meet.imprendig.it/g-ricci',    notes: null, formCliente: null },
  { setterId: null, id: 'c11', sellerId: 'giulia', client: 'Alessio Moretti',   company: 'Moretti Group',      type: 'demo',      status: 'da-fare', statusCode: null,          statusOptionId: null, value: 11200, when: atTime(TODAY, 2, 10, 30), link: 'meet.imprendig.it/a-moretti',  notes: null, formCliente: null },
  { setterId: null, id: 'c12', sellerId: 'luca',   client: 'Federica Galli',    company: 'Galli Food',         type: 'follow-up', status: 'da-fare', statusCode: null,          statusOptionId: null, value: 5100,  when: atTime(TODAY, 2, 15, 30), link: 'meet.imprendig.it/f-galli',    notes: null, formCliente: null },
  { setterId: null, id: 'c13', sellerId: 'sara',   client: 'Matteo Rizzo',      company: 'Rizzo Consulting',   type: 'demo',      status: 'da-fare', statusCode: null,          statusOptionId: null, value: 6700,  when: atTime(TODAY, 3, 9, 30),  link: 'meet.imprendig.it/m-rizzo',    notes: null, formCliente: null },
  { setterId: null, id: 'c14', sellerId: 'marco',  client: 'Elisa Barbieri',    company: 'Barbieri Pharma',    type: 'closing',   status: 'da-fare', statusCode: null,          statusOptionId: null, value: 16800, when: atTime(TODAY, 3, 11, 0),  link: 'meet.imprendig.it/e-barbieri', notes: null, formCliente: null },
  { setterId: null, id: 'c15', sellerId: 'marco',  client: 'Simone Ferro',      company: 'Ferro Industrie',    type: 'closing',   status: 'fatta',   statusCode: 'si',          statusOptionId: 1,    value: 24500, when: atTime(TODAY, -1, 10, 0), link: '', notes: 'Contratto firmato.', formCliente: null },
  { setterId: null, id: 'c16', sellerId: 'giulia', client: 'Laura De Luca',     company: 'De Luca Studio',     type: 'demo',      status: 'fatta',   statusCode: 'ci-pensa',    statusOptionId: 7,    value: 7800,  when: atTime(TODAY, -1, 14, 0), link: '', notes: 'Ricontattare la settimana prossima.', formCliente: null },
  { setterId: null, id: 'c17', sellerId: 'luca',   client: 'Nicola Santoro',    company: 'Santoro Energia',    type: 'follow-up', status: 'no-show', statusCode: 'no-show',     statusOptionId: 4,    value: 9200,  when: atTime(TODAY, -1, 16, 0), link: '', notes: null, formCliente: null },
  { setterId: null, id: 'c18', sellerId: 'sara',   client: 'Beatrice Lombardi', company: 'Lombardi Retail',    type: 'closing',   status: 'fatta',   statusCode: 'no',          statusOptionId: 2,    value: 13400, when: atTime(TODAY, -2, 11, 0), link: '', notes: 'Budget non sufficiente per il piano enterprise.', formCliente: null },
];

export const DEALS: Deal[] = [
  { id: 'd01', sellerId: 'marco',  client: 'Ferro Industrie',  value: 24500, commType: 'scaglione',   rate: 0.12, commission: 2940, date: atTime(TODAY, -1, 0, 0),  month: 'Mag' },
  { id: 'd02', sellerId: 'marco',  client: 'BluMare SRL',      value: 16000, commType: 'percentuale', rate: 0.08, commission: 1280, date: atTime(TODAY, -5, 0, 0),  month: 'Mag' },
  { id: 'd03', sellerId: 'marco',  client: 'TechNova',         value: 9800,  commType: 'fisso',       rate: null, commission: 800,  date: atTime(TODAY, -9, 0, 0),  month: 'Mag' },
  { id: 'd04', sellerId: 'giulia', client: 'ConteBuild SPA',   value: 6200,  commType: 'percentuale', rate: 0.08, commission: 496,  date: atTime(TODAY, -3, 0, 0),  month: 'Mag' },
  { id: 'd05', sellerId: 'giulia', client: 'De Luca Studio',   value: 7800,  commType: 'scaglione',   rate: 0.10, commission: 780,  date: atTime(TODAY, -6, 0, 0),  month: 'Mag' },
  { id: 'd06', sellerId: 'luca',   client: 'Aurora Spa',       value: 12300, commType: 'percentuale', rate: 0.08, commission: 984,  date: atTime(TODAY, -7, 0, 0),  month: 'Mag' },
  { id: 'd07', sellerId: 'sara',   client: 'Lombardi Retail',  value: 13400, commType: 'fisso',       rate: null, commission: 800,  date: atTime(TODAY, -2, 0, 0),  month: 'Mag' },
  { id: 'd08', sellerId: 'sara',   client: 'Verdi Group',      value: 4200,  commType: 'percentuale', rate: 0.06, commission: 252,  date: atTime(TODAY, -11, 0, 0), month: 'Mag' },
];

export const COMMISSION_SERIES: Record<string, CommissionPoint[]> = {
  marco:  [{ m: 'Dic', v: 3100 }, { m: 'Gen', v: 2750 }, { m: 'Feb', v: 4200 }, { m: 'Mar', v: 3800 }, { m: 'Apr', v: 4600 }, { m: 'Mag', v: 5020 }],
  giulia: [{ m: 'Dic', v: 1800 }, { m: 'Gen', v: 2200 }, { m: 'Feb', v: 1950 }, { m: 'Mar', v: 2600 }, { m: 'Apr', v: 2400 }, { m: 'Mag', v: 1276 }],
  luca:   [{ m: 'Dic', v: 1500 }, { m: 'Gen', v: 1700 }, { m: 'Feb', v: 2100 }, { m: 'Mar', v: 1900 }, { m: 'Apr', v: 1600 }, { m: 'Mag', v: 984  }],
  sara:   [{ m: 'Dic', v: 600  }, { m: 'Gen', v: 900  }, { m: 'Feb', v: 1100 }, { m: 'Mar', v: 1300 }, { m: 'Apr', v: 1500 }, { m: 'Mag', v: 1052 }],
};

export const CLIENTS: Client[] = [
  { id: 'cl01', sellerId: 'marco', setterId: null, setterName: null, name: 'Ferro Industrie',   contact: 'Simone Ferro',      plan: 'Enterprise', mrr: 2040, payStatus: 'pagato',  lastPay: atTime(TODAY, -1, 0, 0),  nextPay: atTime(TODAY, 29, 0, 0),  stripe: 'cus_Pk9Fe2', totalPaid: 24500, method: 'Visa ·· 4242' },
  { id: 'cl02', sellerId: 'marco', setterId: null, setterName: null, name: 'BluMare SRL',       contact: 'Anna Russo',        plan: 'Pro',        mrr: 1330, payStatus: 'pagato',  lastPay: atTime(TODAY, -4, 0, 0),  nextPay: atTime(TODAY, 26, 0, 0),  stripe: 'cus_Qm3Lp8', totalPaid: 15960, method: 'Mastercard ·· 8810' },
  { id: 'cl03', sellerId: 'marco', setterId: null, setterName: null, name: 'TechNova',          contact: 'Marco Villa',       plan: 'Pro',        mrr: 980,  payStatus: 'pending', lastPay: atTime(TODAY, -32, 0, 0), nextPay: atTime(TODAY, -2, 0, 0),  stripe: 'cus_Rn7Ws1', totalPaid: 8820,  method: 'SEPA ·· IT60' },
  { id: 'cl04', sellerId: 'giulia', setterId: null, setterName: null, name: 'ConteBuild SPA',    contact: 'Davide Conte',      plan: 'Business',   mrr: 1620, payStatus: 'pagato',  lastPay: atTime(TODAY, -3, 0, 0),  nextPay: atTime(TODAY, 27, 0, 0),  stripe: 'cus_St2Hb6', totalPaid: 19440, method: 'Visa ·· 1191' },
  { id: 'cl05', sellerId: 'giulia', setterId: null, setterName: null, name: 'De Luca Studio',    contact: 'Laura De Luca',     plan: 'Pro',        mrr: 780,  payStatus: 'fallito', lastPay: atTime(TODAY, -30, 0, 0), nextPay: atTime(TODAY, 0, 0, 0),   stripe: 'cus_Tu5Kc9', totalPaid: 4680,  method: 'Visa ·· 7702' },
  { id: 'cl06', sellerId: 'luca',   setterId: null, setterName: null, name: 'Aurora Spa',        contact: 'Giada Marino',      plan: 'Enterprise', mrr: 1230, payStatus: 'pagato',  lastPay: atTime(TODAY, -7, 0, 0),  nextPay: atTime(TODAY, 23, 0, 0),  stripe: 'cus_Vx8Md3', totalPaid: 14760, method: 'Amex ·· 3005' },
  { id: 'cl07', sellerId: 'luca',   setterId: null, setterName: null, name: 'Santoro Energia',   contact: 'Nicola Santoro',    plan: 'Business',   mrr: 1450, payStatus: 'pending', lastPay: atTime(TODAY, -33, 0, 0), nextPay: atTime(TODAY, -3, 0, 0),  stripe: 'cus_Wy1Ne7', totalPaid: 13050, method: 'SEPA ·· IT22' },
  { id: 'cl08', sellerId: 'sara',   setterId: null, setterName: null, name: 'Lombardi Retail',   contact: 'Beatrice Lombardi', plan: 'Pro',        mrr: 890,  payStatus: 'pagato',  lastPay: atTime(TODAY, -2, 0, 0),  nextPay: atTime(TODAY, 28, 0, 0),  stripe: 'cus_Xz4Of2', totalPaid: 10680, method: 'Mastercard ·· 5567' },
  { id: 'cl09', sellerId: 'sara',   setterId: null, setterName: null, name: 'Verdi Group',       contact: 'Tommaso Verdi',     plan: 'Starter',    mrr: 420,  payStatus: 'fallito', lastPay: atTime(TODAY, -31, 0, 0), nextPay: atTime(TODAY, -1, 0, 0),  stripe: 'cus_Ya7Pg5', totalPaid: 2940,  method: 'Visa ·· 9923' },
  { id: 'cl10', sellerId: 'marco', setterId: null, setterName: null, name: 'Sartoria Neri SRL', contact: 'Francesca Neri',    plan: 'Pro',        mrr: 1180, payStatus: 'pending', lastPay: atTime(TODAY, -29, 0, 0), nextPay: atTime(TODAY, 1, 0, 0),   stripe: 'cus_Zb1Qh8', totalPaid: 7080,  method: 'Visa ·· 4456' },
];
