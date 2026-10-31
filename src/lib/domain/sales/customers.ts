import { prisma } from "@/lib/db";

export async function findOrCreateCustomer(input: { phone: string; fullName: string; source?: string }) {
  return prisma.customer.upsert({
    where: { phone: input.phone },
    update: {},
    create: { phone: input.phone, fullName: input.fullName, source: input.source },
  });
}

export async function addCustomerCar(customerId: string, input: { make: string; model: string; year?: number }) {
  return prisma.customerCar.create({
    data: { customerId, make: input.make, model: input.model, year: input.year },
  });
}
