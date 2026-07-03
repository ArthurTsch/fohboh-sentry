"use server";

import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { buildGeneratedUnitId } from "@/lib/restaurants/ids";
import { getSuperAdminTableColumns, SUPERADMIN_TABLES } from "@/app/superadmin/table-registry";
import {
  authenticateManager,
} from "@/lib/auth/manager-auth";
import {
  createSessionCookieValue,
  getSessionCookieOptions,
  hasSessionSecretConfigured,
  MANAGER_SESSION_COOKIE_NAME,
  requireSuperAdminSession,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromHeaders } from "@/lib/ops/request";
import { checkRateLimit } from "@/lib/ops/rate-limit";

async function requireAdminSession() {
  try {
    return await requireSuperAdminSession();
  } catch {
    redirect("/superadmin");
  }
}

export async function loginAdminAction(formData: FormData) {
  const requestContext = await getRequestContextFromHeaders();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  try {
    const limiter = checkRateLimit({
      key: `superadmin-login:${requestContext.ipAddress ?? "unknown"}:${email.toLowerCase()}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!limiter.allowed) {
      redirect("/superadmin?error=rate-limit");
    }
    const result = await authenticateManager(email, password);

    if (!result.ok) {
      await writeAuditLog({
        action: "superadmin_login_failed",
        entityId: email.toLowerCase() || "unknown",
        entityType: "auth_session",
        ipAddress: requestContext.ipAddress,
        metadata: {
          reason: result.error,
          requestId: requestContext.requestId,
        },
        summary: `Superadmin login failed for ${email || "unknown email"}.`,
        userAgent: requestContext.userAgent,
      }).catch(() => null);
      redirect("/superadmin?error=invalid-credentials");
    }

    if (result.session.role !== "SuperAdmin") {
      await writeAuditLog({
        action: "superadmin_login_denied",
        actorUserId: result.session.managerId ?? null,
        entityId: result.session.email,
        entityType: "auth_session",
        ipAddress: requestContext.ipAddress,
        metadata: {
          reason: "not-superadmin",
          requestId: requestContext.requestId,
        },
        summary: `Denied superadmin login for ${result.session.email}.`,
        userAgent: requestContext.userAgent,
      }).catch(() => null);
      redirect("/superadmin?error=not-admin");
    }

    if (!hasSessionSecretConfigured()) {
      redirect("/superadmin?error=session-config");
    }

    const cookieStore = await cookies();
    cookieStore.set(
      MANAGER_SESSION_COOKIE_NAME,
      createSessionCookieValue(result.session),
      getSessionCookieOptions(),
    );
    await writeAuditLog({
      action: "superadmin_login_succeeded",
      actorUserId: result.session.managerId ?? null,
      entityId: result.session.email,
      entityType: "auth_session",
      ipAddress: requestContext.ipAddress,
      metadata: {
        requestId: requestContext.requestId,
      },
      summary: `Superadmin login succeeded for ${result.session.email}.`,
      userAgent: requestContext.userAgent,
    }).catch(() => null);

    redirect("/superadmin");
  } catch (error) {
    await writeAuditLog({
      action: "superadmin_login_error",
      entityId: email.toLowerCase() || "unknown",
      entityType: "auth_session",
      ipAddress: requestContext.ipAddress,
      metadata: {
        error: error instanceof Error ? error.message : "unknown",
        requestId: requestContext.requestId,
      },
      summary: `Superadmin login errored for ${email || "unknown email"}.`,
      userAgent: requestContext.userAgent,
    }).catch(() => null);
    redirect("/superadmin?error=server-error");
  }
}

export async function logoutAdminAction() {
  const requestContext = await getRequestContextFromHeaders();
  const session = await requireAdminSession();
  const cookieStore = await cookies();
  cookieStore.delete(MANAGER_SESSION_COOKIE_NAME);
  await writeAuditLog({
    action: "superadmin_logout",
    actorUserId: session.managerId ?? null,
    entityId: session.email,
    entityType: "auth_session",
    ipAddress: requestContext.ipAddress,
    metadata: {
      requestId: requestContext.requestId,
    },
    summary: `Superadmin logout for ${session.email}.`,
    userAgent: requestContext.userAgent,
  }).catch(() => null);
  redirect("/superadmin");
}

export async function createManagerAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneNumber = String(formData.get("phone_number") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const role = String(formData.get("role") ?? "Manager").trim();
  const active = formData.get("active") === "on";
  const emailVerified = formData.get("email_verified") === "on";

  if (!email || !password || !role) {
    redirect("/superadmin?create=missing-fields");
  }

  const passwordHash = await hash(password, 12);

  try {
    const manager = await prisma.managers.create({
      data: {
        active,
        address: address || null,
        email,
        email_verified: emailVerified,
        full_name: fullName || null,
        password_hash: passwordHash,
        phone_number: phoneNumber || null,
        role,
      },
    });
    await writeAuditLog({
      action: "manager_created",
      actorUserId: session.managerId ?? null,
      entityId: String(manager.id),
      entityType: "managers",
      ipAddress: requestContext.ipAddress,
      metadata: {
        email,
        requestId: requestContext.requestId,
        role,
      },
      summary: `Created manager ${email}.`,
      userAgent: requestContext.userAgent,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      redirect("/superadmin/managers?create=duplicate-email");
    }

    redirect("/superadmin/managers?create=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/managers");
  redirect("/superadmin/managers?create=success");
}

export async function updateManagerAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const id = Number(formData.get("id"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneNumber = String(formData.get("phone_number") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const role = String(formData.get("role") ?? "Manager").trim();
  const active = formData.get("active") === "on";
  const emailVerified = formData.get("email_verified") === "on";

  if (!Number.isFinite(id) || !email || !role) {
    redirect("/superadmin/managers?update=missing-fields");
  }

  try {
    await prisma.managers.update({
      where: { id },
      data: {
        active,
        address: address || null,
        email,
        email_verified: emailVerified,
        full_name: fullName || null,
        ...(password ? { password_hash: await hash(password, 12) } : {}),
        phone_number: phoneNumber || null,
        role,
      },
    });
    await writeAuditLog({
      action: "manager_updated",
      actorUserId: session.managerId ?? null,
      entityId: String(id),
      entityType: "managers",
      ipAddress: requestContext.ipAddress,
      metadata: {
        email,
        requestId: requestContext.requestId,
        role,
      },
      summary: `Updated manager ${email}.`,
      userAgent: requestContext.userAgent,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      redirect("/superadmin/managers?update=duplicate-email");
    }

    redirect("/superadmin/managers?update=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/managers");
  redirect("/superadmin/managers?update=success");
}

export async function deleteManagerAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) {
    redirect("/superadmin/managers?delete=invalid-id");
  }

  try {
    const existing = await prisma.managers.findUnique({
      where: { id },
      select: { email: true, id: true },
    });
    await prisma.managers.delete({
      where: { id },
    });
    await writeAuditLog({
      action: "manager_deleted",
      actorUserId: session.managerId ?? null,
      entityId: String(id),
      entityType: "managers",
      ipAddress: requestContext.ipAddress,
      metadata: {
        email: existing?.email ?? null,
        requestId: requestContext.requestId,
      },
      summary: `Deleted manager ${existing?.email ?? `#${id}`}.`,
      userAgent: requestContext.userAgent,
    });
  } catch {
    redirect("/superadmin/managers?delete=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/managers");
  redirect("/superadmin/managers?delete=success");
}

export async function createRestaurantAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const zipCode = String(formData.get("zip_code") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const contactNumber = String(formData.get("contact_number") ?? "").trim();
  const storeId = String(formData.get("store_id") ?? "").trim();
  const unitId = String(formData.get("unit_id") ?? "").trim();
  const createdByRaw = String(formData.get("created_by") ?? "").trim();
  const active = formData.get("active") === "on";

  if (!name) {
    redirect("/superadmin/restaurants?restaurant=missing-name");
  }

  try {
    const createdRestaurant = await prisma.restaurants.create({
      data: {
        active,
        city: city || null,
        contact_number: contactNumber || null,
        country: country || null,
        created_by: createdByRaw ? Number(createdByRaw) : null,
        location: location || null,
        name,
        state: state || null,
        store_id: storeId || null,
        unit_id: unitId || null,
        zip_code: zipCode || null,
      },
    });
    const generatedUnitId = unitId || storeId || buildGeneratedUnitId(createdRestaurant.id);
    const restaurant =
      createdRestaurant.unit_id && createdRestaurant.store_id
        ? createdRestaurant
        : await prisma.restaurants.update({
            where: { id: createdRestaurant.id },
            data: {
              store_id: createdRestaurant.store_id || generatedUnitId,
              unit_id: createdRestaurant.unit_id || generatedUnitId,
            },
          });
    await writeAuditLog({
      action: "restaurant_created_superadmin",
      actorUserId: session.managerId ?? null,
      entityId: String(restaurant.id),
      entityType: "restaurants",
      ipAddress: requestContext.ipAddress,
      metadata: {
        name,
        requestId: requestContext.requestId,
        unitId: generatedUnitId,
      },
      summary: `Created restaurant ${name} from superadmin.`,
      userAgent: requestContext.userAgent,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      redirect("/superadmin/restaurants?restaurant=duplicate-unit");
    }

    redirect("/superadmin/restaurants?restaurant=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/restaurants");
  revalidatePath("/superadmin/tables");
  redirect("/superadmin/restaurants?restaurant=success");
}

export async function updateRestaurantAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const zipCode = String(formData.get("zip_code") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const contactNumber = String(formData.get("contact_number") ?? "").trim();
  const storeId = String(formData.get("store_id") ?? "").trim();
  const unitId = String(formData.get("unit_id") ?? "").trim();
  const createdByRaw = String(formData.get("created_by") ?? "").trim();
  const active = formData.get("active") === "on";

  if (!Number.isFinite(id) || !name) {
    redirect("/superadmin/restaurants?restaurant=missing-name");
  }

  try {
    await prisma.restaurants.update({
      where: { id },
      data: {
        active,
        city: city || null,
        contact_number: contactNumber || null,
        country: country || null,
        created_by: createdByRaw ? Number(createdByRaw) : null,
        location: location || null,
        name,
        state: state || null,
        store_id: storeId || null,
        unit_id: unitId || null,
        zip_code: zipCode || null,
      },
    });
    await writeAuditLog({
      action: "restaurant_updated_superadmin",
      actorUserId: session.managerId ?? null,
      entityId: String(id),
      entityType: "restaurants",
      ipAddress: requestContext.ipAddress,
      metadata: {
        name,
        requestId: requestContext.requestId,
        unitId: unitId || null,
      },
      summary: `Updated restaurant ${name} from superadmin.`,
      userAgent: requestContext.userAgent,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      redirect("/superadmin/restaurants?restaurant=duplicate-unit");
    }

    redirect("/superadmin/restaurants?restaurant=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/restaurants");
  revalidatePath("/superadmin/tables");
  redirect("/superadmin/restaurants?restaurant=updated");
}

export async function deleteRestaurantAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) {
    redirect("/superadmin/restaurants?restaurant=invalid-id");
  }

  try {
    const existing = await prisma.restaurants.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    await prisma.restaurants.delete({
      where: { id },
    });
    await writeAuditLog({
      action: "restaurant_deleted_superadmin",
      actorUserId: session.managerId ?? null,
      entityId: String(id),
      entityType: "restaurants",
      ipAddress: requestContext.ipAddress,
      metadata: {
        name: existing?.name ?? null,
        requestId: requestContext.requestId,
      },
      summary: `Deleted restaurant ${existing?.name ?? `#${id}`} from superadmin.`,
      userAgent: requestContext.userAgent,
    });
  } catch {
    redirect("/superadmin/restaurants?restaurant=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/restaurants");
  revalidatePath("/superadmin/tables");
  redirect("/superadmin/restaurants?restaurant=deleted");
}

export async function deleteCaarReportAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) {
    redirect("/superadmin/management?caar=invalid-id");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const report = await tx.caar_reports.findUnique({
        where: { id },
        select: {
          caar_id: true,
          id: true,
        },
      });

      if (!report) {
        throw new Error("not-found");
      }

      const persistedCaar = await tx.caars_v2.findFirst({
        where: {
          caar_external_id: report.caar_id,
        },
        select: {
          id: true,
        },
      }).catch(() => null);

      if (persistedCaar) {
        await tx.caar_artifacts_v2.deleteMany({
          where: {
            caar_id: persistedCaar.id,
          },
        });
        await tx.caars_v2.delete({
          where: {
            id: persistedCaar.id,
          },
        });
      }

      await tx.caar_reports.delete({
        where: { id: report.id },
      });
      await writeAuditLog(
        {
          action: "caar_deleted_superadmin",
          actorUserId: session.managerId ?? null,
          entityId: report.caar_id,
          entityType: "caars_v2",
          ipAddress: requestContext.ipAddress,
          metadata: {
            requestId: requestContext.requestId,
          },
          summary: `Deleted CAAR ${report.caar_id} from superadmin.`,
          userAgent: requestContext.userAgent,
        },
        tx,
      );
    });
  } catch {
    redirect("/superadmin/management?caar=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/management");
  revalidatePath("/superadmin/tables");
  redirect("/superadmin/management?caar=deleted");
}

export async function deleteSuperAdminTableRowAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const table = String(formData.get("table") ?? "").trim();
  const id = Number(formData.get("id"));

  if (!SUPERADMIN_TABLES.some((entry) => entry.name === table) || !Number.isFinite(id)) {
    redirect(`/superadmin/tables?table=${encodeURIComponent(table || "managers")}&tableState=invalid-row`);
  }

  const columns = await getSuperAdminTableColumns(table);
  const hasNumericId = columns.some(
    (column) =>
      column.column_name === "id" &&
      ["integer", "bigint", "smallint"].includes(column.data_type),
  );

  if (!hasNumericId) {
    redirect(`/superadmin/tables?table=${encodeURIComponent(table)}&tableState=invalid-row`);
  }

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM public.${table} WHERE id = $1`, id);
    await writeAuditLog({
      action: "superadmin_table_row_deleted",
      actorUserId: session.managerId ?? null,
      entityId: String(id),
      entityType: table,
      ipAddress: requestContext.ipAddress,
      metadata: {
        requestId: requestContext.requestId,
        table,
      },
      summary: `Deleted row ${id} from ${table}.`,
      userAgent: requestContext.userAgent,
    });
  } catch {
    redirect(`/superadmin/tables?table=${encodeURIComponent(table)}&tableState=server-error`);
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/tables");
  if (table === "managers") {
    revalidatePath("/superadmin/managers");
  }
  if (table === "restaurants" || table === "restaurant_sentry_state") {
    revalidatePath("/superadmin/restaurants");
  }
  if (table === "caar_reports" || table === "caars_v2") {
    revalidatePath("/superadmin/management");
  }

  redirect(`/superadmin/tables?table=${encodeURIComponent(table)}&tableState=deleted`);
}
