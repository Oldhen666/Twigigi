import Link from "next/link";
import { setUserRole } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { formatDate } from "@/lib/format";
import type { UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["seller", "buyer", "admin"];
const ROLE_LABEL: Record<UserRole, string> = { seller: "Seller", buyer: "Buyer", admin: "Admin" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  const users = listUsers();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Users</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Sellers and admins have a public page. Buyers only see their orders. Changing someone to a buyer hides their Twigs from the public site. The Twigs stay on their account.
      </p>
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-6 overflow-x-auto rounded-3xl border border-line bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Twigs</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {user.displayName}
                    {user.id === admin.id ? <span className="ml-2 text-xs font-normal uppercase tracking-wide text-muted">You</span> : null}
                  </p>
                  <p className="text-muted">{user.email}</p>
                  {user.role === "buyer" ? (
                    <p className="text-muted">{user.username}</p>
                  ) : (
                    <Link href={`/${user.username}`} className="text-forest">twigigi.com/{user.username}</Link>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{formatDate(user.createdAt)}</td>
                <td className="px-4 py-3">{user.productCount}</td>
                <td className="px-4 py-3">
                  {user.id === admin.id ? (
                    <span>{ROLE_LABEL[user.role]}</span>
                  ) : (
                    <form action={setUserRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={user.id} />
                      <select
                        name="role"
                        defaultValue={user.role}
                        className="h-9 rounded-xl border border-line bg-white px-2 text-sm text-ink"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                        ))}
                      </select>
                      <button className="inline-flex h-9 items-center rounded-full bg-forest px-3 text-sm text-card">Save</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
