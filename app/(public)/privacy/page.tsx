import type { Metadata } from "next";
import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { Section } from "@/components/ui/Section";
import { ContentBackdrop } from "@/components/backdrop/ContentBackdrop";

export const metadata: Metadata = buildPageMetadata({
  title: "Политика конфиденциальности",
  description: `Как ${ru.studio.name} собирает и обрабатывает персональные данные.`,
  path: "/privacy",
});

// Static content — no per-request data, so this prerenders.
export default function PrivacyPage() {
  return (
    <>
      <ContentBackdrop />

      <Section className="relative z-10">
        <header className="mt-8 mb-12 sm:mt-12 sm:mb-16">
          <h1 className="font-display text-4xl font-medium tracking-tight text-ink text-balance sm:text-6xl">
            Политика конфиденциальности
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-mute text-balance sm:mt-6">
            Эта страница объясняет, какие данные {ru.studio.name} собирает при
            записи и использовании сайта, зачем и как они защищаются.
          </p>
        </header>

        <div className="max-w-2xl space-y-10 text-ink">
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-medium text-ink">
              Какие данные мы собираем
            </h2>
            <p className="text-mute">
              При оформлении записи: имя, адрес электронной почты, номер
              телефона, при желании — ник в Telegram и комментарий к записи.
              Автоматически: обезличенная статистика посещений (страницы,
              устройство, приблизительный регион) через аналитику.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-medium text-ink">
              Зачем мы их используем
            </h2>
            <p className="text-mute">
              Чтобы обработать и подтвердить запись, связаться с вами по поводу
              визита, отправлять подтверждения и статусы (по email и, если вы
              подключили его, в Telegram), а также улучшать работу сайта. Мы не
              продаём ваши данные и не используем их для сторонней рекламы.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-medium text-ink">
              Кому мы их передаём
            </h2>
            <p className="text-mute">
              Только сервисам, обеспечивающим работу сайта: хостинг и база
              данных, сервис отправки писем, Telegram для уведомлений и сервис
              обезличенной веб-аналитики. Каждый обрабатывает данные строго в
              объёме, необходимом для своей функции.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-medium text-ink">
              Хранение и безопасность
            </h2>
            <p className="text-mute">
              Данные хранятся столько, сколько необходимо для оказания услуги и
              ведения истории записей, после чего удаляются или обезличиваются.
              Доступ к административной части защищён паролем; передача данных
              идёт по защищённому соединению (HTTPS).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-medium text-ink">
              Ваши права
            </h2>
            <p className="text-mute">
              Вы можете запросить доступ к своим данным, их исправление или
              удаление, а также отозвать согласие на обработку. Для этого{" "}
              <Link href="/about#contact" className="text-ink underline hover:text-primary">
                свяжитесь с нами
              </Link>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-medium text-ink">
              Изменения
            </h2>
            <p className="text-mute">
              Мы можем обновлять эту политику. Актуальная версия всегда доступна
              на этой странице.
            </p>
          </section>
        </div>
      </Section>
    </>
  );
}
