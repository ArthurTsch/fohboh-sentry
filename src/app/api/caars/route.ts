import { NextResponse } from "next/server";
import { requireManagerSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import type { CaarRecord } from "@/components/sentry/types";

function parseCurrencyToCents(value: string) {
  const numeric = Number(value.replace(/[^0-9.-]/g, "")) || 0;
  return Math.round(numeric * 100);
}

function formatCentsToCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

function isCaarDimensionArray(value: unknown): value is CaarRecord["dimensions"] {
  return Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function getAuthErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === "Unauthorized") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await request;
    const session = await requireManagerSession();

    const reports = await prisma.caar_reports.findMany({
      where: {
        ...(session.role === "WGS Manager"
          ? {}
          : typeof session.managerId === "number"
            ? { created_by: session.managerId }
            : { id: -1 }),
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        account_id: true,
        amount_cents: true,
        amount_display: true,
        caar_id: true,
        created_at: true,
        created_by: true,
        dimensions: true,
        exhibits: true,
        findings: true,
        location_id: true,
        location_name: true,
        narrative: true,
        period: true,
        restaurant_id: true,
        status: true,
        trust_score: true,
      },
    });

    return NextResponse.json({
      reports: reports.map((report) => ({
        accountId: report.account_id,
        amount: report.amount_display || formatCentsToCurrency(report.amount_cents),
        createdAt: report.created_at?.toISOString() ?? null,
        createdBy: report.created_by,
        dimensions: isCaarDimensionArray(report.dimensions) ? report.dimensions : [],
        exhibits: report.exhibits ?? 0,
        findings: isStringArray(report.findings) ? report.findings : [],
        id: report.caar_id,
        locationId: report.location_id,
        locationName: report.location_name,
        narrative: report.narrative,
        period: report.period,
        restaurantId: report.restaurant_id,
        status: report.status as CaarRecord["status"],
        trustScore: report.trust_score,
      })),
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    console.error("Fetch CAAR reports failed:", error);
    return NextResponse.json(
      { error: "Unable to load CAAR reports right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return NextResponse.json({ error: "This account cannot save CAAR reports." }, { status: 403 });
    }

    const body = (await request.json()) as {
      accountId?: string | null;
      managerId?: number | null;
      record?: CaarRecord | null;
    };

    if (!body.record) {
      return NextResponse.json({ error: "CAAR record is required." }, { status: 400 });
    }

    const record = body.record;
    const restaurant =
      record.locationId.startsWith("LOC-DB-")
        ? await prisma.restaurants.findFirst({
            where: {
              id: Number(record.locationId.replace("LOC-DB-", "")) || -1,
            },
            select: {
              created_by: true,
              id: true,
            },
          })
        : await prisma.restaurants.findFirst({
            where: {
              OR: [
                { unit_id: record.locationId },
                { store_id: record.locationId },
              ],
            },
            select: {
              created_by: true,
              id: true,
            },
          });

    const saved = await prisma.caar_reports.upsert({
      where: {
        caar_id: record.id,
      },
      update: {
        account_id:
          session.role === "WGS Manager"
            ? body.accountId ?? record.accountId ?? null
            : session.accountId ?? body.accountId ?? record.accountId ?? null,
        amount_cents: parseCurrencyToCents(record.amount),
        amount_display: record.amount,
        created_by: typeof session.managerId === "number" ? session.managerId : (restaurant?.created_by ?? null),
        dimensions: record.dimensions,
        exhibits: record.exhibits,
        findings: record.findings,
        location_id: record.locationId,
        location_name: record.locationName,
        narrative: record.narrative,
        period: record.period,
        restaurant_id: restaurant?.id ?? null,
        status: record.status,
        trust_score: record.trustScore,
        updated_at: new Date(),
      },
      create: {
        account_id:
          session.role === "WGS Manager"
            ? body.accountId ?? record.accountId ?? null
            : session.accountId ?? body.accountId ?? record.accountId ?? null,
        amount_cents: parseCurrencyToCents(record.amount),
        amount_display: record.amount,
        caar_id: record.id,
        created_by: typeof session.managerId === "number" ? session.managerId : (restaurant?.created_by ?? null),
        dimensions: record.dimensions,
        exhibits: record.exhibits,
        findings: record.findings,
        location_id: record.locationId,
        location_name: record.locationName,
        narrative: record.narrative,
        period: record.period,
        restaurant_id: restaurant?.id ?? null,
        status: record.status,
        trust_score: record.trustScore,
      },
      select: {
        caar_id: true,
        id: true,
      },
    });

    return NextResponse.json({
      ok: true,
      report: saved,
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    console.error("Save CAAR report failed:", error);
    return NextResponse.json(
      { error: "Unable to save the CAAR report right now." },
      { status: 500 },
    );
  }
}
