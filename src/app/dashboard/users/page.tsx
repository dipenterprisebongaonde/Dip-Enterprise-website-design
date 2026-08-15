
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { DataForm } from "@/components/DataForm";
import { DeleteUserButton } from "@/components/DeleteUserButton";
import { UserEditForm } from "@/components/UserEditForm";
import { getBranchScope } from "@/lib/active-branch";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.SUPER_ADMIN) redirect("/dashboard");

  const { branchId: activeBranchId } = await getBranchScope(session);

  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      where: activeBranchId
        ? {
            OR: [{ branchId: activeBranchId }, { role: Role.SUPER_ADMIN }],
          }
        : {},
      orderBy: { createdAt: "desc" },
      include: { branch: true },
    }),
    prisma.branch.findMany({
      where: activeBranchId ? { id: activeBranchId } : {},
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="brand-display text-3xl">User management</h2>
        <p className="text-[var(--muted)]">
          Add Super Admins or assign Standard Staff to a specific branch.
        </p>
      </div>

      <DataForm
        action="/api/app/users"
        submitLabel="Add user"
        fields={[
          { name: "name", label: "Full name", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "password", label: "Temp password", type: "password", required: true },
          {
            name: "role",
            label: "Role",
            required: true,
            options: [
              { label: "Super Admin", value: "SUPER_ADMIN" },
              { label: "Standard Staff", value: "STAFF" },
            ],
          },
          {
            name: "branchId",
            label: "Assigned branch (required for staff)",
            options: branches.map((b) => ({ label: b.name, value: b.id })),
            defaultValue: activeBranchId || undefined,
          },
        ]}
      />

      <div className="panel overflow-x-auto rounded-sm">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role === "SUPER_ADMIN" ? "Super Admin" : "Staff"}</td>
                <td>{user.branch?.name || "All / unassigned"}</td>
                <td>
                  <div className="user-row-actions">
                    <UserEditForm
                      user={{
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
                        role: user.role,
                        branchId: user.branchId,
                      }}
                      branches={branches.map((branch) => ({
                        id: branch.id,
                        name: branch.name,
                      }))}
                    />
                    {user.id !== session.id ? <DeleteUserButton userId={user.id} /> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
