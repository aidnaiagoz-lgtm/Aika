// Google Sheets-тегі "Продажа" кестесінің 45 бағанын дәлме-дәл қайталайтын өрістер.
// Барлығы міндетті емес — қолмен толтырылатын журнал жолы сияқты еркін.
export interface LedgerRowInput {
  // "no" (№) осында жоқ — DB autoincrement арқылы автоматты тағайындалады.
  year?: number | null;
  month?: string | null;
  date?: string | null; // ISO date

  manager?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  contactChannel?: string | null;
  certificateNo?: string | null;
  contactCity?: string | null;

  car?: string | null;
  brand?: string | null;
  carYear?: number | null;

  workshop?: string | null;
  readyOrderDate?: string | null;
  product?: string | null;

  leatherType?: string | null;
  leatherThread?: string | null;
  leatherPiping?: string | null;
  matType?: string | null;
  matThread?: string | null;
  matPiping?: string | null;
  pocketsPairs?: number | null;
  pocketsLogo?: string | null;

  price?: number | null;
  soldFor?: number | null;
  remainder?: number | null;
  managerBonus?: number | null;

  receipt1Amount?: number | null;
  receipt1Method?: string | null;
  receipt1At?: string | null;
  receipt1File?: string | null;
  receipt2Amount?: number | null;
  receipt2Method?: string | null;
  receipt2At?: string | null;
  receipt2File?: string | null;
  receipt3Amount?: number | null;
  receipt3Method?: string | null;
  receipt3At?: string | null;
  receipt3File?: string | null;

  pickupMethod?: string | null;
  production?: string | null;
  orderStatus?: string | null;
  payments?: string | null;
  salesChannel?: string | null;
}
