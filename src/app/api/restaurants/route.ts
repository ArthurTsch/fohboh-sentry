import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const managerIdRaw = searchParams.get("managerId")?.trim() ?? "";
    const managerId =
      managerIdRaw.length > 0 && /^-?\d+$/.test(managerIdRaw)
        ? Number(managerIdRaw)
        : Number.NaN;
    const email = searchParams.get("email")?.trim() ?? "";
    const role = searchParams.get("role")?.trim().toLowerCase() ?? "";
    const resolvedManager =
      !Number.isFinite(managerId) && email
        ? await prisma.managers.findFirst({
            where: {
              email: {
                equals: email,
                mode: "insensitive",
              },
            },
            select: {
              id: true,
            },
          })
        : null;
    const effectiveManagerId = Number.isFinite(managerId)
      ? managerId
      : (resolvedManager?.id ?? NaN);

    const restaurants = await prisma.restaurants.findMany({
      where: {
        active: true,
        ...(role === "wgs manager"
          ? {}
          : Number.isFinite(effectiveManagerId)
            ? { created_by: effectiveManagerId }
            : { id: -1 }),
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        city: true,
        country: true,
        created_by: true,
        id: true,
        location: true,
        name: true,
        state: true,
        store_id: true,
        unit_id: true,
      },
    });

    return NextResponse.json({ restaurants });
  } catch (error) {
    console.error("Fetch restaurants failed:", error);
    return NextResponse.json(
      { error: "Unable to load restaurants right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      accountId?: string | null;
      address?: string;
      creatorEmail?: string;
      locationName?: string;
      managerId?: number | null;
      unitId?: string;
    };

    const locationName = body.locationName?.trim() ?? "";
    if (!locationName) {
      return NextResponse.json({ error: "Location name is required." }, { status: 400 });
    }

    const unitId = body.unitId?.trim() || null;
    const creatorEmail = body.creatorEmail?.trim() ?? "";
    const creator =
      creatorEmail.length > 0
        ? await prisma.managers.findFirst({
            where: {
              email: {
                equals: creatorEmail,
                mode: "insensitive",
              },
            },
            select: {
              id: true,
            },
          })
        : null;

    const restaurant = await prisma.restaurants.create({
      data: {
        active: true,
        created_by:
          creator?.id ??
          (typeof body.managerId === "number" ? body.managerId : null),
        location: body.address?.trim() || null,
        name: locationName,
        store_id: unitId,
        unit_id: unitId,
      },
      select: {
        id: true,
        location: true,
        name: true,
        unit_id: true,
      },
    });

    return NextResponse.json({
      restaurant: {
        accountId: body.accountId ?? null,
        address: restaurant.location,
        id: restaurant.id,
        name: restaurant.name,
        unitId: restaurant.unit_id,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A restaurant with that internal location ID already exists." },
        { status: 409 },
      );
    }

    console.error("Create restaurant failed:", error);
    return NextResponse.json(
      { error: "Unable to create restaurant right now." },
      { status: 500 },
    );
  }
}
