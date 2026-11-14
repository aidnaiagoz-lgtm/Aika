// Google кестеде марка/модель кириллицамен де, латынша да жазылады ("тойота", "тойота хайлюкс", "камри 70"),
// сондықтан әр марка мен модельдің жазылу нұсқалары (alias) бойынша танимыз.

interface Gen {
  code: string;
  from: number;
  to: number | null;
}

interface ModelDef {
  name: string;
  aliases: string[];
  gens: Gen[];
}

interface MakeDef {
  name?: string;
  aliases: string[];
  country: string;
  models?: ModelDef[];
}

const g = (code: string, from: number, to: number | null): Gen => ({ code, from, to });

// Модель тізіміндегі рет маңызды: ұзынырақ/нақтырақ атау бірінші (прадо → ленд крузерден бұрын).
const MAKES: MakeDef[] = [
  {
    name: "Toyota",
    aliases: ["toyota", "тойота", "тоёта"],
    country: "Japan",
    models: [
      { name: "Camry", aliases: ["camry", "камри", "кэмри"], gens: [g("XV40", 2006, 2011), g("XV50", 2011, 2017), g("XV70", 2017, 2023), g("XV80", 2023, null)] },
      { name: "Corolla", aliases: ["corolla", "королла", "каролла", "корола"], gens: [g("E140/150", 2006, 2013), g("E160/170", 2013, 2019), g("E210", 2019, null)] },
      { name: "RAV4", aliases: ["rav4", "rav 4", "рав4", "рав 4", "рав-4"], gens: [g("XA30", 2005, 2013), g("XA40", 2013, 2018), g("XA50", 2018, null)] },
      { name: "Land Cruiser Prado", aliases: ["prado", "прадо"], gens: [g("J120", 2002, 2009), g("J150", 2009, 2024), g("J250", 2024, null)] },
      { name: "Land Cruiser", aliases: ["land cruiser", "landcruiser", "ленд крузер", "лэнд крузер", "ленд круизер", "крузер"], gens: [g("J200", 2007, 2021), g("J300", 2021, null)] },
      { name: "Highlander", aliases: ["highlander", "хайлендер", "хайлэндер", "хайлендэр"], gens: [g("XU40", 2007, 2013), g("XU50", 2013, 2019), g("XU70", 2019, null)] },
      { name: "Hilux", aliases: ["hilux", "хайлюкс", "хайлакс", "хайлукс"], gens: [g("AN120/130", 2015, null)] },
    ],
  },
  {
    name: "Hyundai",
    aliases: ["hyundai", "хендай", "хундай", "хёндай", "хюндай", "хендэ", "хюндэ"],
    country: "South Korea",
    models: [
      { name: "Tucson", aliases: ["tucson", "туксон", "тусан", "таксон", "туссан"], gens: [g("JM", 2004, 2009), g("LM", 2009, 2015), g("TL", 2015, 2020), g("NX4", 2020, null)] },
      { name: "Santa Fe", aliases: ["santa fe", "santafe", "санта фе", "санта-фе", "сантафе"], gens: [g("CM", 2006, 2012), g("DM", 2012, 2018), g("TM", 2018, 2023), g("MX5", 2023, null)] },
      { name: "Elantra", aliases: ["elantra", "элантра", "елантра"], gens: [g("HD", 2006, 2010), g("MD", 2010, 2015), g("AD", 2015, 2020), g("CN7", 2020, null)] },
      { name: "Sonata", aliases: ["sonata", "соната"], gens: [g("NF", 2004, 2009), g("YF", 2009, 2014), g("LF", 2014, 2019), g("DN8", 2019, null)] },
      { name: "Accent", aliases: ["accent", "акцент"], gens: [g("MC", 2005, 2010), g("RB", 2010, 2017), g("HC", 2017, null)] },
    ],
  },
  {
    name: "Kia",
    aliases: ["kia", "киа"],
    country: "South Korea",
    models: [
      { name: "Sportage", aliases: ["sportage", "спортейдж", "спортаж", "спортэйдж"], gens: [g("KM", 2004, 2010), g("SL", 2010, 2015), g("QL", 2015, 2021), g("NQ5", 2021, null)] },
      { name: "Sorento", aliases: ["sorento", "соренто"], gens: [g("BL", 2002, 2009), g("XM", 2009, 2014), g("UM", 2014, 2020), g("MQ4", 2020, null)] },
      { name: "Cerato", aliases: ["cerato", "церато", "серато"], gens: [g("TD", 2008, 2013), g("YD", 2013, 2018), g("BD", 2018, null)] },
      { name: "Rio", aliases: ["rio", "рио"], gens: [g("JB", 2005, 2011), g("UB", 2011, 2017), g("YB", 2017, 2023), g("SC", 2023, null)] },
    ],
  },
  {
    name: "Nissan",
    aliases: ["nissan", "ниссан", "нисан"],
    country: "Japan",
    models: [
      { name: "X-Trail", aliases: ["x-trail", "x trail", "xtrail", "икс трейл", "икс-трейл", "х-трейл", "х трейл", "хтрейл"], gens: [g("T30", 2000, 2007), g("T31", 2007, 2014), g("T32", 2013, 2022), g("T33", 2022, null)] },
      { name: "Qashqai", aliases: ["qashqai", "кашкай"], gens: [g("J10", 2006, 2013), g("J11", 2013, 2021), g("J12", 2021, null)] },
    ],
  },
  {
    name: "BMW",
    aliases: ["bmw", "бмв"],
    country: "Germany",
    models: [
      { name: "3 Series", aliases: ["3 series", "3-series", "3 серия", "3 серии", "3er"], gens: [g("E90", 2005, 2012), g("F30", 2012, 2019), g("G20", 2019, null)] },
      { name: "5 Series", aliases: ["5 series", "5-series", "5 серия", "5 серии", "5er"], gens: [g("E60", 2003, 2010), g("F10", 2010, 2017), g("G30", 2017, 2023), g("G60", 2023, null)] },
    ],
  },
  {
    name: "Mercedes-Benz",
    aliases: ["mercedes-benz", "mercedes", "мерседес", "мерс"],
    country: "Germany",
    models: [
      { name: "C-Class", aliases: ["c-class", "c class", "с-класс", "c-класс", "с класс"], gens: [g("W203", 2000, 2007), g("W204", 2007, 2014), g("W205", 2014, 2021), g("W206", 2021, null)] },
      { name: "E-Class", aliases: ["e-class", "e class", "е-класс", "e-класс", "е класс"], gens: [g("W211", 2002, 2009), g("W212", 2009, 2016), g("W213", 2016, 2023), g("W214", 2023, null)] },
    ],
  },
  {
    name: "Volkswagen",
    aliases: ["volkswagen", "vw", "фольксваген", "фольцваген"],
    country: "Germany",
    models: [
      { name: "Passat", aliases: ["passat", "пассат"], gens: [g("B6", 2005, 2010), g("B7", 2010, 2014), g("B8", 2014, null)] },
      { name: "Tiguan", aliases: ["tiguan", "тигуан"], gens: [g("5N", 2007, 2016), g("AD1", 2016, null)] },
    ],
  },
  { aliases: ["lexus", "лексус"], country: "Japan" },
  { aliases: ["mazda", "мазда"], country: "Japan" },
  { aliases: ["honda", "хонда"], country: "Japan" },
  { aliases: ["mitsubishi", "митсубиси", "мицубиси", "митсубиши", "мицубиши"], country: "Japan" },
  { aliases: ["audi", "ауди"], country: "Germany" },
  { aliases: ["chevrolet", "шевроле", "шевролет"], country: "Uzbekistan" },
  { aliases: ["ravon", "равон"], country: "Uzbekistan" },
  { aliases: ["daewoo", "дэу", "деу"], country: "Uzbekistan" },
  { aliases: ["renault", "рено"], country: "France" },
  { aliases: ["skoda", "шкода"], country: "Czech Republic" },
  { aliases: ["ford", "форд"], country: "USA" },
  { aliases: ["chery", "чери"], country: "China" },
  { aliases: ["geely", "джили"], country: "China" },
  { aliases: ["haval", "хавал", "хавейл"], country: "China" },
  { aliases: ["changan", "чанган"], country: "China" },
  { aliases: ["great wall", "грейт волл", "грейт вол"], country: "China" },
  { aliases: ["tank", "танк"], country: "China" },
  { aliases: ["lada", "лада", "ваз"], country: "Russia" },
  { aliases: ["gaz", "газ"], country: "Russia" },
  { aliases: ["uaz", "уаз"], country: "Russia" },
  { aliases: ["byd", "бид", "биди"], country: "China" },
  { aliases: ["li auto", "lixiang", "li xiang", "ли авто", "лисян", "лисиан"], country: "China" },
  { aliases: ["zeekr", "зикр", "зекр"], country: "China" },
  { aliases: ["jetour", "джетур"], country: "China" },
  { aliases: ["exeed", "эксид"], country: "China" },
  { aliases: ["omoda", "омода"], country: "China" },
  { aliases: ["hongqi", "хончи", "хунцы"], country: "China" },
  { aliases: ["jac", "джак"], country: "China" },
  { aliases: ["subaru", "субару"], country: "Japan" },
  { aliases: ["infiniti", "инфинити"], country: "Japan" },
  { aliases: ["suzuki", "сузуки"], country: "Japan" },
  { aliases: ["ssangyong", "ссангйонг", "санг енг", "сангйонг", "kgm"], country: "South Korea" },
  { aliases: ["genesis", "генезис"], country: "South Korea" },
  { aliases: ["porsche", "порше"], country: "Germany" },
  { aliases: ["land rover", "range rover", "ленд ровер", "рендж ровер"], country: "United Kingdom" },
  { aliases: ["volvo", "вольво"], country: "Sweden" },
];

export const COUNTRY_OPTIONS = ["Japan", "South Korea", "Germany", "China", "Russia", "Uzbekistan", "Kazakhstan", "USA", "France", "Czech Republic", "United Kingdom", "Sweden"];

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");

function findMake(make: string): MakeDef | undefined {
  const m = norm(make);
  if (!m) return undefined;
  return MAKES.find((d) => d.aliases.some((a) => m === a || m.startsWith(a + " ") || m.startsWith(a + "(")));
}

// Модель өрісінде марка да тұруы мүмкін ("тойота хайлюкс") — сондықтан ішінен іздейміз.
function findModel(make: MakeDef, model: string): ModelDef | undefined {
  const m = norm(model);
  if (!m) return undefined;
  return make.models?.find((d) => d.aliases.some((a) => m.includes(a)));
}

export function originCountryFor(make: string): string | undefined {
  return findMake(make)?.country;
}

export interface GenOption {
  code: string;
  label: string;
}

const yearsText = (x: Gen) => `${x.from}–${x.to ?? "қазір"}`;

function optionsOf(list: Array<{ make: MakeDef; model: ModelDef }>, year: number | null): GenOption[] {
  const out: GenOption[] = [];
  const seen = new Set<string>();
  for (const { make, model } of list) {
    for (const x of model.gens) {
      if (year && !(year >= x.from && (x.to === null || year <= x.to))) continue;
      const label = `${make.name} ${model.name} · ${yearsText(x)}`;
      const key = x.code + "|" + label;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ code: x.code, label });
    }
  }
  return out;
}

/**
 * Буын тізімі (әр кодтың қасында қай көлік, қай жылдар). Модель танылса — сол модельдікі, марка ғана танылса —
 * марканың бәрі, марка әлі жазылмаса — бүкіл тізім. Марка жазылып, бірақ танылмаса (мыс. BYD) — бос
 * (басқа маркалардың буыны ұсынылмасын). Жыл болса — жылға сайлары.
 */
export function generationOptions(make: string, model: string, year: number | null): GenOption[] {
  const mk = findMake(make);
  if (make.trim() && !mk) return [];
  const md = mk ? findModel(mk, model) : undefined;
  const list = md
    ? [{ make: mk!, model: md }]
    : (mk ? [mk] : MAKES).flatMap((m) => (m.models ?? []).map((x) => ({ make: m, model: x })));
  return optionsOf(list, year);
}

/** Марка + модель + жыл бойынша буын нақты анықталса (бір ғана сәйкес келсе) — соны қайтарады. */
export function autoGeneration(make: string, model: string, year: number | null): string | undefined {
  const mk = findMake(make);
  if (!mk || !year) return undefined;
  const md = findModel(mk, model);
  if (!md) return undefined;
  const fit = optionsOf([{ make: mk, model: md }], year);
  return fit.length === 1 ? fit[0].code : undefined;
}
