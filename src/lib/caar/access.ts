import type { SessionState } from "@/components/sentry/types";
import prisma from "@/lib/prisma";

function getScopedRestaurantWhere(session: SessionState) {
  return session.role === "WGS Manager" || session.role === "SuperAdmin"
    ? {}
    : typeof session.managerId === "number"
      ? { created_by: session.managerId }
      : { id: -1 };
}

export async function getScopedPersistedCaar(session: SessionState, caarExternalId: string) {
  const report = await prisma.caar_reports.findFirst({
    where: {
      caar_id: caarExternalId,
      ...(session.role === "WGS Manager" || session.role === "SuperAdmin"
        ? {}
        : typeof session.managerId === "number"
          ? { created_by: session.managerId }
          : { id: -1 }),
    },
    select: {
      location_id: true,
      restaurant_id: true,
    },
  });

  if (!report) {
    return null;
  }

  const restaurant =
    typeof report.restaurant_id === "number"
      ? await prisma.restaurants.findFirst({
          where: {
            id: report.restaurant_id,
            ...getScopedRestaurantWhere(session),
          },
          select: {
            id: true,
          },
        })
      : null;

  if (report.restaurant_id && !restaurant) {
    return null;
  }

  const location = await prisma.locations_v2.findFirst({
    where: {
      deleted_at: null,
      external_id: report.location_id,
    },
    select: {
      customer_id: true,
      external_id: true,
      id: true,
      name: true,
    },
  });

  if (!location) {
    return null;
  }

  const caar = await prisma.caars_v2.findFirst({
    where: {
      caar_external_id: caarExternalId,
      location_id: location.id,
    },
    select: {
      canonical_payload_s3_key: true,
      caar_external_id: true,
      cert_run_id: true,
      court_admissible: true,
      exportpack_s3_key: true,
      id: true,
      location_id: true,
      module: true,
      pdf_s3_key: true,
      period: true,
      status: true,
      trust_score: true,
    },
  });

  if (!caar) {
    return null;
  }

  return {
    caar,
    location,
  };
}
