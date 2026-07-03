import Link from "next/link";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import {
  createRestaurantAction,
  deleteRestaurantAction,
  updateRestaurantAction,
} from "@/app/admin/actions";
import {
  adminInputClassName,
  adminMetadata,
  AdminField,
  AdminLoginScreen,
  AdminShell,
  getSearchParam,
  isAdminAuthorized,
} from "@/app/admin/admin-ui";

export const metadata: Metadata = adminMetadata;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SuperAdminRestaurantsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const authorized = await isAdminAuthorized();

  if (!authorized) {
    return <AdminLoginScreen error={getSearchParam(resolvedSearchParams, "error")} />;
  }

  const restaurants = await prisma.restaurants.findMany({
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    select: {
      active: true,
      city: true,
      contact_number: true,
      country: true,
      created_by: true,
      id: true,
      location: true,
      name: true,
      state: true,
      store_id: true,
      unit_id: true,
      zip_code: true,
    },
  });
  const managers = await prisma.managers.findMany({
    orderBy: [{ full_name: "asc" }, { email: "asc" }],
    select: {
      email: true,
      full_name: true,
      id: true,
    },
  });

  const restaurantState = getSearchParam(resolvedSearchParams, "restaurant");
  const editId = Number(getSearchParam(resolvedSearchParams, "edit"));
  const editingRestaurant = Number.isFinite(editId)
    ? restaurants.find((restaurant) => restaurant.id === editId) ?? null
    : null;
  const isEditing = Boolean(editingRestaurant);

  return (
    <AdminShell
      currentPath="/superadmin/restaurants"
      title="Restaurants"
      description="Review, create, and delete restaurant rows without mixing account management into the same page."
    >
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            {isEditing ? "Edit Restaurant" : "Restaurants"}
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            {isEditing ? "Update database restaurant" : "Add database restaurant"}
          </h2>

          {restaurantState === "success" ? (
            <AdminNotice tone="success">Restaurant created successfully.</AdminNotice>
          ) : null}
          {restaurantState === "updated" ? (
            <AdminNotice tone="success">Restaurant updated successfully.</AdminNotice>
          ) : null}
          {restaurantState === "deleted" ? (
            <AdminNotice tone="success">Restaurant deleted successfully.</AdminNotice>
          ) : null}
          {restaurantState === "missing-name" ? (
            <AdminNotice tone="error">Restaurant name is required.</AdminNotice>
          ) : null}
          {restaurantState === "duplicate-unit" ? (
            <AdminNotice tone="error">That `unit_id` already exists.</AdminNotice>
          ) : null}
          {restaurantState === "invalid-id" || restaurantState === "server-error" ? (
            <AdminNotice tone="error">Unable to update the restaurant table right now.</AdminNotice>
          ) : null}

          <form action={isEditing ? updateRestaurantAction : createRestaurantAction} className="mt-6 space-y-4">
            {isEditing ? <input type="hidden" name="id" value={editingRestaurant?.id} /> : null}
            <AdminField label="Name">
              <input
                name="name"
                className={adminInputClassName}
                placeholder="Dallas Uptown"
                defaultValue={editingRestaurant?.name ?? ""}
                required
              />
            </AdminField>
            <AdminField label="Location / Address">
              <input
                name="location"
                className={adminInputClassName}
                placeholder="3400 W. Airport Freeway, Irving TX 75062"
                defaultValue={editingRestaurant?.location ?? ""}
              />
            </AdminField>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="City">
                <input
                  name="city"
                  className={adminInputClassName}
                  placeholder="Irving"
                  defaultValue={editingRestaurant?.city ?? ""}
                />
              </AdminField>
              <AdminField label="State">
                <input
                  name="state"
                  className={adminInputClassName}
                  placeholder="TX"
                  defaultValue={editingRestaurant?.state ?? ""}
                />
              </AdminField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Zip Code">
                <input
                  name="zip_code"
                  className={adminInputClassName}
                  placeholder="75062"
                  defaultValue={editingRestaurant?.zip_code ?? ""}
                />
              </AdminField>
              <AdminField label="Country">
                <input
                  name="country"
                  className={adminInputClassName}
                  placeholder="USA"
                  defaultValue={editingRestaurant?.country ?? ""}
                />
              </AdminField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Store ID">
                <input
                  name="store_id"
                  className={adminInputClassName}
                  placeholder="NTXDAL-004"
                  defaultValue={editingRestaurant?.store_id ?? ""}
                />
              </AdminField>
              <AdminField label="Unit ID">
                <input
                  name="unit_id"
                  className={adminInputClassName}
                  placeholder="NTXDAL-004"
                  defaultValue={editingRestaurant?.unit_id ?? ""}
                />
              </AdminField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Contact Number">
                <input
                  name="contact_number"
                  className={adminInputClassName}
                  placeholder="+1 (214) 555-0100"
                  defaultValue={editingRestaurant?.contact_number ?? ""}
                />
              </AdminField>
              <AdminField label="Created By">
                <select
                  name="created_by"
                  className={adminInputClassName}
                  defaultValue={editingRestaurant?.created_by ? String(editingRestaurant.created_by) : ""}
                >
                  <option value="">Unassigned</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {(manager.full_name?.trim() || manager.email).trim()} #{manager.id}
                    </option>
                  ))}
                </select>
              </AdminField>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
              <input type="checkbox" name="active" defaultChecked={editingRestaurant?.active ?? true} />
              <span>Active</span>
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
              >
                {isEditing ? "Save Restaurant" : "Create Restaurant"}
              </button>
              {isEditing ? (
                <Link
                  href="/superadmin/restaurants"
                  className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Cancel
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                Restaurants Table
              </div>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                Existing restaurants
              </h2>
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)]">
              {restaurants.length} total
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="grid grid-cols-[72px_1.2fr_1fr_120px_100px_110px_140px] gap-3 bg-[var(--surface)] px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              <span>ID</span>
              <span>Name</span>
              <span>Location</span>
              <span>Unit ID</span>
              <span>Status</span>
              <span>Created By</span>
              <span>Actions</span>
            </div>

            {restaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="grid grid-cols-[72px_1.2fr_1fr_120px_100px_110px_140px] gap-3 border-t border-[var(--border)] px-4 py-3 text-sm"
              >
                <span className="font-[family-name:var(--font-mono)] text-[var(--muted)]">
                  {restaurant.id}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--text)]">{restaurant.name}</div>
                  <div className="truncate text-xs text-[var(--muted)]">
                    {restaurant.city || restaurant.state || restaurant.zip_code
                      ? [restaurant.city, restaurant.state, restaurant.zip_code].filter(Boolean).join(", ")
                      : restaurant.country || "No city/state"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[var(--text)]">{restaurant.location || "-"}</div>
                  <div className="truncate text-xs text-[var(--muted)]">
                    {restaurant.contact_number || "No contact number"}
                  </div>
                </div>
                <span className="truncate text-[var(--muted)]">
                  {restaurant.unit_id || restaurant.store_id || "-"}
                </span>
                <span
                  className={`inline-flex h-fit w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    restaurant.active
                      ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                      : "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                  }`}
                >
                  {restaurant.active ? "Active" : "Inactive"}
                </span>
                <span className="text-[var(--muted)]">
                  {managers.find((manager) => manager.id === restaurant.created_by)?.full_name ||
                    managers.find((manager) => manager.id === restaurant.created_by)?.email ||
                    restaurant.created_by ||
                    "-"}
                </span>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/superadmin/restaurants?edit=${restaurant.id}`}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                  >
                    Edit
                  </Link>
                  <form action={deleteRestaurantAction}>
                    <input type="hidden" name="id" value={restaurant.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-[rgba(214,48,49,0.18)] px-3 py-2 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)]"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function AdminNotice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success";
}) {
  return (
    <div
      className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
        tone === "success"
          ? "border border-[rgba(0,200,83,0.18)] bg-[rgba(0,200,83,0.06)] text-[var(--success)]"
          : "border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] text-[var(--accent)]"
      }`}
    >
      {children}
    </div>
  );
}
