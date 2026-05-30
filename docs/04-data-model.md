# 04 — Data Model

## Model groups

The schema is organized into six logical groups:

1. **Auth** — `User` (booking customer, optional account / guest) and `AdminUser` (studio owner login).
2. **3D anchors & body** — `BodyPlace` and `AnchorSide` enums, `AnchorPoint` (positions on the generic body model where jewelry can be placed; categorized by anatomical place with a left/right/center side).
3. **Catalog** — `JewelryStatus` enum, `JewelryCategory`, `Jewelry`.
4. **Auto-3D pipeline** — `GenerationStatus` enum, `GenerationJob`.
5. **Scheduling & bookings** — `AvailabilitySlot`, `AppointmentStatus` enum, `Appointment`, `BookingStatus` enum, `JewelryBooking`.
6. **CMS** — `SiteContent`, `FAQItem`, `Service`, `GalleryPhoto`, `Settings` (singleton).

### Relationship highlights

- A `Jewelry` is many-to-many with `AnchorPoint` (a barbell may fit several positions).
- An `Appointment` is 1-to-1 with `AvailabilitySlot` (a slot is either free or taken).
- An `Appointment` may have **0 to many** `JewelryBooking` rows attached — supporting the multi-piece try-on / booking flow where the user fits and books several jewelries in one appointment.
- `User.email` is unique. Guest bookings create a `User(isGuest=true, passwordHash=null)`. If that email later signs up for a real account, we **upsert by email** and flip `isGuest=false`, preserving booking history.
- `Settings` is a singleton row (`id = "default"`) so the admin panel always reads/writes the same record.

### Parametric jewelry seed

The catalog is populated from two committed JSON files plus a Blender-driven build step:

- `prisma/seed-data/jewelry.json` — the **manifest** (source of truth). One entry per piece with `slug`, `name`, `categorySlug`, `shape`, per-shape `params`, material/color, anchor list, price, stock.
- `prisma/seed-data/jewelry-uploads.json` — the **upload map** (slug → `{ blobUrl, hash, size, uploadedAt, thumbUrl? }`). Produced by `npm run jewelry:upload` after Blender exports `.glb` files into the gitignored `art/jewelry-out/` directory.

`prisma/seed.ts` upserts `Jewelry` rows by `slug`, joining the manifest with the upload map: pieces with a `blobUrl` land as `PUBLISHED`, pieces still missing one stay `DRAFT`. See [`14-jewelry-pipeline.md`](./14-jewelry-pipeline.md) for the full Blender → Blob → DB flow.

## Prisma schema

```prisma
// ───── Auth ─────
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  phone        String?
  name         String
  passwordHash String?            // null for guest
  isGuest      Boolean  @default(true)
  createdAt    DateTime @default(now())
  bookings     JewelryBooking[]
  appointments Appointment[]
}

model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         String   @default("admin")
  createdAt    DateTime @default(now())
}

// ───── 3D anchors & body ─────
enum BodyPlace {
  EAR        // мочка, хеликс, козелок, конха, дейс, рук, индастриал
  NOSE       // ноздри, септум
  LIPS       // медуза, лабрет
  EYEBROW    // бровь
  TONGUE     // язык
  NIPPLE     // сосок
  NAVEL      // пупок
  HIP        // бедро
  ANKLE      // лодыжка
}

enum AnchorSide { L R CENTER }

model AnchorPoint {
  id              String                 @id @default(cuid())
  slug            String                 @unique           // "left-ear-lobe"
  name            String                                   // "Левая мочка"
  place           BodyPlace
  side            AnchorSide             @default(CENTER)
  position        Json                                     // { x, y, z } in body.glb local space (Y-up)
  rotation        Json                                     // { x, y, z } default jewelry orientation (Euler XYZ rad)
  cameraPresets   Json                                     // [{ name, position, target, fov }, ...]
  jewelryBindings JewelryAnchorBinding[]                   // explicit junction (Phase B); see docs/20-multi-anchor-jewelry.md
}

// ───── Catalog ─────
enum JewelryStatus { DRAFT PROCESSING PENDING_REVIEW PUBLISHED REJECTED }

// Drives renderer math + admin form constraints. See
// docs/20-multi-anchor-jewelry.md for the full mapping.
//
//   STUD              — 1 attach point per equip, semantics="compat-list"
//   RING              — 1 attach point per equip, semantics="compat-list"
//   BARBELL           — 2 attach points equipped together (industrial bar, surface bar)
//   CIRCULAR_BARBELL  — 2 attach points (horseshoe through 2 holes)
//   ORBITAL           — 2 attach points (closed ring through 2 holes)
//   CHAIN_LADDER      — N attach points (corset)
enum JewelryType { STUD RING BARBELL CIRCULAR_BARBELL ORBITAL CHAIN_LADDER }

model JewelryCategory {
  id        String    @id @default(cuid())
  slug      String    @unique
  name      String
  jewelries Jewelry[]
}

model Jewelry {
  id             String                 @id @default(cuid())
  slug           String?                @unique     // stable seed-pipeline key (kebab-case); nullable for admin-created pieces
  name           String
  description    String?
  category       JewelryCategory        @relation(fields: [categoryId], references: [id])
  categoryId     String
  type           JewelryType            @default(STUD)  // Phase B: drives 1-anchor vs N-anchor renderer math
  material       String                                 // "Титан G23", "Золото 585", ...
  gauge          Float?                                 // mm
  size           Float?                                 // mm
  color          String?
  stones         String?                                // "Циркон", "Опал", "Без камней"
  price          Decimal
  inStock        Int                    @default(0)
  photos         Json                                   // [{ url, alt }]
  glbUrl         String?
  glbScale       Float                  @default(1)     // EquippedPieces render multiplier; 1 for parametric Blender (real meters), 0.025 for Tripo3D
  glbThumbUrl    String?
  status         JewelryStatus          @default(DRAFT)
  featured       Boolean                @default(false) // landing 6
  // Phase B: explicit junction replacing the old implicit `_JewelryAnchors`
  // M2M. For STUD/RING (semantics="compat-list") each row is an alternative
  // anchor; for multi-anchor types (semantics="fixed") all rows are equipped
  // together with `order` distinguishing primary (0) / secondary (1) / etc.
  anchorBindings JewelryAnchorBinding[]
  jobs           GenerationJob[]
  bookings       JewelryBooking[]
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt
}

// Phase B junction. See docs/20-multi-anchor-jewelry.md for the full
// rationale and renderer integration.
model JewelryAnchorBinding {
  id        String      @id @default(cuid())
  jewelry   Jewelry     @relation(fields: [jewelryId], references: [id], onDelete: Cascade)
  jewelryId String
  anchor    AnchorPoint @relation(fields: [anchorId], references: [id])
  anchorId  String
  order     Int         @default(0)  // 0 = mesh's `attach:primary`, 1 = `attach:secondary`, ...
  createdAt DateTime    @default(now())

  @@unique([jewelryId, anchorId, order])
}

// ───── Auto-3D pipeline ─────
enum GenerationStatus { QUEUED PROCESSING SUCCEEDED FAILED MANUAL }

model GenerationJob {
  id            String           @id @default(cuid())
  jewelry       Jewelry          @relation(fields: [jewelryId], references: [id], onDelete: Cascade)
  jewelryId     String
  provider      String                          // "tripo3d" | "manual"
  inputPhotos   Json
  outputGlb     String?
  status        GenerationStatus @default(QUEUED)
  providerJobId String?
  error         String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}

// ───── Scheduling & bookings ─────
model AvailabilitySlot {
  id          String       @id @default(cuid())
  startsAt    DateTime
  endsAt      DateTime
  isOpen      Boolean      @default(true)
  appointment Appointment?
  createdAt   DateTime     @default(now())
}

enum AppointmentStatus { PENDING CONFIRMED COMPLETED CANCELLED NO_SHOW }

model Appointment {
  id        String            @id @default(cuid())
  user      User              @relation(fields: [userId], references: [id])
  userId    String
  slot      AvailabilitySlot  @relation(fields: [slotId], references: [id])
  slotId    String            @unique
  notes     String?
  status    AppointmentStatus @default(PENDING)
  bookings  JewelryBooking[]                  // 0..N jewelries attached to this appointment
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
}

enum BookingStatus { RESERVED CONFIRMED CANCELLED FULFILLED }

model JewelryBooking {
  id            String        @id @default(cuid())
  user          User          @relation(fields: [userId], references: [id])
  userId        String
  jewelry       Jewelry       @relation(fields: [jewelryId], references: [id])
  jewelryId     String
  quantity      Int           @default(1)
  status        BookingStatus @default(RESERVED)
  appointment   Appointment?  @relation(fields: [appointmentId], references: [id])
  appointmentId String?                              // not unique — multiple bookings may share one appointment
  notes         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

// ───── CMS ─────
model SiteContent {                       // About, Hero, Footer, etc.
  id        String   @id @default(cuid())
  key       String   @unique
  content   Json
  updatedAt DateTime @updatedAt
}

model FAQItem {
  id        String  @id @default(cuid())
  question  String
  answer    String
  order     Int     @default(0)
  published Boolean @default(true)
}

model Service {
  id          String  @id @default(cuid())
  name        String
  description String?
  price       Decimal
  durationMin Int
  order       Int     @default(0)
  published   Boolean @default(true)
}

model GalleryPhoto {
  id        String   @id @default(cuid())
  url       String
  caption   String?
  order     Int      @default(0)
  published Boolean  @default(true)
  createdAt DateTime @default(now())
}

model Settings {                          // singleton (id = "default")
  id              String  @id @default("default")
  contactEmail    String?
  contactPhone    String?
  contactAddress  String?
  instagramUrl    String?
  telegramChatId  String?                 // admin's TG chat id for alerts
  workingHoursHint String?                // "Вт–Сб 11:00–19:00"
}
```

## JSON shape notes

These columns are typed as `Json` in Prisma; the runtime shapes are:

### `Jewelry.photos`

```ts
Array<{
  url: string;       // Vercel Blob URL
  alt: string;       // RU alt text
}>
```

### `AnchorPoint.position` and `AnchorPoint.rotation`

```ts
{ x: number; y: number; z: number }
```

`position` is in the body model's local coordinate space. `rotation` is in radians (Euler XYZ) and represents the default orientation jewelry should take when placed at this anchor.

### `AnchorPoint.cameraPresets`

```ts
Array<{
  name: string;                                  // e.g., "Спереди", "Профиль", "3/4"
  position: { x: number; y: number; z: number }; // camera world position
  target:   { x: number; y: number; z: number }; // look-at point
  fov: number;                                   // degrees
}>
```

### `GenerationJob.inputPhotos`

```ts
Array<{
  url: string;       // Vercel Blob URL
  filename: string;
}>
```

## Guest → real-account migration

When a user later signs up at `/auth/sign-up` with an email that already exists from a guest booking:

1. Look up `User` by email.
2. If found and `isGuest=true`:
   - Set `passwordHash` from the form.
   - Set `isGuest=false`.
   - Keep `id`; all `JewelryBooking`/`Appointment` rows remain linked.
3. If found and `isGuest=false`: reject sign-up (account already exists, suggest sign-in).
4. If not found: create a new `User` with `isGuest=false`.

This preserves booking history seamlessly across the guest-to-account boundary.
