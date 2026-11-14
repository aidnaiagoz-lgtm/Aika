// Тауар түрлері (CEO, 2026-11-14): Google кестеде тек кожа емес — чехол, руль, подпятник... Әр түрге тек өзіне
// қатысты өрістер шығады. Түрі тауар атауынан танылады («3Д - Люкс - ...», «3727 - Чехол - ...», «1025 - Подпятник - ...»).
// Өрістер кестедегі нақты толтырылуына қарай (соңғы 1 жыл): салон — кожа+съёмный+кармашки, багажник — кожа(+съёмный),
// съёмный/EVA/ТПЕ — тек съёмный, қалғаны — тек тауардың өзі.

export type KindId =
  | "salon3d"
  | "salon5d"
  | "salon360"
  | "trunk"
  | "mat"
  | "cover"
  | "wheel"
  | "heel"
  | "cape"
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

export const PRODUCT_KINDS: ProductKind[] = [
  { id: "salon3d", label: "3Д салон", leather: true, mat: true, pockets: true, workshop: true, match: has(/^3д/) },
  { id: "salon5d", label: "5Д салон", leather: true, mat: true, pockets: true, workshop: true, match: has(/^5д/) },
  { id: "salon360", label: "360 салон", leather: true, mat: true, pockets: true, workshop: true, match: has(/^360[ -]/) },
  { id: "trunk", label: "Багажник", leather: true, mat: true, pockets: false, workshop: true, match: has(/^багаж/) },
  { id: "cover", label: "Чехол", leather: false, mat: false, pockets: false, workshop: false, match: has(/- чехол|^чехол/) },
  { id: "wheel", label: "Руль", leather: false, mat: false, pockets: false, workshop: false, match: has(/- руль|^руль/) },
  { id: "heel", label: "Подпятник", leather: false, mat: false, pockets: false, workshop: false, match: has(/подпятник/) },
  { id: "cape", label: "Накидка", leather: false, mat: false, pockets: false, workshop: false, match: has(/накидк/) },
  { id: "organizer", rare: true, label: "Органайзер", leather: false, mat: false, pockets: false, workshop: false, match: has(/органайзер/) },
  { id: "pillow", rare: true, label: "Подушка", leather: false, mat: false, pockets: false, workshop: false, match: has(/подушк/) },
  { id: "armrest", rare: true, label: "Подлокотник", leather: false, mat: false, pockets: false, workshop: false, match: has(/подлокотник/) },
  { id: "mat", label: "Съёмный / EVA", leather: false, mat: true, pockets: false, workshop: false, match: has(/^съ[её]мн|^-? ?ева|^eva|eva кил|^тпе|^tpe|полик/) },
  { id: "other", rare: true, label: "Басқа", leather: false, mat: false, pockets: false, workshop: false, match: () => true },
];

const BY_ID = new Map(PRODUCT_KINDS.map((k) => [k.id, k]));
export const kindById = (id: KindId) => BY_ID.get(id) ?? BY_ID.get("other")!;

/** Тауар атауынан түрі: «3727 - Чехол - ...» → cover. Танылмаса — other. */
export function productKind(product: string): KindId {
  const p = product.trim().toLocaleLowerCase("ru");
  if (!p) return "other";
  return PRODUCT_KINDS.find((k) => k.id !== "other" && k.match(p))?.id ?? "other";
}

/** Тауар тізімін түрлерге бөледі (ретін сақтайды). */
export function groupProducts(products: string[]): Record<KindId, string[]> {
  const out = Object.fromEntries(PRODUCT_KINDS.map((k) => [k.id, [] as string[]])) as unknown as Record<KindId, string[]>;
  for (const p of products) out[productKind(p)].push(p);
  return out;
}
