import { NextIntlClientProvider } from 'next-intl';

import { GYM, clientMessages } from '@/i18n/client-messages';
import { resolveLocale } from '@/lib/locale';

/**
 * Зал: свой провайдер переводов поверх общего.
 *
 * Строки зала нужны только здесь (`client-messages.ts`, `GYM`), и в браузер
 * они едут только со страницами зала. Шторка и мопс в углу живут выше и
 * читают внешний провайдер; компоненты зала — этот.
 */
export default async function GymLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const messages = await clientMessages(locale, GYM);
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Zurich">
      {children}
    </NextIntlClientProvider>
  );
}
