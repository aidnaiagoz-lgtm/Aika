"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createOrder,
  addPayment,
  confirmOrder,
  sendToProduction,
  markOrderReady,
  advanceAfterReady,
  scheduleInstallation,
  scheduleDelivery,
  completeOrder,
  cancelOrder,
  returnOrder,
  reworkOrder,
  duplicateOrder,
  changeOrderDiscount,
  requestOrderDiscount,
  decideOrderDiscount,
  changeOrderManager,
  addOrderComment,
  addOrderAttachment,
  recordQualityCheck,
  updateInstallationStatus,
  updateDeliveryStatus,
  updateOrderCustomer,
  updateOrderVehicle,
  updateOrderDetails,
  updateOrderItem,
  type CreateOrderInput,
} from "@/lib/domain/orders";
import { getCurrentUser } from "@/lib/auth";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Сессия аяқталған");
  return user;
}

/** Домендік функция қате лақтырса, Next-тің "developer error" экраны орнына
 *  сол бетке ?error=... арқылы қайта бағыттап, әдемі хабарлама көрсетеді. */
async function runOrRedirectWithError<T>(fn: () => Promise<T>, redirectPath: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String(e.digest).startsWith("NEXT_REDIRECT")) throw e;
    const message = e instanceof Error ? e.message : "Белгісіз қате";
    const sep = redirectPath.includes("?") ? "&" : "?";
    redirect(`${redirectPath}${sep}error=${encodeURIComponent(message)}`);
  }
}

export async function createOrderAction(formData: FormData) {
  const user = await requireUser();

  const productIds = formData.getAll("productId") as string[];
  const qtys = formData.getAll("qty") as string[];
  // §7 — Configuration өрістері әр тауар жолымен позициялық сәйкес келеді (getAll индексі бойынша).
  const complectation = formData.getAll("configComplectation") as string[];
  const materialId = formData.getAll("configMaterialId") as string[];
  const color = formData.getAll("configColor") as string[];
  const pattern = formData.getAll("configPattern") as string[];
  const threadColor = formData.getAll("configThreadColor") as string[];
  const edgingColor = formData.getAll("configEdgingColor") as string[];
  const removableMatType = formData.getAll("configRemovableMatType") as string[];
  const removableMatColor = formData.getAll("configRemovableMatColor") as string[];
  const removableMatThreadColor = formData.getAll("configRemovableMatThreadColor") as string[];
  const removableMatEdging = formData.getAll("configRemovableMatEdging") as string[];
  const heelPad = formData.getAll("configHeelPad") as string[];
  const pockets = formData.getAll("configPockets") as string[];
  const pocketsPairs = formData.getAll("configPocketsPairs") as string[];
  const pocketsLogo = formData.getAll("configPocketsLogo") as string[];
  const logo = formData.getAll("configLogo") as string[];
  const customLogoText = formData.getAll("configCustomLogoText") as string[];
  const embroidery = formData.getAll("configEmbroidery") as string[];
  const extraAccessories = formData.getAll("configExtraAccessories") as string[];

  const items: CreateOrderInput["items"] = productIds
    .map((productId, i) => {
      const hasConfig =
        complectation[i] || materialId[i] || color[i] || removableMatType[i] || pocketsPairs[i] || removableMatThreadColor[i];
      return {
        productId,
        qty: Number(qtys[i] ?? 1),
        configuration: hasConfig
          ? {
              complectation: complectation[i] || undefined,
              materialId: materialId[i] || undefined,
              color: color[i] || undefined,
              pattern: pattern[i] || undefined,
              threadColor: threadColor[i] || undefined,
              edgingColor: edgingColor[i] || undefined,
              removableMatType: removableMatType[i] || undefined,
              removableMatColor: removableMatColor[i] || undefined,
              removableMatThreadColor: removableMatThreadColor[i] || undefined,
              removableMatEdging: removableMatEdging[i] || undefined,
              heelPad: heelPad[i] === "yes",
              pockets: pockets[i] === "yes",
              pocketsPairs: pocketsPairs[i] ? Number(pocketsPairs[i]) : undefined,
              pocketsLogo: pocketsLogo[i] === "yes",
              logo: logo[i] === "yes",
              customLogoText: customLogoText[i] || undefined,
              embroidery: embroidery[i] === "yes",
              extraAccessories: extraAccessories[i] || undefined,
            }
          : undefined,
      };
    })
    .filter((it) => it.productId);

  const customerId = String(formData.get("customerId") ?? "");
  const input: CreateOrderInput = {
    customerId: customerId || undefined,
    newCustomer: customerId
      ? undefined
      : {
          fullName: String(formData.get("customerFullName") ?? ""),
          phone: String(formData.get("customerPhone") ?? ""),
          whatsapp: String(formData.get("customerWhatsapp") ?? "") || undefined,
          city: String(formData.get("customerCity") ?? "") || undefined,
          clientType: (String(formData.get("customerClientType") ?? "INDIVIDUAL") as "INDIVIDUAL" | "COMPANY"),
          isVip: formData.get("customerIsVip") === "yes",
        },
    vehicleId: String(formData.get("vehicleId") ?? "") || undefined,
    newVehicle:
      formData.get("vehicleId") || !formData.get("vehicleMake")
        ? undefined
        : {
            make: String(formData.get("vehicleMake") ?? ""),
            model: String(formData.get("vehicleModel") ?? ""),
            generation: String(formData.get("vehicleGeneration") ?? "") || undefined,
            body: String(formData.get("vehicleBody") ?? "") || undefined,
            year: formData.get("vehicleYear") ? Number(formData.get("vehicleYear")) : undefined,
            numberOfRows: formData.get("vehicleRows") ? Number(formData.get("vehicleRows")) : undefined,
            steeringSide: (String(formData.get("vehicleSteering") ?? "") || undefined) as "LEFT" | "RIGHT" | undefined,
            vin: String(formData.get("vehicleVin") ?? "") || undefined,
          },
    priority: String(formData.get("priority") ?? "NORMAL"),
    source: String(formData.get("source") ?? "") || undefined,
    salesChannel: String(formData.get("salesChannel") ?? "") || undefined,
    certificateNo: String(formData.get("certificateNo") ?? "") || undefined,
    managerBonus: formData.get("managerBonus") ? Number(formData.get("managerBonus")) : undefined,
    comment: String(formData.get("comment") ?? "") || undefined,
    deadline: String(formData.get("deadline") ?? "") || undefined,
    fulfillmentType: (String(formData.get("fulfillmentType") ?? "") || undefined) as CreateOrderInput["fulfillmentType"],
    items,
    requestedDiscountPct: formData.get("requestedDiscountPct") ? Number(formData.get("requestedDiscountPct")) : undefined,
  };

  const orderId = await runOrRedirectWithError(async () => {
    if (items.length === 0) throw new Error("Кемінде бір тауар қосу керек (тауар таңдалмады)");
    if (!input.customerId && !input.newCustomer?.fullName) throw new Error("Клиентті таңдаңыз немесе аты-жөнін енгізіңіз");
    if (!input.customerId && !input.newCustomer?.phone) throw new Error("Клиенттің телефонын енгізіңіз");

    const order = await createOrder(user, input);

    const address = String(formData.get("deliveryAddress") ?? "");
    if (input.fulfillmentType === "DELIVERY" && address) {
      await scheduleDelivery(user, order.id, {
        address,
        city: String(formData.get("deliveryCity") ?? "") || undefined,
        phone: String(formData.get("deliveryPhone") ?? "") || undefined,
      });
    }
    const installDate = String(formData.get("installationDate") ?? "");
    if (input.fulfillmentType === "INSTALLATION" && installDate) {
      await scheduleInstallation(user, order.id, { date: installDate });
    }

    return order.id;
  }, "/orders/new");

  revalidatePath("/orders");
  redirect(`/orders/${orderId}`);
}

export async function addPaymentAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () =>
      addPayment(user, orderId, {
        amount: Number(formData.get("amount") ?? 0),
        method: String(formData.get("method") ?? "CASH"),
        cashbox: String(formData.get("cashbox") ?? "") || undefined,
        transactionId: String(formData.get("transactionId") ?? "") || undefined,
        comment: String(formData.get("comment") ?? "") || undefined,
      }),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function confirmOrderAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(() => confirmOrder(user, orderId), `/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
}

export async function sendToProductionAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(() => sendToProduction(user, orderId), `/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
}

export async function markOrderReadyAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(() => markOrderReady(user, orderId), `/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
}

export async function advanceAfterReadyAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(() => advanceAfterReady(user, orderId), `/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
}

export async function completeOrderAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(() => completeOrder(user, orderId), `/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
}

export async function cancelOrderAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () => cancelOrder(user, orderId, String(formData.get("reason") ?? "") || undefined),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function returnOrderAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () => returnOrder(user, orderId, String(formData.get("reason") ?? "") || undefined),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function reworkOrderAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () => reworkOrder(user, orderId, String(formData.get("reason") ?? "") || undefined),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function duplicateOrderAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  const newOrder = await runOrRedirectWithError(() => duplicateOrder(user, orderId), `/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${newOrder.id}`);
}

export async function changeOrderDiscountAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () => changeOrderDiscount(user, orderId, Number(formData.get("discountAmount") ?? 0)),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function requestOrderDiscountAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () => requestOrderDiscount(user, orderId, Number(formData.get("requestedPct") ?? 0)),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function approveOrderDiscountAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () => decideOrderDiscount(user, String(formData.get("discountRequestId")), true),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function rejectOrderDiscountAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () => decideOrderDiscount(user, String(formData.get("discountRequestId")), false),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function changeOrderManagerAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () => changeOrderManager(user, orderId, String(formData.get("managerId"))),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function addOrderCommentAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(() => addOrderComment(user, orderId, String(formData.get("body") ?? "")), `/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
}

export async function recordQualityCheckAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  const productionOrderId = String(formData.get("productionOrderId"));
  const result = String(formData.get("result") ?? "PASSED") as "PASSED" | "FAILED" | "REWORK_REQUIRED";
  await runOrRedirectWithError(
    () => recordQualityCheck(user, productionOrderId, result, String(formData.get("comment") ?? "") || undefined),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function updateInstallationStatusAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () =>
      updateInstallationStatus(user, orderId, {
        status: String(formData.get("status") ?? "IN_PROGRESS"),
        beforePhotoUrl: String(formData.get("beforePhotoUrl") ?? "") || undefined,
        afterPhotoUrl: String(formData.get("afterPhotoUrl") ?? "") || undefined,
      }),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function updateDeliveryStatusAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () => updateDeliveryStatus(user, orderId, String(formData.get("status") ?? "IN_DELIVERY")),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function addOrderAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  const url = String(formData.get("url") ?? "");
  if (!url) return;
  await runOrRedirectWithError(
    () => addOrderAttachment(user, orderId, String(formData.get("type") ?? "OTHER"), url),
    `/orders/${orderId}`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function updateOrderCustomerAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () =>
      updateOrderCustomer(user, orderId, {
        fullName: String(formData.get("fullName") ?? "") || undefined,
        phone: String(formData.get("phone") ?? "") || undefined,
        whatsapp: String(formData.get("whatsapp") ?? ""),
        city: String(formData.get("city") ?? ""),
        clientType: (String(formData.get("clientType") ?? "") || undefined) as "INDIVIDUAL" | "COMPANY" | undefined,
        isVip: formData.get("isVip") === "yes",
      }),
    `/orders/${orderId}?tab=client`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function updateOrderVehicleAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () =>
      updateOrderVehicle(user, orderId, {
        make: String(formData.get("make") ?? "") || undefined,
        model: String(formData.get("model") ?? "") || undefined,
        generation: String(formData.get("generation") ?? ""),
        body: String(formData.get("body") ?? ""),
        year: formData.get("year") ? Number(formData.get("year")) : undefined,
        numberOfRows: formData.get("numberOfRows") ? Number(formData.get("numberOfRows")) : undefined,
        steeringSide: (String(formData.get("steeringSide") ?? "") || undefined) as "LEFT" | "RIGHT" | undefined,
        vin: String(formData.get("vin") ?? ""),
      }),
    `/orders/${orderId}?tab=vehicle`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function updateOrderDetailsAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  await runOrRedirectWithError(
    () =>
      updateOrderDetails(user, orderId, {
        priority: String(formData.get("priority") ?? "") || undefined,
        source: String(formData.get("source") ?? ""),
        salesChannel: String(formData.get("salesChannel") ?? ""),
        certificateNo: String(formData.get("certificateNo") ?? ""),
        managerBonus: formData.get("managerBonus") ? Number(formData.get("managerBonus")) : undefined,
        comment: String(formData.get("comment") ?? ""),
        deadline: String(formData.get("deadline") ?? ""),
        fulfillmentType: (String(formData.get("fulfillmentType") ?? "") || undefined) as
          | "INSTALLATION"
          | "DELIVERY"
          | "PICKUP"
          | undefined,
      }),
    `/orders/${orderId}?tab=overview`
  );
  revalidatePath(`/orders/${orderId}`);
}

export async function updateOrderItemAction(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId"));
  const itemId = String(formData.get("itemId"));
  await runOrRedirectWithError(
    () =>
      updateOrderItem(user, orderId, itemId, {
        productId: String(formData.get("productId") ?? "") || undefined,
        qty: formData.get("qty") ? Number(formData.get("qty")) : undefined,
        configuration: {
          complectation: String(formData.get("complectation") ?? "") || undefined,
          materialId: String(formData.get("materialId") ?? "") || undefined,
          color: String(formData.get("color") ?? "") || undefined,
          pattern: String(formData.get("pattern") ?? "") || undefined,
          threadColor: String(formData.get("threadColor") ?? "") || undefined,
          edgingColor: String(formData.get("edgingColor") ?? "") || undefined,
          removableMatType: String(formData.get("removableMatType") ?? "") || undefined,
          removableMatColor: String(formData.get("removableMatColor") ?? "") || undefined,
          removableMatThreadColor: String(formData.get("removableMatThreadColor") ?? "") || undefined,
          removableMatEdging: String(formData.get("removableMatEdging") ?? "") || undefined,
          heelPad: formData.get("heelPad") === "yes",
          pockets: formData.get("pockets") === "yes",
          pocketsPairs: formData.get("pocketsPairs") ? Number(formData.get("pocketsPairs")) : undefined,
          pocketsLogo: formData.get("pocketsLogo") === "yes",
          logo: formData.get("logo") === "yes",
          customLogoText: String(formData.get("customLogoText") ?? "") || undefined,
          embroidery: formData.get("embroidery") === "yes",
          extraAccessories: String(formData.get("extraAccessories") ?? "") || undefined,
        },
      }),
    `/orders/${orderId}?tab=products`
  );
  revalidatePath(`/orders/${orderId}`);
}
