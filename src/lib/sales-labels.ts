import type { StatusTone } from "@/lib/ui";

export const DEAL_STAGE_TONE: Record<string, StatusTone> = {
  QUALIFIED: "new",
  OFFER: "new",
  ORDER: "processing",
  PAID: "processing",
  WON: "success",
  LOST: "danger",
};

export const LEAD_STATUS_TONE: Record<string, StatusTone> = {
  NEW: "new",
  CONTACTED: "processing",
  CONVERTED: "success",
  LOST: "danger",
};

export function formatTenge(value: number | string | { toString(): string }): string {
  return `${new Intl.NumberFormat("ru-RU").format(Number(value))} ₸`;
}
