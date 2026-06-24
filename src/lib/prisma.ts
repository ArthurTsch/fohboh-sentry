import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../app/generated/prisma/client";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;
const directPoolConfig =
  process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME
    ? {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
    : null;

if (!connectionString && !directPoolConfig) {
  throw new Error("Database connection variables are not set.");
}

const pool = new Pool({
  ...(directPoolConfig ?? { connectionString }),
  ssl:
    process.env.DB_SSLMODE === "disable" || process.env.PGSSLMODE === "disable"
      ? false
      : {
          rejectUnauthorized: false,
        },
});

const adapter = new PrismaPg(pool);

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
