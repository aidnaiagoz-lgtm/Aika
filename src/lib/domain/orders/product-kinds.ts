// Тауар түрлері (CEO, 2026-11-14; атаулары 2026-11-16 — менеджерлер кестеде жазатындай: «3Д коврик», «5Д коврик с порогами»…): Google кестеде тек кожа емес — чехол, руль, подпятник... Әр түрге тек өзіне
// қатысты өрістер шығады. Түрі тауар атауынан танылады («3Д - Люкс - ...», «3727 - Чехол - ...», «1025 - Подпятник - ...»).
// Өрістер кестедегі нақты толтырылуына қарай (соңғы 1 жыл): салон — кожа+съёмный+кармашки, багажник — кожа(+съёмный),
// съёмный/EVA/ТПЕ — тек съёмный, қалғаны — тек тауардың өзі.

export type KindId =
  | "salon3d"
  | "salon5d"
  | "salon5dp"
  | "salon360"
  | "trunk"
  | "mat"
  | "eva"
  | "cover"
  | "wheel"
  | "heel"
  | "organizer"
  | "pillow"
  | "armrest"
  | "other";

export interface ProductKind {
  id: KindId;
  label: string;
  leather: boolean; // Кожа вид / нитка / окантовка
  mat: boolean; // Съёмный полик вид / нитка / окантовка
  pockets: boolean; // Кармашки + лого
  workshop: boolean; // «Цех» әдепкі белгісі
  rare?: boolean; // сирек — «Тағы…» ішінде
  match: (p: string) => boolean;
}

const has = (re: RegExp) => (p: string) => re.test(p);

// Батырмалардың реті (CEO, 2026-11-16): 3Д → 5Д → 5Д с порогами → 360 → багаж → съёмный → EVA → чехол, руль, подпятник.
// «Накидка» түрі алынды (CEO: «накидка деген жоқ») — ондай тауарлар «Басқа»-да.
// «С порогами» — кестеде «+ бугарок» деп жазылады.
const BUGAROK = /бугар|порог/;
export const PRODUCT_KINDS: ProductKind[] = [
  { id: "salon3d", label: "3Д коврик", leather: true, mat: true, pockets: true, workshop: true, match: has(/^3д/) },
  { id: "salon5d", label: "5Д коврик", leather: true, mat: true, pockets: true, workshop: true, match: (p) => /^5д/.test(p) && !BUGAROK.test(p) },
  { id: "salon5dp", label: "5Д коврик с порогами", leather: true, mat: true, pockets: true, workshop: true, match: (p) => /^5д/.test(p) && BUGAROK.test(p) },
  { id: "salon360", label: "360 коврик", leather: true, mat: true, pockets: true, workshop: true, match: has(/^360[ -]/) },
  { id: "trunk", label: "Багаж полный", leather: true, mat: true, pockets: false, workshop: true, match: has(/^багаж/) },
  { id: "mat", label: "Съёмный коврик", leather: false, mat: true, pockets: false, workshop: false, match: has(/^съ[её]мн|^тпе|^tpe/) },
  { id: "eva", label: "EVA коврик", leather: false, mat: true, pockets: false, workshop: false, match: has(/^-? ?ева|^eva|eva кил|ева полик|^3d eva/) },
  { id: "cover", label: "Чехол", leather: false, mat: false, pockets: false, workshop: false, match: has(/- чехол|^чехол/) },
  { id: "wheel", label: "Руль", leather: false, mat: false, pockets: false, workshop: false, match: has(/- руль|^руль/) },
  { id: "heel", label: "Подпятник", leather: false, mat: false, pockets: false, workshop: false, match: has(/подпятник/) },
  { id: "organizer", rare: true, label: "Органайзер", leather: false, mat: false, pockets: false, workshop: false, match: has(/органайзер/) },
  { id: "pillow", rare: true, label: "Подушка", leather: false, mat: false, pockets: false, workshop: false, match: has(/подушк/) },
  { id: "armrest", rare: true, label: "Подлокотник", leather: false, mat: false, pockets: false, workshop: false, match: has(/подлокотник/) },
  { id: "other", rare: true, label: "Басқа", leather: false, mat: false, pockets: false, workshop: false, match: () => true },
];
// Тану реті: нақтырақ түрлер бірінші (мыс. «Чехол ... ева» — чехол; съёмный/EVA — ең соңында).
const MATCH_ORDER: KindId[] = ["salon3d", "salon5dp", "salon5d", "salon360", "trunk", "cover", "wheel", "heel", "organizer", "pillow", "armrest", "mat", "eva"];

const BY_ID = new Map(PRODUCT_KINDS.map((k) => [k.id, k]));
export const kindById = (id: KindId) => BY_ID.get(id) ?? BY_ID.get("other")!;

/** Тауар атауынан түрі: «3727 - Чехол - ...» → cover. Танылмаса — other. */
export function productKind(product: string): KindId {
  const p = product.trim().toLocaleLowerCase("ru");
  if (!p) return "other";
  return MATCH_ORDER.find((id) => BY_ID.get(id)!.match(p)) ?? "other";
}

/** Тауар тізімін түрлерге бөледі (ретін сақтайды). */
export function groupProducts(products: string[]): Record<KindId, string[]> {
  const out = Object.fromEntries(PRODUCT_KINDS.map((k) => [k.id, [] as string[]])) as unknown as Record<KindId, string[]>;
  for (const p of products) out[productKind(p)].push(p);
  return out;
}
