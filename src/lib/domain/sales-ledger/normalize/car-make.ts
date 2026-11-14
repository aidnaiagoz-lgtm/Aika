// Көлік маркасы: кестеде орысша/қазақша әр түрлі жазылған («тойота», «тайота», «хюндай»...) → ағылшынша бір атау («Toyota»).
// CEO шешімі (2026-11-14): жаңа заказ формасында марка ағылшынша таңдалады және сақталады.

const MAKES: Record<string, string[]> = {
  Toyota: ["тойота", "тайота", "тоета", "toyota"],
  Hyundai: ["хюндай", "хундай", "хендай", "хёндай", "hyundai"],
  Kia: ["киа", "kia"],
  Changan: ["чанган", "чанган авто", "changan"],
  Lexus: ["лексус", "lexus"],
  Chevrolet: ["шевролет", "шевроле", "шеврале", "chevrolet"],
  Haval: ["хавал", "хаваль", "haval"],
  Chery: ["чери", "черри", "chery"],
  Geely: ["джили", "джилли", "geely"],
  Mitsubishi: ["митсубиси", "митсубиши", "мицубиси", "мицубиши", "mitsubishi"],
  BYD: ["byd", "бид", "биуайди"],
  Jetour: ["джэтур", "джетур", "jetour"],
  Subaru: ["субару", "subaru"],
  "Mercedes-Benz": ["мерседес", "мерс", "mercedes", "mercedes-benz"],
  Volkswagen: ["вольксваген", "фольксваген", "volkswagen", "vw"],
  Nissan: ["ниссан", "нисан", "nissan"],
  Lada: ["лада", "ваз", "lada"],
  Audi: ["ауди", "audi"],
  JAC: ["джак", "jac"],
  BMW: ["бмв", "bmw"],
  Honda: ["хонда", "honda"],
  Renault: ["рено", "renault"],
  Tank: ["танк", "tank"],
  Skoda: ["шкода", "skoda"],
  Exeed: ["эксид", "exeed"],
  Infiniti: ["инфинити", "infiniti"],
  Hongqi: ["хончи", "хунчи", "hongqi"],
  "Li Auto": ["ли", "ли авто", "li", "lixiang", "li auto"],
  "Land Rover": ["ренж ровер", "рейндж ровер", "range rover", "ленд ровер", "land rover"],
  MG: ["mg", "мг", "эмджи"],
  Mazda: ["мазда", "mazda"],
  Ford: ["форд", "ford"],
  Omoda: ["омода", "omoda"],
  Kaiyi: ["каи", "кайи", "kaiyi"],
  Rox: ["рокс", "rox"],
  Suzuki: ["сузуки", "suzuki"],
  GAZ: ["газель", "газ", "волга", "gaz"],
  Zeekr: ["зикр", "zeekr"],
  SsangYong: ["саненг", "санг енг", "ssangyong"],
  Deepal: ["дипал", "депал", "deepal"],
  Soueast: ["соуист", "soueast"],
  "Great Wall": ["гритуол", "грейт вол", "great wall"],
  Jaecoo: ["жаеко", "джейку", "jaecoo"],
  Jeep: ["джип", "jeep"],
  GAC: ["гак", "gac"],
  Voyah: ["воях", "voyah"],
  Cadillac: ["кадиллак", "кадилак", "cadillac"],
  Daewoo: ["даево", "дэу", "деу", "daewoo"],
  UAZ: ["уаз", "uaz"],
  Porsche: ["порше", "porsche"],
  Lincoln: ["линкольн", "lincoln"],
  Peugeot: ["пежо", "peugeot"],
  Baojun: ["баоджун", "baojun"],
  Opel: ["опель", "opel"],
  Volvo: ["вольво", "volvo"],
  Genesis: ["генезис", "genesis"],
  GMC: ["gmc", "джиэмси"],
  Bestune: ["бестюн", "bestune"],
  Hummer: ["хаммер", "hummer"],
  Lifan: ["лифан", "lifan"],
  Dodge: ["додж", "dodge"],
  BAIC: ["баик", "baic"],
  Chrysler: ["крайслер", "chrysler"],
  Isuzu: ["исузу", "isuzu"],
  Foton: ["фотон", "foton"],
  Arcfox: ["аркфокс", "arcfox"],
  Roewe: ["роеве", "roewe"],
  Wuling: ["вулинг", "wuling"],
  Datsun: ["датсан", "datsun"],
  Dongfeng: ["донгфынг", "донгфенг", "dongfeng"],
  Xiaomi: ["сяоми", "xiaomi"],
};

const ALIAS = new Map<string, string>();
for (const [en, list] of Object.entries(MAKES)) {
  ALIAS.set(en.toLowerCase(), en);
  for (const a of list) ALIAS.set(a.toLowerCase(), en);
}

/** «тойота» / «Тайота» / «TOYOTA» → «Toyota». Белгісіз болса — өзгертпей (тек бос орындары тазаланады). */
export function canonicalMake(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  return ALIAS.get(s.toLocaleLowerCase("ru")) ?? s;
}

/** Ағылшынша атаулардың бәрі (тізімнің соңына қосу үшін). */
export const KNOWN_MAKES = Object.keys(MAKES);
