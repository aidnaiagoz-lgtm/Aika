import { EventEmitter } from "node:events";

// §24 Automation Engine негізі: домендік event-тер осы арқылы жарияланады,
// ал басқа модульдер (Production, Warehouse, Notifications...) соларға жазылады.
// Phase 1-де in-process EventEmitter жеткілікті; масштаб өскенде BullMQ/Redis
// pub-sub-ке ауыстыру осы файлдың сыртына шықпайды (interface өзгермейді).

export type DomainEvent =
  | { type: "lead.converted"; leadId: string; dealId: string }
  | { type: "deal.stage_changed"; dealId: string; fromStage: string | null; toStage: string }
  | { type: "deal.paid"; dealId: string; customerId: string; amount: number }
  | { type: "deal.won"; dealId: string }
  | { type: "deal.lost"; dealId: string }
  | { type: "discount.requested"; discountRequestId: string; dealId: string; requestedPct: number }
  | { type: "discount.decided"; discountRequestId: string; dealId: string; approved: boolean }
  | { type: "order.created"; orderId: string; dealId: string | null }
  | { type: "order.paid"; orderId: string; dealId: string | null; amount: number }
  | { type: "order.payment_added"; orderId: string; amount: number }
  | { type: "order.status_changed"; orderId: string; toStatus: string }
  | { type: "order.production_started"; orderId: string }
  | { type: "order.discount_requested"; orderId: string; discountRequestId: string; requestedPct: number }
  | { type: "order.qc_rework_required"; orderId: string; productionOrderId: string; comment?: string };

type Listener = (event: DomainEvent) => void | Promise<void>;

const globalForEvents = globalThis as unknown as { automaxBus?: EventEmitter };
const emitter = globalForEvents.automaxBus ?? new EventEmitter();
emitter.setMaxListeners(50);
if (process.env.NODE_ENV !== "production") {
  globalForEvents.automaxBus = emitter;
}

export function publish(event: DomainEvent): void {
  emitter.emit(event.type, event);
}

export function subscribe(type: DomainEvent["type"], listener: Listener): void {
  emitter.on(type, listener);
}
