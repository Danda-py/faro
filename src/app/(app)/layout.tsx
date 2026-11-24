import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { publicAccount } from "@/lib/accounts";
import { AccountProvider } from "@/components/account-provider";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      accounts: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
    },
  });

  if (!user) redirect("/login");

  return (
    <AccountProvider initialAccounts={user.accounts.map(publicAccount)}>
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-4 p-4 md:flex-row">
        <Sidebar
          user={{ login: user.login, name: user.name, avatarUrl: user.avatarUrl }}
        />
        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </AccountProvider>
  );
}
