
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { canAccessFleet } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function FleetPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessFleet(session)) redirect("/dashboard");

  const branchFilter =
    session.role === Role.STAFF && session.branchId ? { branchId: session.branchId } : {};

  const vehicles = await prisma.vehicle.findMany({
    where: branchFilter,
    include: {
      branch: true,
      routePoints: { orderBy: { recordedAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell
      title="Car Tracking"
      role={session.role}
      userName={session.name}
      nav={[
        { href: "/choose-path", label: "Paths" },
        { href: "/dashboard", label: "Overview" },
        { href: "/dashboard/inventory", label: "Inventory" },
        { href: "/cctv", label: "CCTV" },
        { href: "/fleet", label: "Car Tracking" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--navy)]">Fleet intelligence</h2>
          <p className="text-[var(--muted)]">
            Live GPS status, engine state, driver assignment, and historical route points
            {session.role === Role.STAFF ? " for your branch" : ""}.
          </p>
        </div>

        <div className="panel relative h-[360px] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(8,10,14,.35), rgba(8,10,14,.78)), url('https://images.unsplash.com/photo-1524661132704-042c6bb00efe?auto=format&fit=crop&w=1600&q=80')",
            }}
          />
          <div className="relative z-10 flex h-full flex-col justify-end p-5">
            <p className="text-2xl font-bold text-white">Live GPS map</p>
            <p className="max-w-xl text-sm text-white/75">
              Vehicle pins reflect the latest stored coordinates. Connect a map provider key later
              for full interactive tiles.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="rounded-full border border-white/20 bg-black/45 px-3 py-2 text-sm text-white"
                >
                  <p className="font-semibold">{vehicle.plateNumber}</p>
                  <p className="text-[var(--muted)]">
                    {vehicle.latitude.toFixed(4)}, {vehicle.longitude.toFixed(4)} · {vehicle.speedKmh}{" "}
                    km/h
                  </p>
                </div>
              ))}
              {vehicles.length === 0 && (
                <p className="text-sm text-white/75">No vehicles available for your branch.</p>
              )}
            </div>
          </div>
        </div>

        <div className="content-dark overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Plate</th>
                <th>Model</th>
                <th>Driver</th>
                <th>Engine</th>
                <th>Speed</th>
                <th>Status</th>
                <th>Location</th>
                <th>Route points</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.plateNumber}</td>
                  <td>{vehicle.model}</td>
                  <td>{vehicle.driverName || "Unassigned"}</td>
                  <td>{vehicle.engineOn ? "On" : "Off"}</td>
                  <td>{vehicle.speedKmh} km/h</td>
                  <td>{vehicle.status}</td>
                  <td>
                    {vehicle.latitude.toFixed(4)}, {vehicle.longitude.toFixed(4)}
                  </td>
                  <td>{vehicle.routePoints.length}</td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={8}>No vehicles available for your branch.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {vehicles.map((vehicle) => (
            <div key={`${vehicle.id}-route`} className="panel p-4">
              <h3 className="text-xl font-bold text-[var(--navy)]">
                {vehicle.plateNumber} route history
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                {vehicle.routePoints.map((point) => (
                  <li key={point.id}>
                    {point.recordedAt.toLocaleString()} · {point.latitude.toFixed(4)},{" "}
                    {point.longitude.toFixed(4)} · {point.speedKmh} km/h
                  </li>
                ))}
                {vehicle.routePoints.length === 0 && <li>No historical points yet.</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
