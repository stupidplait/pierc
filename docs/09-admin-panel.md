# 09 — Admin Panel

## Layout

The admin panel lives at `/admin/*`. It has its own layout with:
- A persistent sidebar (left).
- A main content area.
- A small header with the admin's name and a `Выход` (logout) button.

All routes under `/admin/*` (except `/admin/login`) are protected by middleware that redirects unauthenticated visitors to `/admin/login`.

## Sidebar sections

| Section | Path | Purpose |
|---|---|---|
| `Главная` | `/admin` | Dashboard with at-a-glance counts |
| `Каталог` | `/admin/jewelry` | Manage jewelry items + 3D pipeline |
| `Слоты` | `/admin/slots` | Manage availability slots |
| `Бронирования` | `/admin/bookings` | Manage jewelry reservations |
| `Записи` | `/admin/appointments` | Manage appointments |
| `Контент` | `/admin/content` | Edit About / Services / FAQ / Gallery |
| `Настройки` | `/admin/settings` | Studio info + integrations |

## `Главная` (`/admin`)

Read-only overview cards:
- Pending bookings count (`JewelryBooking.status = RESERVED`).
- Today's appointments count (`Appointment.status = CONFIRMED` and slot date = today).
- Jewelry awaiting review (`Jewelry.status = PENDING_REVIEW`).
- Low-stock items (`Jewelry.inStock <= 1`).

Each card is clickable and deep-links into the relevant filtered list.

## `Каталог` (`/admin/jewelry`)

**List view:** filters by category, status, featured; search by name; columns include name, category, status, in-stock, featured, last update.

**Detail / edit view:**
- Metadata form: name, description, category, material, gauge, size, color, stones, price, in-stock count, featured toggle, supported anchors (multi-select).
- Photo manager: upload to Vercel Blob, reorder, delete.
- 3D actions:
  - `Сгенерировать 3D` — starts an auto-3D job (uses the photos uploaded above).
  - `Перегенерировать` — discards the previous attempt and runs a new one.
  - `Утвердить` — appears when status is `PENDING_REVIEW`; sets `PUBLISHED`.
  - `Отклонить` — sets `REJECTED`.
  - `Загрузить .glb вручную` — file picker that bypasses the pipeline.
- Quick stock adjustment: `+1` / `-1` buttons next to `inStock`.
- Delete button (with confirmation) — disallowed if jewelry has any non-cancelled bookings.

## `Слоты` (`/admin/slots`)

- Default view: week calendar with each day's slots.
- Toggle to flat list view.
- Operations:
  - Single create: pick date + start + end + `isOpen` toggle.
  - Bulk create: pick date range, days of week, start, end, slot length (minutes), and the system generates the slots.
  - Edit existing slot (start/end/isOpen).
  - Delete slot — only if no `Appointment` is attached.
  - Toggle `isOpen` to temporarily hide a slot from the public picker without deleting.

## `Бронирования` (`/admin/bookings`)

- Filters: status, date range, search by user email/phone.
- Detail view shows: user info, jewelry, quantity, linked appointment (if any), notes, full status timeline.
- Status transitions: `Подтвердить` (RESERVED → CONFIRMED), `Отметить выполненным` (CONFIRMED → FULFILLED), `Отменить` (→ CANCELLED), with an optional `Уведомить пользователя` checkbox that re-triggers the email/Telegram notification.
- Free-text admin notes field saved on the booking.

## `Записи` (`/admin/appointments`)

- Same UX as bookings list, with:
  - Linked jewelries shown as a list when present (an appointment may have many linked `JewelryBooking` rows from a multi-piece booking flow).
  - Status transitions: `Подтвердить`, `Завершить`, `Не явился`, `Отменить`.
  - Bulk action: `Подтвердить с украшениями` confirms the appointment and all linked bookings in one click.
  - Calendar view alternative: month / week.
- Marking an appointment `COMPLETED` auto-transitions every linked `JewelryBooking` to `FULFILLED`.

## `Контент` (`/admin/content`)

Tabs for each content area:

| Tab | Model | Operations |
|---|---|---|
| `О нас` | `SiteContent(key="about")` | Edit rich-text-light body |
| `Услуги` | `Service` | CRUD + reorder + toggle published |
| `FAQ` | `FAQItem` | CRUD + reorder + toggle published |
| `Галерея` | `GalleryPhoto` | Upload, reorder, caption, toggle published, delete |

Reordering uses drag-and-drop on desktop and up/down buttons on mobile.

## `Настройки` (`/admin/settings`)

Single form bound to the `Settings` singleton:
- `Контактный email`
- `Телефон`
- `Адрес`
- `Instagram URL`
- `Telegram chat ID` (used by the Telegram bot to know where to send alerts)
- `Часы работы` (hint string shown in the footer / contact page)
- `Тестовое уведомление` button: sends a test email + Telegram message and reports success/failure inline. This is the standard way for the admin to verify integrations after deployment or after rotating tokens.
