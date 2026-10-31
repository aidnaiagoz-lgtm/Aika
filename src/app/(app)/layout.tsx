import { redirect } from "next/navigation";
import { Sidebar, Header } from "@/lib/ui";
import { prisma } from "@/lib/db";
import { getDictionary, INTL_LOCALE } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { logoutAction, setLocaleAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const t = getDictionary(locale);

  const role = user.userRoles[0]?.role;
  const roleLabel = role ? (t.roles[role.name] ?? role.name) : t.roles.employeeFallback;
  const displayName = user.employee?.fullName ?? user.email;

  const unreadCount = await prisma.notification.count({
    where: {
      readAt: null,
      OR: [
        { recipientId: user.id },
        user.employee?.departmentId ? { departmentId: user.employee.departmentId } : {},
      ],
    },
  });

  const dateLabel = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "long", year: "numeric" }).format(
    new Date()
  );

  return (
    <div className="flex h-screen overflow-hidden bg-page-bg">
      <Sidebar userName={displayName} userRole={roleLabel} locale={locale} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          userName={displayName}
          userRole={roleLabel}
          unreadCount={unreadCount}
          dateLabel={dateLabel}
          onLogout={logoutAction}
          locale={locale}
          onSetLocale={setLocaleAction}
        />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
