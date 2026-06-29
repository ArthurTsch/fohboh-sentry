"use server";

import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import {
  authenticateManager,
} from "@/lib/auth/manager-auth";
import {
  createSessionCookieValue,
  getSessionCookieOptions,
  MANAGER_SESSION_COOKIE_NAME,
  requireAdminManagerSession,
} from "@/lib/auth/session";

async function requireAdminSession() {
  try {
    await requireAdminManagerSession();
  } catch {
    redirect("/admin");
  }
}

export async function loginAdminAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const result = await authenticateManager(email, password);

  if (!result.ok) {
    redirect("/admin?error=invalid-credentials");
  }

  if (result.session.role !== "Admin") {
    redirect("/admin?error=not-admin");
  }

  const cookieStore = await cookies();
  cookieStore.set(
    MANAGER_SESSION_COOKIE_NAME,
    createSessionCookieValue(result.session),
    getSessionCookieOptions(),
  );

  redirect("/admin");
}

export async function logoutAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete(MANAGER_SESSION_COOKIE_NAME);
  redirect("/admin");
}

export async function createManagerAction(formData: FormData) {
  await requireAdminSession();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneNumber = String(formData.get("phone_number") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const role = String(formData.get("role") ?? "Manager").trim();
  const active = formData.get("active") === "on";
  const emailVerified = formData.get("email_verified") === "on";

  if (!email || !password || !role) {
    redirect("/admin?create=missing-fields");
  }

  const passwordHash = await hash(password, 12);

  try {
    await prisma.managers.create({
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
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      redirect("/admin/managers?create=duplicate-email");
    }

    redirect("/admin/managers?create=server-error");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/managers");
  redirect("/admin/managers?create=success");
}

export async function updateManagerAction(formData: FormData) {
  await requireAdminSession();

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
    redirect("/admin/managers?update=missing-fields");
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
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      redirect("/admin/managers?update=duplicate-email");
    }

    redirect("/admin/managers?update=server-error");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/managers");
  redirect("/admin/managers?update=success");
}

export async function deleteManagerAction(formData: FormData) {
  await requireAdminSession();

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) {
    redirect("/admin/managers?delete=invalid-id");
  }

  try {
    await prisma.managers.delete({
      where: { id },
    });
  } catch {
    redirect("/admin/managers?delete=server-error");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/managers");
  redirect("/admin/managers?delete=success");
}

export async function createRestaurantAction(formData: FormData) {
  await requireAdminSession();

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
    redirect("/admin/restaurants?restaurant=missing-name");
  }

  try {
    await prisma.restaurants.create({
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
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      redirect("/admin/restaurants?restaurant=duplicate-unit");
    }

    redirect("/admin/restaurants?restaurant=server-error");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/restaurants");
  redirect("/admin/restaurants?restaurant=success");
}

export async function updateRestaurantAction(formData: FormData) {
  await requireAdminSession();

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
    redirect("/admin/restaurants?restaurant=missing-name");
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
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      redirect("/admin/restaurants?restaurant=duplicate-unit");
    }

    redirect("/admin/restaurants?restaurant=server-error");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/restaurants");
  redirect("/admin/restaurants?restaurant=updated");
}

export async function deleteRestaurantAction(formData: FormData) {
  await requireAdminSession();

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) {
    redirect("/admin/restaurants?restaurant=invalid-id");
  }

  try {
    await prisma.restaurants.delete({
      where: { id },
    });
  } catch {
    redirect("/admin/restaurants?restaurant=server-error");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/restaurants");
  redirect("/admin/restaurants?restaurant=deleted");
}

export async function deleteCaarReportAction(formData: FormData) {
  await requireAdminSession();

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) {
    redirect("/admin/management?caar=invalid-id");
  }

  try {
    await prisma.caar_reports.delete({
      where: { id },
    });
  } catch {
    redirect("/admin/management?caar=server-error");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/management");
  redirect("/admin/management?caar=deleted");
}
