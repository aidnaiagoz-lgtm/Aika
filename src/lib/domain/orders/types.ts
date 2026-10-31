import type { PermissionAction, PermissionScope } from "@/lib/db";

export interface ActingUser {
  id: string;
  employee?: { id: string; departmentId: string | null; branchId: string | null } | null;
  userRoles: Array<{
    branchId: string | null;
    departmentId: string | null;
    role: {
      name: string;
      rolePermissions: Array<{
        scope: PermissionScope;
        permission: { resource: string; action: PermissionAction };
      }>;
    };
  }>;
}

export interface CreateOrderInput {
  // Client — customerId бар болса соны, болмаса жаңа клиент деректерін бер
  customerId?: string;
  newCustomer?: {
    fullName: string;
    phone: string;
    whatsapp?: string;
    city?: string;
    clientType?: "INDIVIDUAL" | "COMPANY";
    isVip?: boolean;
  };

  // Vehicle
  vehicleId?: string;
  newVehicle?: {
    make: string;
    model: string;
    generation?: string;
    body?: string;
    year?: number;
    numberOfRows?: number;
    steeringSide?: "LEFT" | "RIGHT";
    licensePlate?: string;
    vin?: string;
  };

  branchId?: string;
  priority?: string;
  source?: string; // Канал обращения
  salesChannel?: string; // Канал продаж
  certificateNo?: string; // Номер сертификата
  managerBonus?: number; // Бонус менеджеров
  comment?: string;
  deadline?: string;
  fulfillmentType?: "INSTALLATION" | "DELIVERY" | "PICKUP";

  items: Array<{
    productId: string;
    qty: number;
    discountAmount?: number;
    comment?: string;
    configuration?: {
      complectation?: string;
      materialId?: string;
      color?: string;
      pattern?: string;
      threadColor?: string;
      edgingColor?: string;
      removableMatType?: string;
      removableMatColor?: string;
      removableMatThreadColor?: string;
      removableMatEdging?: string;
      heelPad?: boolean;
      pockets?: boolean;
      pocketsPairs?: number;
      pocketsLogo?: boolean;
      logo?: boolean;
      customLogoText?: string;
      embroidery?: boolean;
      extraAccessories?: string;
    };
  }>;

  requestedDiscountPct?: number; // §10 — order-level discount, рөл лимитімен тексеріледі
}
