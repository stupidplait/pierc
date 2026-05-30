import { Prisma, PrismaClient } from "@prisma/client";

// Singleton pattern to avoid creating a new PrismaClient per hot-reload in dev,
// which would otherwise exhaust Neon's connection pool.
// See https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Retry on `P1001 — Can't reach database server`. Neon's free tier
 * auto-suspends compute after ~5 minutes of inactivity; the first
 * connection wakes it but takes 1–5 s, during which queries fail with
 * P1001. We swallow up to three attempts (1 s + 2 s + 4 s = 7 s of
 * patience) so the wake-up is invisible to callers.
 *
 * This applies to every model + every operation.
 */
function isColdStart(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return e.errorCode === "P1001";
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P1001";
  }
  return false;
}

function createPrismaClient() {
  const base = new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base.$extends({
    name: "neon-cold-start-retry",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const delays = [1000, 2000, 4000];
          let lastErr: unknown;
          for (let i = 0; i <= delays.length; i++) {
            try {
              return await query(args);
            } catch (e) {
              lastErr = e;
              if (!isColdStart(e) || i === delays.length) throw e;
              if (process.env.NODE_ENV !== "production") {
                console.warn(
                  `[prisma] Neon cold-start (P1001), retrying in ${delays[i]}ms (attempt ${i + 1}/${delays.length})`,
                );
              }
              await sleep(delays[i]);
            }
          }
          throw lastErr;
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma: ExtendedPrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
