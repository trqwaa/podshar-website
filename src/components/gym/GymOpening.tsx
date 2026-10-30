'use client';

import { useEffect, useState } from 'react';

import { markGymOpened } from '@/lib/gym/actions';
import { PugAvatar } from './PugAvatar';

/** Сколько длится церемония целиком, мс: огонь, чернота, слова, тренер из тьмы, уход. */
const LENGTH = 8500;
/** Без движения — короче: ни огня, ни ожидания, только слова и тренер. */
const LENGTH_STILL = 4900;
const LEAVE = 300;

/*
 * Открытие зала — не ленточка, а резинка для разминки: тренер подносит
 * зажигалку, резинка вспыхивает посередине, огонь бежит к краям, она лопается
 * и разлетается, а экран прогорает дырами до черноты. В черноте — его слова,
 * потом из тьмы проступает он сам, и открывается подвал.
 *
 * Всё движение — CSS: экран приходит в первом же HTML и начинает гореть до
 * того, как страница оживёт, — как фраза дня на главной. React здесь только
 * снимает экран и запирает прокрутку.
 *
 * Дыры — SVG во весь экран со `slice`: круг в нём круглый на любом экране, а
 * резинка стоит там же, где в него попадает строка 58 — `50% + 8·max(1vw,1vh)`.
 * Чёрная дыра на чёрном фоне неотличима от прогоревшей бумаги, поэтому маски
 * не нужны: дыры просто растут поверх. Кромки — обводка, которая не толстеет
 * при росте (`non-scaling-stroke`), и рисуются под заливками: чужая кромка
 * внутри уже прогоревшего не светится.
 */
const BAND_TOP = 'calc(50% + 8 * max(1vw, 1vh))';

/** Рваный край дыры: круг с шумом из трёх синусов, одинаковый на сервере и в браузере. */
const BURN = (() => {
  const n = 36;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.16 * Math.sin(3 * a + 0.7) + 0.09 * Math.sin(7 * a + 2.1) + 0.05 * Math.sin(13 * a + 4.2);
    return `${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`;
  });
  return `M${pts.join('L')}Z`;
})();

/** Где прогорает и когда: центр, начало, длительность, во сколько раз вырастет. */
const HOLES: [number, number, number, number, number][] = [
  [50, 58, 1.45, 2.8, 100],
  [40, 57.5, 1.7, 2.5, 80],
  [60, 58.5, 1.75, 2.5, 80],
  [31, 58, 2.0, 2.2, 70],
  [69, 57.5, 2.05, 2.2, 70],
  [50, 76, 2.35, 1.9, 60],
  [55, 36, 2.45, 1.8, 60],
  [36, 70, 2.6, 1.7, 55],
  [64, 44, 2.7, 1.6, 55]
];

/** Языки снизу, когда горит уже всё: где по ширине, высота, начало, частота дрожи. */
const BLAZE: [number, number, number, number][] = [
  [4, 38, 2.5, 0.34],
  [19, 46, 2.35, 0.41],
  [34, 36, 2.6, 0.37],
  [50, 50, 2.3, 0.44],
  [66, 40, 2.55, 0.36],
  [81, 47, 2.4, 0.42],
  [96, 35, 2.65, 0.39]
];

/** Искры: откуда по ширине (от середины), куда сносит, высота подъёма, длительность, начало. */
const EMBERS = Array.from({ length: 20 }, (_, i) => ({
  from: ((i * 37) % 80) - 40,
  drift: (((i * 53) % 13) - 6) * 0.8,
  rise: 24 + ((i * 29) % 30),
  dur: 1.6 + ((i * 17) % 12) / 10,
  at: 1.5 + ((i * 41) % 38) / 10,
  size: 3 + (i % 3)
}));

const CSS = `
.go-root{animation:go-out .6s cubic-bezier(.4,0,.2,1) 7.9s forwards}
.go-root.go-leave{animation:go-out ${LEAVE}ms cubic-bezier(.4,0,.2,1) forwards}
@keyframes go-out{to{opacity:0;visibility:hidden}}
.go-paper{animation:go-gone .25s linear 4.25s forwards}
.go-rims{animation:go-gone .5s linear 4.3s forwards}
@keyframes go-gone{to{opacity:0;visibility:hidden}}
.go-rise{animation:go-rise .45s cubic-bezier(.2,0,0,1) both}
.go-skip{animation:go-rise .4s cubic-bezier(.2,0,0,1) .6s both}
@keyframes go-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.go-heat{opacity:0;animation:go-heat 1.9s ease-in 2.2s forwards}
@keyframes go-heat{to{opacity:1}}
.go-lighter{animation:go-lighter-in .5s cubic-bezier(.2,0,0,1) .45s both,go-lighter-out .45s ease-in 1.55s forwards}
@keyframes go-lighter-in{from{opacity:0;transform:translateY(40vh)}to{opacity:1;transform:none}}
@keyframes go-lighter-out{to{opacity:0;transform:translateY(30vh) rotate(12deg)}}
.go-lid{transform-box:fill-box;transform-origin:100% 100%;animation:go-lid .25s ease-out .9s both}
@keyframes go-lid{to{transform:rotate(-118deg)}}
.go-spark{transform-box:fill-box;transform-origin:50% 100%;animation:go-spark .2s ease-out 1.05s both}
@keyframes go-spark{from{transform:scale(0)}to{transform:scale(1)}}
.go-flash{opacity:0;animation:go-flash .7s ease-out 1.35s forwards}
@keyframes go-flash{from{opacity:0;transform:scale(.2)}30%{opacity:1}to{opacity:0;transform:scale(3.2)}}
.go-char-l,.go-char-r{transform:scaleX(0);animation:go-char 1.1s cubic-bezier(.3,0,.6,1) 1.35s forwards}
.go-char-l{transform-origin:100% 50%}
.go-char-r{transform-origin:0 50%}
@keyframes go-char{to{transform:scaleX(1)}}
.go-front-l,.go-front-r{opacity:0;animation:go-front-l 1.1s cubic-bezier(.3,0,.6,1) 1.35s forwards}
.go-front-r{animation-name:go-front-r}
@keyframes go-front-l{10%{opacity:1}to{opacity:1;transform:translateX(-50vw)}}
@keyframes go-front-r{10%{opacity:1}to{opacity:1;transform:translateX(50vw)}}
.go-half-l{transform-origin:0 50%;animation:go-snap-l .75s cubic-bezier(.2,.7,.4,1) 1.85s forwards}
.go-half-r{transform-origin:100% 50%;animation:go-snap-r .75s cubic-bezier(.2,.7,.4,1) 1.85s forwards}
@keyframes go-snap-l{to{transform:translate(-30vw,20vh) rotate(-26deg);opacity:0}}
@keyframes go-snap-r{to{transform:translate(30vw,20vh) rotate(26deg);opacity:0}}
.go-burn{transform-box:fill-box;transform-origin:center;opacity:0;animation:go-burn var(--d) cubic-bezier(.55,0,.8,.6) var(--t) forwards}
@keyframes go-burn{from{opacity:1;transform:scale(.001)}to{opacity:1;transform:scale(var(--s))}}
.go-blaze{opacity:0;animation:go-blaze 2.1s cubic-bezier(.3,.1,.4,1) var(--t) forwards}
@keyframes go-blaze{from{opacity:1;transform:translateY(75vh)}55%{transform:translateY(0)}80%{opacity:1}to{opacity:0;transform:translateY(-8vh)}}
.go-flick{transform-origin:50% 100%;animation:go-flick var(--f,.38s) ease-in-out infinite alternate}
@keyframes go-flick{from{transform:scale(1,1) skewX(0)}50%{transform:scale(.94,1.12) skewX(3deg)}to{transform:scale(1.05,.92) skewX(-3deg)}}
.go-glare{opacity:0;animation:go-glare 2.4s ease-in-out 2.3s forwards}
@keyframes go-glare{45%{opacity:1}to{opacity:0}}
.go-ember{opacity:0;animation:go-ember var(--d) ease-out var(--t) forwards}
@keyframes go-ember{15%{opacity:1}to{opacity:0;transform:translate(var(--x),var(--y))}}
.go-quote{opacity:0;animation:go-quote .9s cubic-bezier(.2,0,0,1) 4.9s forwards}
@keyframes go-quote{from{opacity:0;filter:blur(8px);transform:scale(1.04)}to{opacity:1;filter:blur(0);transform:none}}
.go-pug{opacity:0;animation:go-pug 1.5s cubic-bezier(.4,0,.2,1) 6s forwards}
@keyframes go-pug{from{opacity:0;filter:brightness(0);transform:scale(.94)}35%{opacity:1}to{opacity:1;filter:brightness(1);transform:none}}
.go-ember-light{opacity:0;animation:go-heat 1.8s ease-out 6s forwards}
@media (prefers-reduced-motion:reduce){
  .go-lighter,.go-flash,.go-front-l,.go-front-r,.go-blaze,.go-ember,.go-heat,.go-burns,.go-glare{display:none}
  .go-char-l,.go-char-r,.go-half-l,.go-half-r,.go-rise,.go-skip{animation:none}
  .go-paper{animation:go-gone .5s linear 1.2s forwards}
  .go-quote{animation:go-fade .6s linear 1.8s forwards}
  .go-pug{animation:go-fade .6s linear 2.6s forwards}
  .go-ember-light{animation:go-fade .6s linear 2.6s forwards}
  .go-root{animation:go-out .5s linear 4.3s forwards}
  @keyframes go-fade{to{opacity:1}}
}
`;

/** Язык пламени: тёмно-красный снаружи, оранжевый, белый жар в сердцевине. */
function Flame({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 60" className={`overflow-visible ${className}`} aria-hidden="true">
      <path d="M20 60C6 58 1 46 5 34C8 25 14 21 12 8C19 14 21 21 21 27C24 21 26 14 25 4C34 15 39 29 37 42C35 53 30 59 20 60Z" style={{ fill: 'rgb(var(--loss))' }} opacity={0.9} />
      <path d="M20 60C10 58 7 49 9 40C11 33 16 30 16 21C21 27 22 32 22 36C25 32 27 27 27 21C32 30 34 38 32 46C30 54 27 59 20 60Z" style={{ fill: 'rgb(var(--flame))' }} />
      <path d="M20 60C14 59 12 54 13 49C14 45 18 42 19 37C22 42 25 45 26 50C27 55 25 59 20 60Z" style={{ fill: 'rgb(var(--halo))' }} />
    </svg>
  );
}

/** Зажигалка: крышка откидывается вправо, над трубкой встаёт огонёк. */
function Lighter() {
  const chrome = 'color-mix(in oklab, rgb(var(--ink)) 30%, rgb(var(--surface)))';
  return (
    <svg viewBox="0 0 36 96" className="h-24 w-9 overflow-visible">
      <g className="go-spark">
        <path d="M18 0C24 8 26 14 25 19C24 24 21 26 18 26C15 26 12 24 11 19C10 14 12 8 18 0Z" style={{ fill: 'rgb(var(--flame))' }} />
        <path d="M18 10C21 15 22 18 21 21C20 24 19 25 18 25C17 25 16 24 15 21C14 18 15 15 18 10Z" style={{ fill: 'rgb(var(--halo))' }} />
      </g>
      <rect x={8} y={26} width={20} height={15} rx={1.5} style={{ fill: chrome }} className="stroke-ink" strokeWidth={1.4} />
      {[12, 18, 24].map((x) => (
        <circle key={x} cx={x} cy={33} r={1.4} className="fill-ink/70" />
      ))}
      <circle cx={10} cy={27} r={4} className="fill-ink/80" />
      <rect x={4} y={40} width={28} height={54} rx={4} style={{ fill: chrome }} className="stroke-ink" strokeWidth={1.6} />
      <rect x={8} y={44} width={4} height={46} rx={2} className="fill-surface/50" />
      <path className="go-lid stroke-ink" d="M4 40V18C4 15.8 5.8 14 8 14H28C30.2 14 32 15.8 32 18V40Z" style={{ fill: chrome }} strokeWidth={1.6} />
    </svg>
  );
}

/**
 * Первый заход в зал: тренер сжигает резинку для разминки вместо ленточки,
 * экран прогорает до черноты, в черноте — его слова, потом он сам, и
 * открывается подвал.
 *
 * Показывается раз на человека (`gymOpened`), строку выбирает сервер. Нажатие
 * куда угодно — пропустить. Прокрутка под экраном заперта на `html`, не на
 * `body`: иначе липкая шапка перестаёт липнуть.
 */
export function GymOpening({ line, title, skip }: { line: string; title: string; skip: string }) {
  const [state, setState] = useState<'on' | 'leaving' | 'gone'>('on');

  useEffect(() => {
    void markGymOpened();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setState('gone'), still ? LENGTH_STILL : LENGTH);
    return () => window.clearTimeout(timer);
  }, []);

  // Замок снимается, когда экран ушёл, а не при размонтировании: компонент
  // остаётся на странице и рисует пустоту, и прокрутка осталась бы запертой.
  const shown = state !== 'gone';
  useEffect(() => {
    if (!shown) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = before;
    };
  }, [shown]);

  useEffect(() => {
    if (state !== 'leaving') return;
    const timer = window.setTimeout(() => setState('gone'), LEAVE);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === 'gone') return null;
  const leave = () => setState((s) => (s === 'on' ? 'leaving' : s));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`go-root fixed inset-0 z-[80] overflow-hidden ${state === 'leaving' ? 'go-leave' : ''}`}
      style={{ background: 'rgb(var(--deep))' }}
      onClick={leave}
    >
      <style>{CSS}</style>

      {/* Бумага: заголовок, тренер, натянутая резинка. Под ней — чернота. */}
      <div aria-hidden="true" className="go-paper absolute inset-0 bg-surface">
        <p className="go-rise ps-label absolute inset-x-0 top-[11%] text-center">{title}</p>
        <div className="go-rise absolute left-1/2 top-[18%] -ml-16 overflow-hidden rounded-full border-2 border-ink bg-sunk sm:-ml-20">
          <PugAvatar className="h-32 w-32 sm:h-40 sm:w-40" />
        </div>
        {/* Жар снизу: бумага рыжеет, пока огонь не дошёл. */}
        <div
          className="go-heat absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgb(var(--flame) / 0.55), rgb(var(--loss) / 0.22) 38%, transparent 72%)' }}
        />

        {/* Резинка натянута во всю ширину: две половины, горит от середины. */}
        <div className="go-rise absolute inset-x-0 h-[18px] sm:h-[22px]" style={{ top: BAND_TOP, marginTop: -9 }}>
          {(['l', 'r'] as const).map((side) => (
            <div key={side} className={`go-half-${side} absolute top-0 h-full w-1/2 ${side === 'l' ? 'left-0' : 'right-0'}`}>
              <div className="absolute inset-0 rounded-[3px]" style={{ background: 'rgb(var(--loss))' }}>
                <div className="absolute inset-x-0 top-[3px] h-[2px] bg-surface/30" />
                <div className="absolute inset-x-0 bottom-[3px] h-[2px]" style={{ background: 'rgb(var(--blood) / 0.6)' }} />
              </div>
              {/* Обугленное — от середины к краю, с тлеющей кромкой. */}
              <div className={`go-char-${side} absolute inset-0`} style={{ background: 'rgb(var(--deep))' }}>
                <div className={`absolute inset-y-0 w-3 ${side === 'l' ? 'left-0' : 'right-0'}`} style={{ background: 'rgb(var(--flame) / 0.85)' }} />
              </div>
              {/* Фронт огня бежит вместе с кромкой. */}
              <div className={`go-front-${side} absolute bottom-1/2 h-14 w-10 sm:h-16 sm:w-11 ${side === 'l' ? '-right-5' : '-left-5'}`}>
                <div className="go-flick h-full w-full" style={{ '--f': side === 'l' ? '.31s' : '.36s' } as React.CSSProperties}>
                  <Flame className="h-full w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Вспышка в точке поджига. */}
        <div
          className="go-flash absolute left-1/2 h-40 w-40 -ml-20 rounded-full"
          style={{ top: BAND_TOP, marginTop: -80, background: 'radial-gradient(circle, rgb(var(--halo)) 0, rgb(var(--flame) / 0.7) 30%, rgb(var(--flame) / 0) 68%)' }}
        />
        {/* Зажигалка снизу к середине резинки. */}
        <div className="go-lighter absolute left-1/2 -ml-[18px]" style={{ top: BAND_TOP, marginTop: -2 }}>
          <Lighter />
        </div>
      </div>

      {/* Прогорающие дыры: сначала все кромки, поверх — чёрные заливки. */}
      <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="go-burns pointer-events-none absolute inset-0 h-full w-full">
        {/* Кромки гаснут, когда гореть больше нечему: на чёрном они светились бы сами по себе. */}
        <g className="go-rims" fill="none">
          {HOLES.map(([cx, cy, t, d, s], i) => (
            <g key={i} transform={`translate(${cx} ${cy})`}>
              <g className="go-burn" style={{ '--t': `${t}s`, '--d': `${d}s`, '--s': s } as React.CSSProperties}>
                <path d={BURN} vectorEffect="non-scaling-stroke" strokeWidth={30} strokeLinejoin="round" style={{ stroke: 'rgb(var(--blood) / 0.35)' }} />
                <path d={BURN} vectorEffect="non-scaling-stroke" strokeWidth={13} strokeLinejoin="round" style={{ stroke: 'rgb(var(--flame))' }} />
                <path d={BURN} vectorEffect="non-scaling-stroke" strokeWidth={4} strokeLinejoin="round" style={{ stroke: 'rgb(var(--halo))' }} />
              </g>
            </g>
          ))}
        </g>
        <g style={{ fill: 'rgb(var(--deep))' }}>
          {HOLES.map(([cx, cy, t, d, s], i) => (
            <g key={i} transform={`translate(${cx} ${cy})`}>
              <path d={BURN} className="go-burn" style={{ '--t': `${t}s`, '--d': `${d}s`, '--s': s } as React.CSSProperties} />
            </g>
          ))}
        </g>
      </svg>

      {/* Когда горит всё: зарево и языки снизу. */}
      <div
        aria-hidden="true"
        className="go-glare pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgb(var(--flame) / 0.75), rgb(var(--loss) / 0.35) 40%, transparent 75%)' }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {BLAZE.map(([x, height, t, f]) => (
          <div
            key={x}
            className="go-blaze absolute bottom-0"
            style={{ left: `${x}%`, height: `${height}vh`, width: `${height * 0.62}vh`, marginLeft: `${-height * 0.31}vh`, '--t': `${t}s` } as React.CSSProperties}
          >
            <div className="go-flick h-full w-full" style={{ '--f': `${f}s` } as React.CSSProperties}>
              <Flame className="h-full w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Искры летят вверх и гаснут. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="go-ember absolute rounded-full"
            style={
              {
                left: `calc(50% + ${e.from}vw)`,
                top: BAND_TOP,
                width: e.size * 2,
                height: e.size * 2,
                background: 'radial-gradient(circle, rgb(var(--halo)) 0 30%, rgb(var(--flame) / 0.7) 48%, rgb(var(--flame) / 0) 72%)',
                '--x': `${e.drift}vw`,
                '--y': `${-e.rise}vh`,
                '--d': `${e.dur}s`,
                '--t': `${e.at}s`
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Чернота: слова тренера, потом он сам проступает из тьмы. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6">
        <div className="relative">
          {/* Тлеющий отсвет снизу — заливкой, не тенью. */}
          <div
            aria-hidden="true"
            className="go-ember-light absolute -inset-16 rounded-full"
            style={{ background: 'radial-gradient(circle at 50% 70%, rgb(var(--flame) / 0.28), rgb(var(--loss) / 0.12) 45%, rgb(var(--loss) / 0) 70%)' }}
          />
          {/* Низ растворяется в темноте: ровный срез рисунка выглядел бы рамкой. */}
          {/* Маска режет всё за краем блока — поля по бокам для плеч. */}
          <div className="go-pug relative px-5" style={{ maskImage: 'linear-gradient(to bottom, black 62%, transparent 96%)', WebkitMaskImage: 'linear-gradient(to bottom, black 62%, transparent 96%)' }}>
            <PugAvatar className="h-44 w-44 overflow-visible sm:h-56 sm:w-56" />
          </div>
        </div>
        <p className="go-quote max-w-xl text-balance text-center text-2xl font-bold leading-snug text-surface sm:text-3xl">{line}</p>
      </div>

      {/* По центру — обёрткой, а не `translate`: его перебил бы `transform` анимации. */}
      <div className="absolute inset-x-0 bottom-6 flex justify-center">
        <button type="button" className="go-skip ps-label rounded-full border-2 border-ink bg-surface px-4 py-1.5 !text-ink" onClick={leave}>
          {skip}
        </button>
      </div>
    </div>
  );
}
