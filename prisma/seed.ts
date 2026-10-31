import { PrismaClient, PermissionAction, PermissionScope } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

const DEPARTMENTS = [
  ["Сату", "sales"],
  ["CRM / Клиенттер", "crm"],
  ["Өндіріс / Цех", "production"],
  ["Қойма", "warehouse"],
  ["Сатып алу / Қытай", "procurement"],
  ["Логистика / Жеткізу", "logistics"],
  ["Маркетинг", "marketing"],
  ["Контент / SMM", "content"],
  ["Қаржы", "finance"],
  ["Бухгалтерия", "accounting"],
  ["HR / Персонал", "hr"],
  ["Филиалдар", "branches"],
  ["Құжаттар / Білім базасы", "knowledge-base"],
  ["IT / Автоматтандыру", "it"],
] as const;

const ROLES = [
  "CEO",
  "ADMIN",
  "DEPARTMENT_HEAD",
  "SENIOR_SALES_MANAGER",
  "SALES_MANAGER",
  "FINANCE",
  "ACCOUNTANT",
  "HR",
  "MARKETING",
  "SMM",
  "PRODUCTION_MANAGER",
  "PRODUCTION_EMPLOYEE",
  "WAREHOUSE_MANAGER",
  "PROCUREMENT",
  "DELIVERY",
  "INSTALLER",
  "BRANCH_MANAGER",
  "IT_ADMIN",
] as const;

// Жаңа домен (Sales/CRM/...) қосылған сайын осы тізім кеңейеді.
const RESOURCES = [
  "dashboard",
  "tasks",
  "notifications",
  "audit_log",
  "employees",
  "roles",
  "departments",
  "leads",
  "deals",
  "customers",
  "orders",
  "materials",
] as const;
const ACTIONS = Object.values(PermissionAction);

async function main() {
  console.log("Departments...");
  const departments = new Map<string, string>();
  for (const [name, slug] of DEPARTMENTS) {
    const dep = await prisma.department.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    departments.set(slug, dep.id);
  }

  console.log("Branch...");
  const mainBranch = await prisma.branch.upsert({
    where: { id: "main-branch" },
    update: {},
    create: { id: "main-branch", name: "Басты филиал — Алматы", address: "Алматы қ.", timezone: "Asia/Almaty" },
  });

  console.log("Roles...");
  const roles = new Map<string, string>();
  for (const name of ROLES) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true },
    });
    roles.set(name, role.id);
  }

  console.log("Permissions...");
  const permissions = new Map<string, string>();
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
      permissions.set(`${resource}:${action}`, perm.id);
    }
  }

  console.log("Role-permission grants...");
  // CEO/ADMIN — барлық resource+action, scope=ALL
  for (const roleName of ["CEO", "ADMIN"]) {
    const roleId = roles.get(roleName)!;
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: permissions.get(`${resource}:${action}`)! } },
          update: { scope: PermissionScope.ALL },
          create: { roleId, permissionId: permissions.get(`${resource}:${action}`)!, scope: PermissionScope.ALL },
        });
      }
    }
  }

  // Department Head — dashboard/tasks/notifications/leads/deals VIEW+CREATE+EDIT, scope=DEPARTMENT
  // + deals APPROVE (жеңілдік бекіту, §26)
  const headRoleId = roles.get("DEPARTMENT_HEAD")!;
  for (const resource of ["dashboard", "tasks", "notifications", "leads", "deals", "customers", "orders"] as const) {
    for (const action of [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: headRoleId, permissionId: permissions.get(`${resource}:${action}`)! } },
        update: { scope: PermissionScope.DEPARTMENT },
        create: { roleId: headRoleId, permissionId: permissions.get(`${resource}:${action}`)!, scope: PermissionScope.DEPARTMENT },
      });
    }
  }
  // ROP: скидка/cancellation approve, менеджер ауыстыру (§30)
  for (const resource of ["deals", "orders"] as const) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: headRoleId, permissionId: permissions.get(`${resource}:APPROVE`)! } },
      update: { scope: PermissionScope.DEPARTMENT },
      create: { roleId: headRoleId, permissionId: permissions.get(`${resource}:APPROVE`)!, scope: PermissionScope.DEPARTMENT },
    });
  }

  // Sales Manager — leads/deals VIEW+CREATE+EDIT, scope=OWN (тек өз лид/мәмілелері)
  // Senior Sales Manager — сол сияқты, бірақ VIEW scope=DEPARTMENT (команда мәмілелерін көреді)
  for (const roleName of ["SALES_MANAGER", "SENIOR_SALES_MANAGER"] as const) {
    const roleId = roles.get(roleName)!;
    for (const resource of ["leads", "deals", "orders"] as const) {
      for (const action of [PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.DELETE]) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: permissions.get(`${resource}:${action}`)! } },
          update: { scope: PermissionScope.OWN },
          create: { roleId, permissionId: permissions.get(`${resource}:${action}`)!, scope: PermissionScope.OWN },
        });
      }
      const viewScope = roleName === "SENIOR_SALES_MANAGER" ? PermissionScope.DEPARTMENT : PermissionScope.OWN;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permissions.get(`${resource}:VIEW`)! } },
        update: { scope: viewScope },
        create: { roleId, permissionId: permissions.get(`${resource}:VIEW`)!, scope: viewScope },
      });
    }
    // customers — жеке "иесі" жоқ ортақ CRM ресурсы, сондықтан leads/deals-тей OWN емес, бөлім деңгейінде
    for (const action of [PermissionAction.VIEW, PermissionAction.EDIT] as const) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permissions.get(`customers:${action}`)! } },
        update: { scope: PermissionScope.DEPARTMENT },
        create: { roleId, permissionId: permissions.get(`customers:${action}`)!, scope: PermissionScope.DEPARTMENT },
      });
    }
  }

  // Finance/Accounting/Production/Warehouse/Delivery/Installer — orders:VIEW жалпы (§31-32:
  // толық field-level шектеу UI деңгейінде кейінгі фазада, қазір scope=ALL жеткілікті)
  for (const roleName of [
    "FINANCE",
    "ACCOUNTANT",
    "PRODUCTION_MANAGER",
    "PRODUCTION_EMPLOYEE",
    "WAREHOUSE_MANAGER",
    "DELIVERY",
    "INSTALLER",
  ] as const) {
    const roleId = roles.get(roleName)!;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permissions.get("orders:VIEW")! } },
      update: { scope: PermissionScope.ALL },
      create: { roleId, permissionId: permissions.get("orders:VIEW")!, scope: PermissionScope.ALL },
    });
  }
  // Production — өз ProductionOrder-ды EDIT ете алады (статус жаңарту)
  for (const roleName of ["PRODUCTION_MANAGER", "PRODUCTION_EMPLOYEE"] as const) {
    const roleId = roles.get(roleName)!;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permissions.get("orders:EDIT")! } },
      update: { scope: PermissionScope.ALL },
      create: { roleId, permissionId: permissions.get("orders:EDIT")!, scope: PermissionScope.ALL },
    });
  }

  // Warehouse Manager — materials каталогын толық басқарады (§10 Warehouse модулі)
  {
    const roleId = roles.get("WAREHOUSE_MANAGER")!;
    for (const action of [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permissions.get(`materials:${action}`)! } },
        update: { scope: PermissionScope.ALL },
        create: { roleId, permissionId: permissions.get(`materials:${action}`)!, scope: PermissionScope.ALL },
      });
    }
  }
  // Production — материал қалдығын көре алады (тапсырыс алдында тексеру үшін), өзгерте алмайды
  for (const roleName of ["PRODUCTION_MANAGER", "PRODUCTION_EMPLOYEE"] as const) {
    const roleId = roles.get(roleName)!;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permissions.get("materials:VIEW")! } },
      update: { scope: PermissionScope.ALL },
      create: { roleId, permissionId: permissions.get("materials:VIEW")!, scope: PermissionScope.ALL },
    });
  }

  // Қалған operational рөлдер — dashboard/tasks/notifications VIEW (own) + tasks CREATE/EDIT (own)
  const baseRoles = ROLES.filter((r) => !["CEO", "ADMIN", "DEPARTMENT_HEAD"].includes(r));
  for (const roleName of baseRoles) {
    const roleId = roles.get(roleName)!;
    const grants: Array<[typeof RESOURCES[number], PermissionAction]> = [
      ["dashboard", PermissionAction.VIEW],
      ["tasks", PermissionAction.VIEW],
      ["tasks", PermissionAction.CREATE],
      ["tasks", PermissionAction.EDIT],
      ["notifications", PermissionAction.VIEW],
    ];
    for (const [resource, action] of grants) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permissions.get(`${resource}:${action}`)! } },
        update: { scope: PermissionScope.OWN },
        create: { roleId, permissionId: permissions.get(`${resource}:${action}`)!, scope: PermissionScope.OWN },
      });
    }
  }

  console.log("Demo users...");
  const passwordHash = await hash("Automax2026!", { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const ceoUser = await prisma.user.upsert({
    where: { email: "sulejmenovedil@gmail.com" },
    update: {},
    create: { email: "sulejmenovedil@gmail.com", passwordHash, status: "ACTIVE" },
  });
  await prisma.employee.upsert({
    where: { userId: ceoUser.id },
    update: {},
    create: { userId: ceoUser.id, fullName: "Еділ Сулейменов", position: "CEO", branchId: mainBranch.id },
  });
  const ceoHasRole = await prisma.userRole.findFirst({ where: { userId: ceoUser.id, roleId: roles.get("CEO")! } });
  if (!ceoHasRole) {
    await prisma.userRole.create({ data: { userId: ceoUser.id, roleId: roles.get("CEO")! } });
  }

  const demoStaff = [
    { email: "sales.manager@automax.kz", name: "Асхат Нұрланов", position: "Sales Manager", dept: "sales", role: "SALES_MANAGER" },
    { email: "warehouse@automax.kz", name: "Гүлнара Ахметова", position: "Warehouse Manager", dept: "warehouse", role: "WAREHOUSE_MANAGER" },
    { email: "production@automax.kz", name: "Данияр Серіков", position: "Production Manager", dept: "production", role: "PRODUCTION_MANAGER" },
  ];
  const staffUsers: Record<string, string> = {};
  const staffEmployees: Record<string, string> = {};
  for (const s of demoStaff) {
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, passwordHash, status: "ACTIVE" },
    });
    staffUsers[s.email] = u.id;
    const emp = await prisma.employee.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, fullName: s.name, position: s.position, departmentId: departments.get(s.dept), branchId: mainBranch.id },
    });
    staffEmployees[s.email] = emp.id;
    const existingRole = await prisma.userRole.findFirst({ where: { userId: u.id, roleId: roles.get(s.role)! } });
    if (!existingRole) {
      await prisma.userRole.create({ data: { userId: u.id, roleId: roles.get(s.role)!, departmentId: departments.get(s.dept) } });
    }
  }

  console.log("Products...");
  const demoProducts = [
    { sku: "MAT-3D-EVA", name: "3D Eva кілемше", category: "Автополик", type: "3D", class: "Standard", basePrice: 45_000 },
    { sku: "MAT-5D-LUX", name: "5D Lux кілемше", category: "Автополик", type: "5D", class: "Lux", basePrice: 65_000 },
    { sku: "MAT-7D-PREM", name: "7D Premium кілемше", category: "Автополик", type: "7D", class: "Premium", basePrice: 75_000 },
    { sku: "TRUNK-MAT", name: "Багажник төсеніші", category: "Багажник полик", type: null, class: "Standard", basePrice: 25_000 },
    { sku: "CAR-ACC-STD", name: "Автокорпадағ аксессуар", category: "Аксессуар", type: null, class: "Standard", basePrice: 15_000 },
    { sku: "TRUNK-CARPET", name: "Коврик в багажник", category: "Багажник полик", type: null, class: "Standard", basePrice: 20_000 },
    { sku: "ARMREST", name: "Подлокотник", category: "Подпятник", type: null, class: "Standard", basePrice: 18_000 },
  ];
  for (const p of demoProducts) {
    await prisma.product.upsert({ where: { sku: p.sku }, update: p, create: p });
  }

  console.log("Materials...");
  const demoMaterials = [
    { sku: "LTH-ECO-BLACK", category: "LEATHER" as const, name: "Эко-кожа", color: "Қара", unit: "м²", costPrice: 3_500 },
    { sku: "LTH-ECO-BROWN", category: "LEATHER" as const, name: "Эко-кожа", color: "Қоңыр", unit: "м²", costPrice: 3_500 },
    { sku: "LTH-ALCANTARA", category: "LEATHER" as const, name: "Алькантара", color: "Сұр", unit: "м²", costPrice: 6_000 },
    { sku: "THR-BLACK", category: "THREAD" as const, name: "Жіп", color: "Қара", unit: "катушка", costPrice: 500 },
    { sku: "THR-RED", category: "THREAD" as const, name: "Жіп", color: "Қызыл", unit: "катушка", costPrice: 500 },
    { sku: "EDG-BLACK", category: "EDGING" as const, name: "Кант", color: "Қара", unit: "м", costPrice: 800 },
    { sku: "EVA-GREY", category: "EVA" as const, name: "EVA полик", color: "Сұр", unit: "жиынтық", costPrice: 4_000 },
    { sku: "EVA-BLACK", category: "EVA" as const, name: "EVA полик", color: "Қара", unit: "жиынтық", costPrice: 4_000 },
    { sku: "CARPET-GREY", category: "CARPET" as const, name: "Ворс (carpet)", color: "Сұр", unit: "жиынтық", costPrice: 3_200 },
  ];
  for (const m of demoMaterials) {
    await prisma.material.upsert({ where: { sku: m.sku }, update: m, create: m });
  }

  console.log("Demo Sales data (customers, leads, deals)...");
  const salesEmployeeId = staffEmployees["sales.manager@automax.kz"];

  const demoCustomers = [
    { phone: "+7 701 111 2233", fullName: "Toyota Camry 70 иесі — Марат Ахметов", source: "instagram" },
    { phone: "+7 701 222 3344", fullName: "Hyundai Tucson 2021 иесі — Айгерім Сатова", source: "kaspi" },
  ];
  const customers: Record<string, string> = {};
  for (const c of demoCustomers) {
    const cust = await prisma.customer.upsert({
      where: { phone: c.phone },
      update: {},
      create: c,
    });
    customers[c.phone] = cust.id;
  }

  await prisma.lead.createMany({
    data: [
      { fullName: "Ержан Тоқтаров", phone: "+7 701 333 4455", source: "instagram", status: "NEW", assignedToId: salesEmployeeId, departmentId: departments.get("sales") },
      { fullName: "Динара Есжанова", phone: "+7 701 444 5566", source: "olx", status: "NEW", assignedToId: salesEmployeeId, departmentId: departments.get("sales") },
      { fullName: "Марат Ахметов", phone: "+7 701 111 2233", source: "instagram", status: "CONTACTED", assignedToId: salesEmployeeId, departmentId: departments.get("sales"), customerId: customers["+7 701 111 2233"] },
    ],
    skipDuplicates: true,
  });

  const existingDeal = await prisma.deal.findFirst({ where: { customerId: customers["+7 701 222 3344"] } });
  if (!existingDeal) {
    const deal = await prisma.deal.create({
      data: {
        customerId: customers["+7 701 222 3344"],
        assignedToId: salesEmployeeId,
        branchId: mainBranch.id,
        stage: "OFFER",
        amount: 98_000,
      },
    });
    await prisma.dealStageHistory.createMany({
      data: [
        { dealId: deal.id, fromStage: null, toStage: "QUALIFIED", changedById: salesEmployeeId },
        { dealId: deal.id, fromStage: "QUALIFIED", toStage: "OFFER", changedById: salesEmployeeId },
      ],
    });
    await prisma.discountRequest.create({
      data: { dealId: deal.id, requestedById: salesEmployeeId, requestedPct: 10 },
    });
  }

  console.log("Demo tasks...");
  await prisma.task.createMany({
    data: [
      {
        title: "Жаңа лидтерге қоңырау шалу",
        description: "Бүгінгі 8 жаңа лид бойынша follow-up",
        status: "IN_PROGRESS",
        priority: "HIGH",
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 6),
        assignedToId: staffUsers["sales.manager@automax.kz"],
        assignedById: ceoUser.id,
        departmentId: departments.get("sales"),
      },
      {
        title: "3D Eva кілемше қорын толықтыру",
        description: "Материал жеткізушіге тапсырыс беру керек, қалдық аз",
        status: "NEW",
        priority: "URGENT",
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24),
        assignedToId: staffUsers["warehouse@automax.kz"],
        assignedById: ceoUser.id,
        departmentId: departments.get("warehouse"),
      },
      {
        title: "Апталық өндіріс жоспарын бекіту",
        status: "REVIEW",
        priority: "MEDIUM",
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 48),
        assignedToId: staffUsers["production@automax.kz"],
        assignedById: ceoUser.id,
        departmentId: departments.get("production"),
      },
    ],
    skipDuplicates: true,
  });

  console.log("Demo notifications...");
  await prisma.notification.createMany({
    data: [
      {
        recipientId: ceoUser.id,
        level: "WARNING",
        type: "low_stock",
        title: "Қоймада 3D Eva кілемшесінің қоры аз",
        body: "Қосымша тапсырыс беру ұсынылады.",
      },
      {
        recipientId: ceoUser.id,
        level: "INFO",
        type: "daily_summary",
        title: "Бүгінгі сатылым 22.4%-ға өсті",
        body: "Толық аналитиканы Dashboard-тан көріңіз.",
      },
      {
        departmentId: departments.get("sales"),
        level: "CRITICAL",
        type: "overdue_followup",
        title: "3 клиентпен follow-up мерзімі өтіп кетті",
      },
    ],
  });

  console.log("Seed дайын. CEO логин: sulejmenovedil@gmail.com / Automax2026!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
