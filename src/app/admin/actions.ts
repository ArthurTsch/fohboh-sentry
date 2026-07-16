"use server";

import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
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

function normalizeTeamRoleValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "owner") return "Owner";
  if (normalized === "finance") return "Finance";
  if (normalized === "location manager") return "Location Manager";
  if (normalized === "read-only" || normalized === "read only") return "Read-only";
  return null;
}

function normalizeTeamAccessScopeValue(value: string) {
  return value === "selected_locations" ? "selected_locations" : "all_locations";
}

export async function createTeamAccountAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const accountId = String(formData.get("account_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const plan = String(formData.get("plan") ?? "wgs").trim() || "wgs";
  const planCode = String(formData.get("plan_code") ?? "m01_m02_bundle").trim() || "m01_m02_bundle";
  const ownerManagerIdRaw = String(formData.get("owner_manager_id") ?? "").trim();
  const ownerManagerId = ownerManagerIdRaw ? Number(ownerManagerIdRaw) : null;

  if (!accountId || !name) {
    redirect("/superadmin/teams?team=missing-fields");
  }

  if (!/^[A-Za-z0-9:_-]{3,255}$/.test(accountId)) {
    redirect("/superadmin/teams?team=invalid-account-id");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existingCustomer = await tx.customers.findFirst({
        where: {
          account_id: accountId,
        },
        select: {
          id: true,
        },
      });

      if (existingCustomer) {
        throw new Error("duplicate-account-id");
      }

      await tx.customers.create({
        data: {
          account_id: accountId,
          name,
          plan,
        },
      });

      await tx.billing_accounts_v2.upsert({
        where: {
          account_id: accountId,
        },
        create: {
          account_id: accountId,
          plan_code: planCode,
        },
        update: {
          plan_code: planCode,
          updated_at: new Date(),
        },
      });

      if (typeof ownerManagerId === "number" && Number.isFinite(ownerManagerId)) {
        const existingMembership = await tx.$queryRaw<Array<{
          account_id: string;
          id: number;
          status: string;
        }>>(Prisma.sql`
          SELECT id, account_id, status
          FROM public.account_memberships_v2
          WHERE manager_id = ${ownerManagerId}
          LIMIT 1
        `);

        if (
          existingMembership[0] &&
          existingMembership[0].status === "active" &&
          existingMembership[0].account_id !== accountId
        ) {
          throw new Error("owner-already-on-other-team");
        }

        if (existingMembership[0]) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE public.account_memberships_v2
            SET
              account_id = ${accountId},
              team_role = 'Owner',
              access_scope = 'all_locations',
              status = 'active',
              account_holder = true,
              invited_by = ${session.managerId ?? null},
              invited_at = COALESCE(invited_at, now()),
              accepted_at = COALESCE(accepted_at, now()),
              revoked_at = NULL,
              last_active_at = now(),
              updated_at = now()
            WHERE id = ${existingMembership[0].id}
          `);
        } else {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO public.account_memberships_v2 (
              manager_id,
              account_id,
              team_role,
              access_scope,
              status,
              account_holder,
              invited_by,
              invited_at,
              accepted_at,
              last_active_at,
              created_at,
              updated_at
            )
            VALUES (
              ${ownerManagerId},
              ${accountId},
              'Owner',
              'all_locations',
              'active',
              true,
              ${session.managerId ?? null},
              now(),
              now(),
              now(),
              now(),
              now()
            )
          `);
        }
      }

      await writeAuditLog(
        {
          action: "team_account_created_superadmin",
          actorUserId: session.managerId ?? null,
          entityId: accountId,
          entityType: "customer_accounts_v2",
          ipAddress: requestContext.ipAddress,
          metadata: {
            name,
            ownerManagerId,
            plan,
            planCode,
            requestId: requestContext.requestId,
          },
          summary: `Created team account ${accountId}.`,
          userAgent: requestContext.userAgent,
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "duplicate-account-id") {
      redirect("/superadmin/teams?team=duplicate-account-id");
    }
    if (error instanceof Error && error.message === "owner-already-on-other-team") {
      redirect("/superadmin/teams?team=owner-already-on-other-team");
    }
    redirect("/superadmin/teams?team=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/teams");
  revalidatePath("/superadmin/tables");
  redirect("/superadmin/teams?team=created");
}

export async function addTeamMemberAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const accountId = String(formData.get("account_id") ?? "").trim();
  const managerId = Number(String(formData.get("manager_id") ?? "").trim());
  const role = normalizeTeamRoleValue(String(formData.get("team_role") ?? ""));
  const accessScope = normalizeTeamAccessScopeValue(String(formData.get("access_scope") ?? ""));
  const restaurantIds = [...new Set(
    formData
      .getAll("restaurant_ids")
      .map((value) => Number(String(value)))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];

  if (!accountId || !Number.isFinite(managerId) || !role) {
    redirect("/superadmin/teams?member=missing-fields");
  }

  const effectiveScope = role === "Location Manager" ? accessScope : "all_locations";

  try {
    await prisma.$transaction(async (tx) => {
      const manager = await tx.managers.findUnique({
        where: { id: managerId },
        select: { email: true, id: true },
      });

      if (!manager) {
        throw new Error("manager-not-found");
      }

      const teamLocationRows = await tx.$queryRaw<Array<{ restaurant_id: number }>>(Prisma.sql`
        SELECT DISTINCT rss.restaurant_id
        FROM public.restaurant_sentry_state rss
        INNER JOIN public.restaurants r
          ON r.id = rss.restaurant_id
        WHERE rss.account_id = ${accountId}
          AND r.active = true
      `);
      const allowedRestaurantIds = new Set(teamLocationRows.map((row) => row.restaurant_id));

      const scopedRestaurantIds =
        effectiveScope === "selected_locations"
          ? restaurantIds.filter((id) => allowedRestaurantIds.has(id))
          : [];

      if (effectiveScope === "selected_locations" && scopedRestaurantIds.length === 0) {
        throw new Error("missing-location-scope");
      }

      const existingMembership = await tx.$queryRaw<Array<{
        account_id: string;
        id: number;
        status: string;
      }>>(Prisma.sql`
        SELECT id, account_id, status
        FROM public.account_memberships_v2
        WHERE manager_id = ${managerId}
        LIMIT 1
      `);

      let membershipId: number;
      if (
        existingMembership[0] &&
        existingMembership[0].status === "active" &&
        existingMembership[0].account_id !== accountId
      ) {
        throw new Error("member-already-on-other-team");
      }

      if (existingMembership[0]) {
        membershipId = existingMembership[0].id;
        await tx.$executeRaw(Prisma.sql`
          UPDATE public.account_memberships_v2
          SET
            account_id = ${accountId},
            team_role = ${role},
            access_scope = ${effectiveScope},
            status = 'active',
            account_holder = CASE WHEN ${role} = 'Owner' THEN account_holder ELSE false END,
            invited_by = ${session.managerId ?? null},
            invited_at = COALESCE(invited_at, now()),
            accepted_at = COALESCE(accepted_at, now()),
            revoked_at = NULL,
            last_active_at = now(),
            updated_at = now()
          WHERE id = ${membershipId}
        `);
      } else {
        const inserted = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          INSERT INTO public.account_memberships_v2 (
            manager_id,
            account_id,
            team_role,
            access_scope,
            status,
            account_holder,
            invited_by,
            invited_at,
            accepted_at,
            last_active_at,
            created_at,
            updated_at
          )
          VALUES (
            ${managerId},
            ${accountId},
            ${role},
            ${effectiveScope},
            'active',
            false,
            ${session.managerId ?? null},
            now(),
            now(),
            now(),
            now(),
            now()
          )
          RETURNING id
        `);
        membershipId = inserted[0].id;
      }

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.account_member_locations_v2
        WHERE membership_id = ${membershipId}
      `);

      if (effectiveScope === "selected_locations") {
        for (const restaurantId of scopedRestaurantIds) {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO public.account_member_locations_v2 (
              membership_id,
              restaurant_id,
              created_at
            )
            VALUES (
              ${membershipId},
              ${restaurantId},
              now()
            )
          `);
        }
      }

      await writeAuditLog(
        {
          action: "team_member_assigned_superadmin",
          actorUserId: session.managerId ?? null,
          entityId: String(membershipId),
          entityType: "account_memberships_v2",
          ipAddress: requestContext.ipAddress,
          metadata: {
            accessScope: effectiveScope,
            accountId,
            managerId,
            requestId: requestContext.requestId,
            restaurantIds: scopedRestaurantIds,
            role,
          },
          summary: `Assigned manager ${manager.email} to team ${accountId}.`,
          userAgent: requestContext.userAgent,
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "manager-not-found") {
      redirect("/superadmin/teams?member=manager-not-found");
    }
    if (error instanceof Error && error.message === "missing-location-scope") {
      redirect("/superadmin/teams?member=missing-location-scope");
    }
    if (error instanceof Error && error.message === "member-already-on-other-team") {
      redirect("/superadmin/teams?member=member-already-on-other-team");
    }
    redirect("/superadmin/teams?member=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/teams");
  revalidatePath("/superadmin/tables");
  redirect("/superadmin/teams?member=assigned");
}

export async function revokeTeamMemberAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const membershipId = Number(String(formData.get("membership_id") ?? "").trim());

  if (!Number.isFinite(membershipId)) {
    redirect("/superadmin/teams?member=invalid-id");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const membershipRows = await tx.$queryRaw<Array<{
        account_id: string;
        id: number;
        manager_id: number;
        team_role: string;
      }>>(Prisma.sql`
        SELECT id, account_id, manager_id, team_role
        FROM public.account_memberships_v2
        WHERE id = ${membershipId}
        LIMIT 1
      `);

      const membership = membershipRows[0];
      if (!membership) {
        throw new Error("membership-not-found");
      }

      const normalizedRole = normalizeTeamRoleValue(membership.team_role);
      if (normalizedRole === "Owner") {
        const ownerCountRows = await tx.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM public.account_memberships_v2
          WHERE account_id = ${membership.account_id}
            AND status = 'active'
            AND lower(team_role) = 'owner'
        `);
        const ownerCount = Number(ownerCountRows[0]?.count ?? 0);
        if (ownerCount <= 1) {
          throw new Error("last-owner");
        }
      }

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.account_member_locations_v2
        WHERE membership_id = ${membershipId}
      `);

      await tx.$executeRaw(Prisma.sql`
        UPDATE public.account_memberships_v2
        SET
          status = 'revoked',
          account_holder = false,
          revoked_at = now(),
          updated_at = now()
        WHERE id = ${membershipId}
      `);

      await writeAuditLog(
        {
          action: "team_member_revoked_superadmin",
          actorUserId: session.managerId ?? null,
          entityId: String(membershipId),
          entityType: "account_memberships_v2",
          ipAddress: requestContext.ipAddress,
          metadata: {
            accountId: membership.account_id,
            managerId: membership.manager_id,
            requestId: requestContext.requestId,
            role: membership.team_role,
          },
          summary: `Revoked team membership ${membershipId} from ${membership.account_id}.`,
          userAgent: requestContext.userAgent,
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "membership-not-found") {
      redirect("/superadmin/teams?member=invalid-id");
    }
    if (error instanceof Error && error.message === "last-owner") {
      redirect("/superadmin/teams?member=last-owner");
    }
    redirect("/superadmin/teams?member=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/teams");
  revalidatePath("/superadmin/tables");
  redirect("/superadmin/teams?member=revoked");
}

export async function deleteTeamAccountAction(formData: FormData) {
  const session = await requireAdminSession();
  const requestContext = await getRequestContextFromHeaders();

  const accountId = String(formData.get("account_id") ?? "").trim();
  if (!accountId) {
    redirect("/superadmin/teams?team=invalid-account-id");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const [activeLocations, activeMembers, pendingInvites] = await Promise.all([
        tx.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
          SELECT COUNT(DISTINCT rss.restaurant_id)::bigint AS count
          FROM public.restaurant_sentry_state rss
          INNER JOIN public.restaurants r
            ON r.id = rss.restaurant_id
          WHERE rss.account_id = ${accountId}
            AND r.active = true
        `),
        tx.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM public.account_memberships_v2
          WHERE account_id = ${accountId}
            AND status = 'active'
        `),
        tx.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM public.team_invitations_v2
          WHERE account_id = ${accountId}
            AND status = 'pending'
        `),
      ]);

      if (Number(activeLocations[0]?.count ?? 0) > 0) {
        throw new Error("team-has-locations");
      }
      if (Number(activeMembers[0]?.count ?? 0) > 0) {
        throw new Error("team-has-members");
      }
      if (Number(pendingInvites[0]?.count ?? 0) > 0) {
        throw new Error("team-has-invites");
      }

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.team_invitation_locations_v2
        WHERE invitation_id IN (
          SELECT id
          FROM public.team_invitations_v2
          WHERE account_id = ${accountId}
        )
      `);
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.team_invitations_v2
        WHERE account_id = ${accountId}
      `);
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.account_member_locations_v2
        WHERE membership_id IN (
          SELECT id
          FROM public.account_memberships_v2
          WHERE account_id = ${accountId}
        )
      `);
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.account_memberships_v2
        WHERE account_id = ${accountId}
      `);
      await tx.billing_accounts_v2.deleteMany({
        where: {
          account_id: accountId,
        },
      });
      await tx.customers.deleteMany({
        where: {
          account_id: accountId,
        },
      });

      await writeAuditLog(
        {
          action: "team_account_deleted_superadmin",
          actorUserId: session.managerId ?? null,
          entityId: accountId,
          entityType: "customer_accounts_v2",
          ipAddress: requestContext.ipAddress,
          metadata: {
            requestId: requestContext.requestId,
          },
          summary: `Deleted team account ${accountId}.`,
          userAgent: requestContext.userAgent,
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "team-has-locations") {
      redirect("/superadmin/teams?team=has-locations");
    }
    if (error instanceof Error && error.message === "team-has-members") {
      redirect("/superadmin/teams?team=has-members");
    }
    if (error instanceof Error && error.message === "team-has-invites") {
      redirect("/superadmin/teams?team=has-invites");
    }
    redirect("/superadmin/teams?team=server-error");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/teams");
  revalidatePath("/superadmin/tables");
  redirect("/superadmin/teams?team=deleted");
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
