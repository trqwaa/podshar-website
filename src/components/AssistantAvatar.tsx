'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import { PodsharMark } from './PodsharMark';
import { PugAvatar } from './gym/PugAvatar';

/**
 * Podshar's face: the pug in a hood.
 *
 * Deliberately a plain `<img>` rather than `next/image`. The file is one small
 * fixed-size asset rendered at 28–56px, so the optimiser has nothing to win,
 * and `onError` — the whole point here — is straightforward on a raw element.
 *
 * If the file is missing or fails to decode, the component falls back to the
 * stroke mark, so a bad deploy loses the joke rather than the interface.
 *
 * The source file is already cropped square and tight on the head (see
 * public/assets/README.md), so `object-center` is correct here — an offset
 * anchor would now push the face off its own circle.
 */
export function AssistantAvatar({ className = 'h-11 w-11' }: { className?: string }) {
  const t = useTranslations('assistant');
  const [failed, setFailed] = useState(false);
  // В зале мопс снимает капюшон: качок в майке (`gym/PugFace`). Рисунок, а не
  // файл, — ему нечему не загрузиться.
  const inGym = usePathname().startsWith('/gym');

  if (inGym) {
    return (
      <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-rule bg-sunk ${className}`}>
        <PugAvatar className="h-full w-full translate-y-[6%] scale-110" title={t('avatarAlt')} />
      </span>
    );
  }

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-rule bg-sunk text-ink ${className}`}
    >
      {failed ? (
        <PodsharMark className="h-[60%] w-[60%]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/assets/podshar-avatar.webp"
          alt={t('avatarAlt')}
          width={112}
          height={112}
          // `onError` alone is not enough. The element is server-rendered, so a
          // missing file usually errors before React hydrates and that event is
          // simply lost — leaving the browser's broken-image glyph on screen.
          // The ref runs on mount and catches the load that already failed:
          // `complete` with a zero intrinsic width is exactly that state.
          ref={(el) => {
            if (el?.complete && el.naturalWidth === 0) setFailed(true);
          }}
          onError={() => setFailed(true)}
          // An <img> is natively draggable. Left on, a press-and-move over the
          // launcher starts the browser's own image drag-and-drop, which takes
          // the pointer capture and cancels every pointermove after the first —
          // so the launcher simply refuses to move. This is that fix.
          draggable={false}
          className="h-full w-full select-none object-cover object-center"
        />
      )}
    </span>
  );
}
