import Link from "next/link";
import { adminRenameUser, setUserRole } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  const users = listUsers();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <h1 className="font-serif text-4xl">Users</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Everyone has the same account. Admin only opens this area.</p>
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-6 overflow-x-auto rounded-3xl border border-line bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Twigs</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 font-medium">Admin</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const yours = user.id === admin.id;
              return (
                <tr key={user.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {user.displayName}
                      {yours ? <span className="ml-2 text-xs font-normal uppercase tracking-wide text-muted">You</span> : null}
                    </p>
                    <p className="text-muted">{user.email}</p>
                    <form action={adminRenameUser} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={user.id} />
                      <input name="displayName" defaultValue={user.displayName} className="h-9 w-40 rounded-xl border border-line bg-white px-2 text-sm" />
                      <button className="text-forest">Save name</button>
                    </form>
                    <p className="text-muted">{user.username}</p>
                    <Link href={`/${user.publicId}`} className="text-forest">twigigi.com/{user.publicId}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">{user.productCount}</td>
                  <td className="px-4 py-3">{user.orderCount}</td>
                  <td className="px-4 py-3">
                    {yours ? (
                      <span>{user.role === "admin" ? "Admin" : "User"}</span>
                    ) : (
                      <form action={setUserRole}>
                        <input type="hidden" name="id" value={user.id} />
                        <input type="hidden" name="role" value={user.role === "admin" ? "user" : "admin"} />
                        <button className="inline-flex h-9 items-center rounded-full bg-forest px-3 text-sm text-card">
                          {user.role === "admin" ? "Remove admin" : "Make admin"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
