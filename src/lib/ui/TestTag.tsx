import { isTestName } from "@/lib/domain/sales-ledger/test-mode";

/** «ТЕСТ» белгісі — тест аккаунттың заказы (Google-ға түспейді, рейтингте саналмайды). */
export function TestTag({ manager }: { manager: string | null | undefined }) {
  if (!isTestName(manager)) return null;
  return (
    <span className="ml-1.5 inline-block rounded-[6px] bg-[#fff4e0] px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[#b45309]">
      тест
    </span>
  );
}
