'use client';

import { HeadFront } from './PugHead';
import { Initial, type Frame } from './pug-parts';

/** Лицо аватара: спокойное, чуть прищуренное, язык спрятан, моргает сам. */
const AVATAR_FACE: Frame = new Map([
  ['lidF', { opacity: '0.35' }],
  ['blinkF', { opacity: '1' }],
  ['teethF', { opacity: '0' }],
  ['tongueF', { opacity: '0' }],
  ['glow', { opacity: '0' }],
  ['sweatF', { opacity: '0' }]
]);

/**
 * Аватар мопса для зала: без капюшона, в майке-борцовке, огромный.
 *
 * Голова та же, что у мопса в подвале (`PugHead`), только поверх трапеций,
 * которые начинаются от ушей, и плеч шире морды. Майка — настоящая: лямки
 * через трапеции, вырез, проймы до дельт, и ткань идёт до низа кадра, а не
 * кончается под грудью, — иначе с телефона это читалось как лифчик.
 */
export function PugAvatar({ className = '', title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 120 120" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={className}>
      {/* Плечи и трапеции: шире головы, от ушей вниз. */}
      <path d="M-6 124C-5 101 6 88 24 84C34 80 42 74 46 66H74C78 74 86 80 96 84C114 88 125 101 126 124Z" className="fill-pug stroke-ink" strokeWidth={2.4} />
      <circle cx={13} cy={103} r={19} className="fill-pug stroke-ink" strokeWidth={2.4} />
      <circle cx={107} cy={103} r={19} className="fill-pug stroke-ink" strokeWidth={2.4} />
      <path d="M2 108Q8 96 22 94M118 108Q112 96 98 94" className="stroke-pug-mask/40" strokeWidth={1.6} fill="none" />
      <path d="M40 72C44 78 48 82 52 84M80 72C76 78 72 82 68 84" className="stroke-pug-mask/30" strokeWidth={1.4} fill="none" />
      {/* Майка: лямки поверх трапеций, вырез до груди, ткань до края кадра. */}
      <path
        d="M27 124C28 110 30 99 33 90L38 78H47C47 89 52 97 60 98C68 97 73 89 73 78H82L87 90C90 99 92 110 93 124Z"
        style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 10%, rgb(var(--surface)))' }}
        className="stroke-ink"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d="M33 90C36 98 38 108 38 124M87 90C84 98 82 108 82 124" className="stroke-ink/20" strokeWidth={1.3} fill="none" />
      <path d="M49 88Q60 96 71 88" className="stroke-pug-mask/30" strokeWidth={1.4} fill="none" />
      <path d="M60 99V108" className="stroke-pug-mask/25" strokeWidth={1.4} fill="none" />
      <Initial.Provider value={AVATAR_FACE}>
        <g transform="translate(60 46) scale(0.78)">
          <HeadFront outline />
          <HeadFront blinkClass="animate-pug-blink" />
        </g>
      </Initial.Provider>
    </svg>
  );
}
