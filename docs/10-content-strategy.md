# 10 — Content Strategy

## Language

All UI copy is in **Russian**. There is no i18n layer in v1 — strings live in a single source-of-truth file at `lib/i18n/ru.ts` so they can be reviewed and tweaked centrally without hunting through components.

## Storytelling landing

The `/` page is a guided narrative composed of four scroll-snap sections. The user can break out at any point via persistent `Пропустить` and `Перейти в каталог` buttons that scroll-jump or navigate away.

### Hero

- Full-bleed visual (studio photo or stylized 3D render).
- Studio name + short tagline.
- CTA `Начать` — scrolls to Chapter 1.

### Chapter 1: `Выбери украшение`

- Loads up to 6 jewelries where `featured = true`.
- Animated horizontal/grid showcase (e.g., subtle parallax, card hover lift).
- Clicking a jewelry adds it to the look. The first pick auto-advances to Chapter 2; further picks accumulate in the try-on tray without leaving Chapter 1 (see `Добавить ещё одно` button).
- `Добавить ещё одно` button reopens the picker so the user can build a multi-piece look before advancing.
- Skip link → `Перейти в каталог` opens `/catalog`.

### Chapter 2: `Выбери место`

- Embeds `<BodyViewer>` with all chosen jewelries pre-loaded.
- The tray UI shows current pieces; user can pick anchors for each, remove a piece, or reassign anchors.
- `Добавить ещё` opens an inline picker that respects the current region's anchor compatibility — letting the user grow the look without leaving the chapter.
- User picks region → anchor → camera animates to a preset; the active piece is whatever was just added or selected in the tray.
- Continue button scroll-advances to Chapter 3 with the full `?items=...` state in the URL.
- WebGL2 fallback: replaces the viewer with the chosen jewelries' photo galleries and a `Перейти в каталог` CTA.

### Chapter 3: `Запишись`

- Mini booking flow (slot picker + name/email/phone).
- Pre-filled with all chosen jewelries and their anchors from Chapters 1–2.
- On submit, creates one `Appointment` plus one `JewelryBooking` per chosen piece (combined), then redirects to `/book/success`.
- Skip link → `Перейти в каталог` opens `/catalog`.

### State persistence

- The full multi-piece state is encoded in a single URL param: `?items=jewelryId1:anchorSlug1,jewelryId2:anchorSlug2`.
- This makes any step deep-linkable and recoverable on refresh, and a composed look is shareable.
- A small client store mirrors the URL state for convenience inside React components.

## CMS-driven content

| Page section | Source | Editor type |
|---|---|---|
| About body text | `SiteContent(key="about")` | Rich-text-light (headings, bold, lists, links) |
| Hero copy / CTA label | `SiteContent(key="hero")` | Plain fields with a few text inputs |
| Footer text | `SiteContent(key="footer")` | Plain text |
| Services list | `Service` rows | Structured fields per row (name, description, price, duration, order, published) |
| FAQ list | `FAQItem` rows | Structured fields per row (question, answer, order, published) |
| Gallery | `GalleryPhoto` rows | Photo upload + caption + order + published |
| Contact info | `Settings` singleton | Single form |

The admin can edit all of this from `/admin/content` and `/admin/settings` without touching code.

## Notification templates

All email and Telegram messages are templated in Russian. Templates live in `lib/notifications/templates/`. Variables are interpolated in `{{double-braces}}`.

### Email — booking confirmation to user (`bookingConfirmedUser`)

```
Тема: Бронь подтверждена — {{jewelryName}}

Здравствуйте, {{userName}}!

Ваша бронь украшения «{{jewelryName}}» принята. Мы свяжемся с вами для уточнения деталей.

{{#if appointment}}
Запись на услугу: {{appointmentDate}} в {{appointmentTime}}.
{{/if}}

С уважением,
{{studioName}}
```

### Email — booking notification to admin (`bookingNotifyAdmin`)

```
Тема: Новая бронь — {{jewelryName}}

Пользователь: {{userName}} ({{userEmail}}, {{userPhone}})
Украшение: {{jewelryName}} — количество {{quantity}}
{{#if appointment}}
Запись: {{appointmentDate}} в {{appointmentTime}}
{{/if}}
Заметки: {{notes}}

Открыть в админ-панели: {{adminLink}}
```

### Telegram — admin alert (`adminAlertTelegram`)

Short multi-line message with the same data points and a `адмін-панель` deep link.

### Email — appointment-only confirmation (`appointmentConfirmedUser`)

Similar to the booking confirmation, without the jewelry block.

## Tone

- Friendly, calm, professional.
- Avoid corporate stiffness; the studio is one person.
- Use `вы` (formal) by default — safer for first-time visitors. Switch to `ты` only if the studio explicitly chooses an informal brand voice.

## Theming

The site supports both **light and dark themes**.

- **Light is the default** for first-time visitors who haven't expressed a preference.
- **Dark is selected automatically** via `prefers-color-scheme: dark`.
- A future `<ThemeToggle>` component will let users override the system preference; the foundation is wired with `.theme-light` / `.theme-dark` classes on `<html>` and CSS custom properties so the toggle is a small change.

### Brand colors

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--primary` | `#fe017e` | `#fe017e` | Primary brand color (CTAs, accents, key marks) |
| `--primary-soft` | `#d10268` | `#ff4ca0` | Hover / pressed / dim states |
| `--on-primary` | `#ffffff` | `#ffffff` | Text/icons placed on a primary surface |
| `--page` | `#ffffff` | `#0a0908` | Page background |
| `--card` | `#f7f5f2` | `#14110f` | Surface lift |
| `--ink` | `#0a0908` | `#efe7d8` | Primary text |
| `--mute` | `#6b6359` | `#a39d92` | Muted text |
| `--line` | `#e6e1da` | `#2a241e` | Border / divider |

The full color system (states, semantic tokens, contrast tuning) will be finalized in the design pass.

### Typography

- **Body / UI:** [Inter](https://fonts.google.com/specimen/Inter) — Latin + Cyrillic subsets. Tailwind utility: `font-sans`.
- **Display / headings:** [Onest](https://fonts.google.com/specimen/Onest) — Latin + Cyrillic subsets. Tailwind utility: `font-display`.

Both are loaded via `next/font/google` so they self-host and ship with `font-display: swap` — no FOIT.
