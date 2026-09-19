import { getTranslations } from 'next-intl/server';

import {
  asksWhereAmI,
  isGreeting,
  matchElement,
  matchPlace,
  type Place
} from '@/lib/navigation';
import type { Locale } from '@/i18n/routing';
import type { Answer } from './model';

/**
 * Podshar without a model: keyword matching against the site map.
 *
 * This was the whole assistant until the model landed, and it stays because it
 * is what answers when there is no API key, when the balance runs out, when
 * Anthropic is down, and when a reply comes back unusable. A dog that is dumber
 * than usual is a far better failure than a chat panel showing an error, and
 * nobody on the other end can tell which half replied.
 *
 * The order the questions are asked in matters:
 *
 *   1. a named destination first, so "where do I find the memes" routes rather
 *      than being mistaken for "where am I"
 *   2. then something on the page you are on, so "what is this red button"
 *      answers about the reactor
 *   3. then "where am I", which only fires when nothing more specific did
 *   4. then a bare hello
 */
export async function answerWithoutModel({
  locale,
  message,
  here
}: {
  locale: Locale;
  message: string;
  here: Place;
}): Promise<Answer> {
  const [guide, nav] = await Promise.all([
    getTranslations({ locale, namespace: 'guide' }),
    getTranslations({ locale, namespace: 'nav' })
  ]);

  const target = matchPlace(message);

  // Названо другое место — ведём туда или признаёмся, что его нет.
  if (target && target.id !== here.id) {
    if (target.status === 'planned') {
      return { reply: guide('soon', { place: nav(target.labelKey) }) };
    }
    return { reply: guide('going', { place: nav(target.labelKey) }), route: target.href };
  }

  // Названо место, на котором уже стоим, — не повод пересказывать раздел
  // целиком. Сначала ищем конкретный элемент: «какой цвет у листочка», стоя на
  // доске, должно отвечать про цвета, а не про то, что такое доска. Без этого
  // шага сильные слова нельзя было бы держать и в месте, и в элементе разом.
  const element = matchElement(here, message);
  if (element) return { reply: guide(`${here.id}.${element.id}`) };

  if (target) return { reply: guide(`${here.id}.here`) };
  if (asksWhereAmI(message)) return { reply: guide(`${here.id}.here`) };
  if (isGreeting(message)) return { reply: guide('hello') };

  return { reply: guide('lost') };
}
