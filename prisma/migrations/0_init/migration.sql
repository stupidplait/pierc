-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BodyPlace" AS ENUM ('EAR', 'NOSE', 'LIPS', 'EYEBROW', 'TONGUE', 'NIPPLE', 'NAVEL', 'HIP', 'ANKLE');

-- CreateEnum
CREATE TYPE "AnchorSide" AS ENUM ('L', 'R', 'CENTER');

-- CreateEnum
CREATE TYPE "JewelryStatus" AS ENUM ('DRAFT', 'PROCESSING', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "JewelryType" AS ENUM ('STUD', 'RING', 'BARBELL', 'CIRCULAR_BARBELL', 'ORBITAL', 'CHAIN_LADDER');

-- CreateEnum
CREATE TYPE "GenerationJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "JewelryBookingStatus" AS ENUM ('RESERVED', 'CONFIRMED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "telegram" TEXT,
    "telegramChatId" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnchorPoint" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "place" "BodyPlace" NOT NULL,
    "side" "AnchorSide" NOT NULL DEFAULT 'CENTER',
    "position" JSONB NOT NULL,
    "rotation" JSONB NOT NULL,
    "cameraPresets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnchorPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JewelryCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JewelryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jewelry" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "type" "JewelryType" NOT NULL DEFAULT 'STUD',
    "material" TEXT NOT NULL,
    "gauge" DOUBLE PRECISION,
    "size" DOUBLE PRECISION,
    "color" TEXT,
    "stones" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "inStock" INTEGER NOT NULL DEFAULT 0,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "glbUrl" TEXT,
    "glbScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "glbThumbUrl" TEXT,
    "spriteUrl" TEXT,
    "status" "JewelryStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jewelry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JewelryAnchorBinding" (
    "id" TEXT NOT NULL,
    "jewelryId" TEXT NOT NULL,
    "anchorId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JewelryAnchorBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "jewelryId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerJobId" TEXT,
    "status" "GenerationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "inputPhotos" JSONB NOT NULL DEFAULT '[]',
    "resultGlbUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotId" TEXT,
    "serviceId" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JewelryBooking" (
    "id" TEXT NOT NULL,
    "jewelryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "JewelryBookingStatus" NOT NULL DEFAULT 'RESERVED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JewelryBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAQItem" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FAQItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryPhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "text" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "moderatorNotes" TEXT,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactAddress" TEXT,
    "instagramUrl" TEXT,
    "telegramUrl" TEXT,
    "telegramChatId" TEXT,
    "workingHoursHint" TEXT,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_JewelryReviews" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_JewelryReviews_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AnchorPoint_slug_key" ON "AnchorPoint"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "JewelryCategory_slug_key" ON "JewelryCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Jewelry_slug_key" ON "Jewelry"("slug");

-- CreateIndex
CREATE INDEX "Jewelry_status_idx" ON "Jewelry"("status");

-- CreateIndex
CREATE INDEX "Jewelry_categoryId_idx" ON "Jewelry"("categoryId");

-- CreateIndex
CREATE INDEX "Jewelry_featured_idx" ON "Jewelry"("featured");

-- CreateIndex
CREATE INDEX "Jewelry_type_idx" ON "Jewelry"("type");

-- CreateIndex
CREATE INDEX "JewelryAnchorBinding_jewelryId_idx" ON "JewelryAnchorBinding"("jewelryId");

-- CreateIndex
CREATE INDEX "JewelryAnchorBinding_anchorId_idx" ON "JewelryAnchorBinding"("anchorId");

-- CreateIndex
CREATE UNIQUE INDEX "JewelryAnchorBinding_jewelryId_anchorId_order_key" ON "JewelryAnchorBinding"("jewelryId", "anchorId", "order");

-- CreateIndex
CREATE INDEX "GenerationJob_jewelryId_idx" ON "GenerationJob"("jewelryId");

-- CreateIndex
CREATE INDEX "GenerationJob_status_idx" ON "GenerationJob"("status");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_startsAt_endsAt_idx" ON "AvailabilitySlot"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_isOpen_idx" ON "AvailabilitySlot"("isOpen");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_slotId_key" ON "Appointment"("slotId");

-- CreateIndex
CREATE INDEX "Appointment_userId_idx" ON "Appointment"("userId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_slotId_idx" ON "Appointment"("slotId");

-- CreateIndex
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");

-- CreateIndex
CREATE INDEX "JewelryBooking_jewelryId_idx" ON "JewelryBooking"("jewelryId");

-- CreateIndex
CREATE INDEX "JewelryBooking_userId_idx" ON "JewelryBooking"("userId");

-- CreateIndex
CREATE INDEX "JewelryBooking_appointmentId_idx" ON "JewelryBooking"("appointmentId");

-- CreateIndex
CREATE INDEX "JewelryBooking_status_idx" ON "JewelryBooking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SiteContent_key_key" ON "SiteContent"("key");

-- CreateIndex
CREATE INDEX "Service_published_order_idx" ON "Service"("published", "order");

-- CreateIndex
CREATE INDEX "GalleryPhoto_published_order_idx" ON "GalleryPhoto"("published", "order");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Review_featured_idx" ON "Review"("featured");

-- CreateIndex
CREATE UNIQUE INDEX "Review_appointmentId_key" ON "Review"("appointmentId");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- CreateIndex
CREATE INDEX "_JewelryReviews_B_index" ON "_JewelryReviews"("B");

-- AddForeignKey
ALTER TABLE "Jewelry" ADD CONSTRAINT "Jewelry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "JewelryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelryAnchorBinding" ADD CONSTRAINT "JewelryAnchorBinding_jewelryId_fkey" FOREIGN KEY ("jewelryId") REFERENCES "Jewelry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelryAnchorBinding" ADD CONSTRAINT "JewelryAnchorBinding_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "AnchorPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_jewelryId_fkey" FOREIGN KEY ("jewelryId") REFERENCES "Jewelry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AvailabilitySlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelryBooking" ADD CONSTRAINT "JewelryBooking_jewelryId_fkey" FOREIGN KEY ("jewelryId") REFERENCES "Jewelry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelryBooking" ADD CONSTRAINT "JewelryBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelryBooking" ADD CONSTRAINT "JewelryBooking_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JewelryReviews" ADD CONSTRAINT "_JewelryReviews_A_fkey" FOREIGN KEY ("A") REFERENCES "Jewelry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JewelryReviews" ADD CONSTRAINT "_JewelryReviews_B_fkey" FOREIGN KEY ("B") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Slot overlap guard (out-of-band: Prisma cannot express EXCLUDE constraints in
-- schema.prisma). Included in the baseline so a fresh `migrate deploy` reproduces
-- the FULL production schema, including this constraint. Uses core range-type GiST
-- (no btree_gist extension needed for a single range column).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "AvailabilitySlot"
  DROP CONSTRAINT IF EXISTS "availabilityslot_no_overlap";
ALTER TABLE "AvailabilitySlot"
  ADD CONSTRAINT "availabilityslot_no_overlap"
  EXCLUDE USING gist (tsrange("startsAt", "endsAt") WITH &&);
