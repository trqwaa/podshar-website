'use client';

import { useId } from 'react';

import { HeadFront } from './PugHead';
import { C, Initial, type Frame } from './pug-parts';

/** Трапеции до ушей: шеи не видно. По этому же силуэту обрезана майка. */
const TRAPS = 'M-8 124C-8 101 2 87 17 81C25 77 29 69 31 57L60 62L89 57C91 69 95 77 103 81C118 87 128 101 128 124Z';

/**
 * Майка-стрингер: глубокий вырез и лямки, которые идут вверх-наружу через
 * трапецию и уходят за край плеча. Лямки нарочно длиннее — их обрезает
 * силуэт трапеций, и край плеча рисуется поверх: так лямка переваливает за
 * плечо на спину. Обрывавшиеся у брылей лямки читались как кончающиеся спереди.
 */
const TANK =
  'M28 124C29 113 31 105 35 99C34 92 27 81 21.5 74.5L15 66L21 61C27 69 34 80 41 89C44 98 51 104 60 105C69 104 76 98 79 89C86 80 93 69 99 61L105 66L98.5 74.5C93 81 86 92 85 99C89 105 91 113 92 124Z';

/** Лицо аватара: прищур и брови рисует `stern`, подвижное веко спрятано, моргает сам. */
const AVATAR_FACE: Frame = new Map([
  ['lidF', { opacity: '0' }],
  ['blinkF', { opacity: '1' }],
  ['tongueF', { opacity: '0' }],
  ['sweatF', { opacity: '0' }]
]);

/**
 * Аватар мопса для зала: тренер, которого лучше не злить.
 *
 * Голова та же, что у мопса в подвале (`PugHead`), но хмурая: прищур, брови
 * к переносице, рот уголками вниз, шрам через бровь. Шеи нет — трапеции
 * поднимаются к ушам, дельты шире морды, на груди свисток на шнурке. Майка —
 * «стрингер»: тонкие лямки через трапеции и глубокий вырез, ткань до низа
 * кадра, — иначе с телефона это читалось как лифчик. Прежний аватар был
 * плюшевым: круглые уши, блестящие глаза и улыбка «w» — «добрый», а не тренер.
 */
export function PugAvatar({ className = '', title }: { className?: string; title?: string }) {
  const clip = `pa${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="0 0 120 120" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={className}>
      <defs>
        <clipPath id={clip}>
          <path d={TRAPS} />
        </clipPath>
      </defs>
      <path d={TRAPS} className="fill-pug stroke-ink" strokeWidth={2.4} strokeLinejoin="round" />
      <circle cx={12} cy={102} r={21} className="fill-pug stroke-ink" strokeWidth={2.4} />
      <circle cx={108} cy={102} r={21} className="fill-pug stroke-ink" strokeWidth={2.4} />
      {/* Пучки дельт, вена и борозда трапеции от уха к плечу. */}
      <path d="M0 106Q6 93 21 91M120 106Q114 93 99 91" className="stroke-pug-mask/40" strokeWidth={1.6} fill="none" />
      <path d="M6 117Q12 107 10 97M114 117Q108 107 110 97" className="stroke-pug-mask/25" strokeWidth={1.2} fill="none" />
      <path d="M19 117C18 111 21 107 19 101C18 98 20 95 22 94" className="stroke-pug-mask/35" strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <path d="M33 66C31 74 26 79 20 82M87 66C89 74 94 79 100 82" className="stroke-pug-mask/30" strokeWidth={1.4} fill="none" />
      {/* Майка-стрингер: вырез до низа груди, лямки через трапеции за спину. */}
      <g clipPath={`url(#${clip})`}>
        <path d={TANK} fill={C.tank} className="stroke-ink" strokeWidth={2} strokeLinejoin="round" />
      </g>
      {/* Край трапеции поверх лямки — через него она и переваливает. */}
      <path d="M17 81C25 77 29 69 31 57M103 81C95 77 91 69 89 57" className="stroke-ink" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M35 99C38 107 39 115 39 124M85 99C82 107 81 115 81 124" className="stroke-ink/20" strokeWidth={1.3} fill="none" />
      {/* Грудные над вырезом. */}
      <path d="M47 88C50 96 55 100 60 100C65 100 70 96 73 88" className="stroke-pug-mask/35" strokeWidth={1.5} fill="none" />
      <path d="M60 80V99" className="stroke-pug-mask/25" strokeWidth={1.4} />
      {/* Свисток на шнурке. */}
      <path d="M43 70C45 84 52 94 58 101M77 70C75 84 68 94 62 101" className="stroke-loss" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <rect x={52} y={101.5} width={12} height={7.4} rx={3.7} fill={C.chrome} className="stroke-ink" strokeWidth={1.3} />
      <rect x={62.5} y={102.8} width={6.5} height={3.8} rx={1} fill={C.chrome} className="stroke-ink" strokeWidth={1.1} />
      <circle cx={56} cy={105.2} r={1.7} className="fill-ink" />
      <Initial.Provider value={AVATAR_FACE}>
        <g transform="translate(60 47) scale(0.8)">
          <HeadFront outline />
          <HeadFront stern blinkClass="animate-pug-blink" />
        </g>
      </Initial.Provider>
    </svg>
  );
}
