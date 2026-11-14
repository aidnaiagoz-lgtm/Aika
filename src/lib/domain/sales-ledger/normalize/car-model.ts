// Көлік моделі: кестеде орысша/қазақша әр түрлі жазылған («туксон», «прадо150», «рав 4», «кс55+») → ағылшынша
// («Tucson», «Prado 150», «RAV4», «CS55 Plus»). CEO шешімі (2026-11-14): жаңа заказ формасында модель ағылшынша.
// Тәсіл: сөздік (жиі кездесетін сөздер) + «код» сөздер (әріп+цифр: к5 → K5, рх300 → RX300) + қалғаны — транслит.

import { canonicalMake } from "./car-make";

const WORDS: Record<string, string> = {
  // Toyota / Lexus
  камри: "Camry", кэмри: "Camry", прадо: "Prado", рав: "RAV", хайландер: "Highlander", хайлендер: "Highlander",
  хайлюкс: "Hilux", хайлакс: "Hilux", каролла: "Corolla", королла: "Corolla", карола: "Corolla", корола: "Corolla",
  фортунер: "Fortuner", форанер: "4Runner", фораннер: "4Runner", руннер: "Runner", авенсис: "Avensis", карина: "Carina",
  сиена: "Sienna", сиенна: "Sienna", альфард: "Alphard", ипсум: "Ipsum", харьер: "Harrier", харриер: "Harrier",
  хариер: "Harrier", краун: "Crown", секвоя: "Sequoia", виндом: "Windom", превия: "Previa", сюрф: "Surf", аурис: "Auris",
  виста: "Vista", марк: "Mark", крузер: "Cruiser", крузак: "Cruiser", ланд: "Land", ленд: "Land", лэнд: "Land",
  // Hyundai / Kia
  туксон: "Tucson", тусан: "Tucson", таксон: "Tucson", муфаса: "Mufasa", сантафе: "Santa Fe", санта: "Santa", фе: "Fe",
  соната: "Sonata", саната: "Sonata", элантра: "Elantra", елантра: "Elantra", палисад: "Palisade", акцент: "Accent",
  аксент: "Accent", грандеур: "Grandeur", грандеуир: "Grandeur", грандауер: "Grandeur", крета: "Creta", кустин: "Custin",
  стариа: "Staria", солярис: "Solaris", кона: "Kona", аванте: "Avante", спортейдж: "Sportage", спортейж: "Sportage",
  спортаж: "Sportage", соренто: "Sorento", саренто: "Sorento", селтос: "Seltos", серато: "Cerato", церато: "Cerato",
  рио: "Rio", оптима: "Optima", сид: "Ceed", пиканто: "Picanto", соул: "Soul", карнивал: "Carnival", байон: "Bayon",
  // Chevrolet / Daewoo / Ravon
  кобальт: "Cobalt", кобалт: "Cobalt", оникс: "Onix", монза: "Monza", круз: "Cruze", трекер: "Tracker", каптива: "Captiva",
  эквинокс: "Equinox", еквинокс: "Equinox", авео: "Aveo", тахо: "Tahoe", нексия: "Nexia", матиз: "Matiz", равон: "Ravon",
  // Changan / Haval / Chery / Geely / Jetour / JAC / Tank
  юники: "UNI", уни: "UNI", юни: "UNI", алсвин: "Alsvin", ян: "Yuan", кулрей: "Coolray", курлей: "Coolray",
  джулион: "Jolion", джуллион: "Jolion", джолион: "Jolion", дарго: "Dargo", тиго: "Tiggo", аризо: "Arrizo",
  атлас: "Atlas", емгранд: "Emgrand", эмгранд: "Emgrand", монджаро: "Monjaro", монжаро: "Monjaro", манджеро: "Monjaro",
  окованго: "Okavango", окаванго: "Okavango", тугела: "Tugella", ситирей: "Cityray", преффейс: "Preface", префейс: "Preface",
  дашинг: "Dashing", трэвеллер: "Traveller", тревеллер: "Traveller", лидер: "Leader",
  // Mitsubishi / Nissan / Subaru / Honda / Mazda
  аутландер: "Outlander", паджеро: "Pajero", поджеро: "Pajero", монтеро: "Montero", мантеро: "Montero", рвр: "RVR",
  кашкай: "Qashqai", трейл: "Trail", хтрейл: "X-Trail", террано: "Terrano", альмера: "Almera", максима: "Maxima",
  патрол: "Patrol", мурано: "Murano", цефиро: "Cefiro", жук: "Juke", форестер: "Forester", форестор: "Forester",
  легаси: "Legacy", аутбак: "Outback", аутбек: "Outback", оутбек: "Outback", аудбак: "Outback", импреза: "Impreza",
  трибека: "Tribeca", срв: "CR-V", црв: "CR-V", аккорд: "Accord", одиссей: "Odyssey", фит: "Fit",
  // VW / Skoda / Audi / Renault / Lada / Ford
  туарег: "Touareg", поло: "Polo", пассат: "Passat", гольф: "Golf", джетта: "Jetta", тигуан: "Tiguan", рапид: "Rapid",
  кодиак: "Kodiaq", кадиак: "Kodiaq", октавия: "Octavia", дастер: "Duster", логан: "Logan", сандеро: "Sandero",
  гранта: "Granta", приора: "Priora", веста: "Vesta", ларгус: "Largus", нива: "Niva", мандео: "Mondeo", мондео: "Mondeo",
  // BYD / Li / Zeekr / прочее
  сонг: "Song", чин: "Qin", хан: "Han", дестроер: "Destroyer", дестройер: "Destroyer", чазор: "Chazor", сил: "Seal",
  юань: "Yuan", леопард: "Leopard", галакси: "Galaxy", хантер: "Hunter", патриот: "Patriot", кайрон: "Kyron",
  солюто: "Soluto", солуто: "Soluto", салюто: "Soluto", гранд: "Grand", витара: "Vitara", кайен: "Cayenne",
  евок: "Evoque", дисковери: "Discovery", дисковеры: "Discovery", некст: "Next", бизнес: "Business", фри: "Free",
  депал: "Deepal", дипал: "Deepal", ядо: "Yado", аскент: "Ascent", ап: "Up", руннер4: "4Runner",
  кросс: "Cross", спорт: "Sport", про: "Pro", макс: "Max", мах: "Max", плюс: "Plus", лонг: "Long", кз: "KZ",
};

// Код-сөздердегі (әріп+цифр) әріп тіркестері: кс55 → CS55, рх300 → RX300, екю м5 → QM5...
const CODE_PAIRS: Array<[string, string]> = [
  ["екю", "Q"], ["кью", "Q"], ["рав", "RAV"], ["кс", "CS"], ["цс", "CS"], ["сс", "CS"], ["рх", "RX"], ["лх", "LX"],
  ["лк", "LC"], ["ес", "ES"], ["жх", "GX"], ["жс", "GS"], ["аш", "H"], ["ай", "I"], ["тхл", "TXL"], ["вх", "VX"],
];
const CODE_CHARS: Record<string, string> = {
  а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ж: "J", з: "Z", и: "I", к: "K", л: "L", м: "M", н: "H", о: "O",
  п: "P", р: "R", с: "S", т: "T", у: "U", ф: "F", х: "X", ц: "C", ш: "SH", ы: "Y", э: "E", ю: "U", я: "YA", ь: "", ъ: "",
};
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "",
  ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ә: "a", і: "i", ң: "n", ғ: "g", ү: "u", ұ: "u", қ: "k", ө: "o", һ: "h",
};

const hasCyr = (s: string) => /[а-яёәіңғүұқөһ]/i.test(s);
const title = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function codeWord(letters: string): string {
  let out = "";
  let i = 0;
  while (i < letters.length) {
    const pair = CODE_PAIRS.find(([c]) => letters.startsWith(c, i));
    if (pair) {
      out += pair[1];
      i += pair[0].length;
    } else {
      const ch = letters[i];
      out += CODE_CHARS[ch] ?? TRANSLIT[ch]?.toUpperCase() ?? ch.toUpperCase();
      i++;
    }
  }
  return out;
}

function letters(seg: string, alone: boolean): { text: string; code: boolean } {
  if (WORDS[seg]) return { text: WORDS[seg], code: false };
  if (seg.length <= 3 && !alone) return { text: codeWord(seg), code: true };
  if (seg.length <= 3) return { text: codeWord(seg), code: true };
  return { text: title([...seg].map((c) => TRANSLIT[c] ?? c).join("")), code: false };
}

function word(tok: string): string {
  if (!hasCyr(tok)) return /^[a-z]{1,3}\d/i.test(tok) || /^[a-z]{1,2}$/i.test(tok) ? tok.toUpperCase() : title(tok);
  if (WORDS[tok]) return WORDS[tok];
  // Модель ішінде марка жазылса («хавал м6») — марканың ағылшынша аты
  const mk = canonicalMake(tok);
  if (mk !== tok && tok.length > 2) return mk;
  // Әріп пен цифр аралас: «прадо150» → «Prado 150», «к5» → «K5», «с3про» → «S3 Pro», «75плюс» → «75 Plus»
  const segs = tok.match(/[а-яёәіңғүұқөһ]+|\d+|[^а-яёәіңғүұқөһ\d]+/gi) ?? [tok];
  if (segs.length === 1) return letters(tok, true).text;
  let out = "";
  let prevCode = false;
  for (const seg of segs) {
    if (/^\d+$/.test(seg)) {
      out += prevCode ? seg : (out ? " " : "") + seg;
      prevCode = false;
      continue;
    }
    const l = /^[а-яёәіңғүұқөһ]+$/i.test(seg) ? letters(seg, false) : { text: seg, code: false };
    out += (out ? " " : "") + l.text;
    prevCode = l.code;
  }
  return out;
}

/** «туксон» → «Tucson», «прадо 150» → «Prado 150», «рав 4» → «RAV4», «кс55+» → «CS55 Plus». Бос → бос. */
export function canonicalModel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ");
  if (!s) return "";
  const parts = s
    .replace(/\+/g, " плюс ")
    .split(" ")
    .filter(Boolean)
    .map(word);
  return parts
    .join(" ")
    .replace(/\b(RAV|LC|LX|RX|GX|ES|CS|GS|QM|FX|K|X|M|H|T|J|L|S|Q)\s+(\d+)\b/g, "$1$2")
    .replace(/\bQ M(\d)/g, "QM$1")
    .replace(/\b4 Runner\b/g, "4Runner")
    .replace(/\bX Trail\b/g, "X-Trail")
    .replace(/\s+/g, " ")
    .trim();
}
