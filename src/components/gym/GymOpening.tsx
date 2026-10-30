'use client';

import { useEffect, useState } from 'react';

import { markGymOpened } from '@/lib/gym/actions';
import { PugAvatar } from './PugAvatar';

/** Сколько длится церемония целиком, мс: ножницы, разрез, пауза на прочитать, уход. */
const LENGTH = 4200;
const LEAVE = 300;

/*
 * Всё движение — CSS: экран приходит в первом же HTML и начинает играть до
 * того, как страница оживёт, — как фраза дня на главной. React здесь только
 * снимает экран и запирает прокрутку. Половинки ленты висят на краях экрана и
 * падают вниз, как на настоящей ленточке у входа, и тают, не наезжая на
 * слова. Слова — после разреза: «ленточку перерезал» до него было враньём.
 */
const CSS = `
.go-root{animation:go-out .5s cubic-bezier(.4,0,.2,1) 3.65s forwards}
.go-root.go-leave{animation:go-out ${LEAVE}ms cubic-bezier(.4,0,.2,1) forwards}
.go-rise{animation:go-rise .4s cubic-bezier(.2,0,0,1) both}
.go-line{animation:go-rise .45s cubic-bezier(.2,0,0,1) 1.45s both}
.go-scissors{animation:go-in .6s cubic-bezier(.2,0,0,1) .3s both,go-away .4s ease-in 1.55s forwards}
.go-blade-up,.go-blade-down{transform-box:view-box;transform-origin:60px 30px}
.go-blade-up{animation:go-snip-up .55s ease-in-out .9s both}
.go-blade-down{animation:go-snip-down .55s ease-in-out .9s both}
.go-half-l{transform-origin:0 50%;animation:go-drop-l .75s cubic-bezier(.5,0,.75,1) 1.42s forwards}
.go-half-r{transform-origin:100% 50%;animation:go-drop-r .75s cubic-bezier(.5,0,.75,1) 1.42s forwards}
.go-bow{animation:go-bow .6s cubic-bezier(.5,0,.75,1) 1.42s forwards}
@keyframes go-out{to{opacity:0;transform:scale(1.04);visibility:hidden}}
@keyframes go-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes go-in{from{opacity:0;transform:translateX(130px)}to{opacity:1;transform:none}}
@keyframes go-away{to{opacity:0;transform:translateX(90px)}}
@keyframes go-snip-up{0%{transform:rotate(0)}30%{transform:rotate(-16deg)}55%{transform:rotate(0)}75%{transform:rotate(-12deg)}100%{transform:rotate(0)}}
@keyframes go-snip-down{0%{transform:rotate(0)}30%{transform:rotate(16deg)}55%{transform:rotate(0)}75%{transform:rotate(12deg)}100%{transform:rotate(0)}}
@keyframes go-drop-l{70%{opacity:1}to{transform:rotate(78deg);opacity:0}}
@keyframes go-drop-r{70%{opacity:1}to{transform:rotate(-78deg);opacity:0}}
@keyframes go-bow{to{opacity:0;transform:translateY(120px) rotate(24deg)}}
@media (prefers-reduced-motion:reduce){
  .go-rise,.go-line,.go-scissors,.go-blade-up,.go-blade-down,.go-half-l,.go-half-r,.go-bow{animation:none}
  .go-scissors{display:none}
  .go-root{animation:go-fade .5s linear 3.65s forwards}
  .go-root.go-leave{animation:go-fade ${LEAVE}ms linear forwards}
  @keyframes go-fade{to{opacity:0;visibility:hidden}}
}
`;

/** Ножницы остриём влево: две половины крутятся вокруг винта и щёлкают. */
function Scissors() {
  return (
    <svg viewBox="0 0 120 60" className="h-full w-full overflow-visible">
      <g className="go-blade-down">
        <path d="M64 34L84 40" className="stroke-ink" strokeWidth={5} strokeLinecap="round" />
        <circle cx={94} cy={43} r={10} className="fill-none stroke-loss" strokeWidth={5} />
        <path d="M64 33L10 31.5Q4 30 10 28.5L64 29Z" className="fill-surface stroke-ink" strokeWidth={2} strokeLinejoin="round" />
      </g>
      <g className="go-blade-up">
        <path d="M64 26L84 20" className="stroke-ink" strokeWidth={5} strokeLinecap="round" />
        <circle cx={94} cy={17} r={10} className="fill-none stroke-loss" strokeWidth={5} />
        <path d="M64 27L10 28.5Q4 30 10 31.5L64 31Z" className="fill-surface stroke-ink" strokeWidth={2} strokeLinejoin="round" />
      </g>
      <circle cx={60} cy={30} r={2.6} className="fill-ink" />
    </svg>
  );
}

/**
 * Первый заход в зал: мопс-тренер режет красную ленточку и объявляет зал
 * открытым, потом экран уходит и открывается подвал.
 *
 * Показывается раз на человека (`gymOpened`), строку выбирает сервер. Нажатие
 * куда угодно — пропустить. Прокрутка под экраном заперта на `html`, не на
 * `body`: иначе липкая шапка перестаёт липнуть.
 */
export function GymOpening({ line, title, skip }: { line: string; title: string; skip: string }) {
  const [state, setState] = useState<'on' | 'leaving' | 'gone'>('on');

  useEffect(() => {
    void markGymOpened();
    const timer = window.setTimeout(() => setState('gone'), LENGTH);
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
      className={`go-root fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 overflow-hidden bg-surface px-4 ${state === 'leaving' ? 'go-leave' : ''}`}
      onClick={leave}
    >
      <style>{CSS}</style>
      <p className="go-rise ps-label">{title}</p>
      <div className="go-rise overflow-hidden rounded-full border-2 border-ink bg-sunk">
        <PugAvatar className="h-36 w-36 sm:h-44 sm:w-44" />
      </div>

      {/* Ленточка во всю ширину экрана, бант посередине, ножницы режут по банту.
          Места — отступами, а не `translate`: его перебил бы `transform` анимации. */}
      <div aria-hidden="true" className="relative h-24 w-screen">
        <div className="go-half-l absolute left-0 top-[calc(50%-10px)] h-5 w-1/2 bg-loss">
          <div className="absolute inset-x-0 top-1 h-px bg-surface/30" />
        </div>
        <div className="go-half-r absolute right-0 top-[calc(50%-10px)] h-5 w-1/2 bg-loss">
          <div className="absolute inset-x-0 top-1 h-px bg-surface/30" />
        </div>
        <svg viewBox="-30 -24 60 48" className="go-bow absolute left-[calc(50%-32px)] top-[calc(50%-24px)] h-12 w-16 overflow-visible">
          <path d="M0 0C-8-14-28-16-26-2C-24 8-8 6 0 0Z" className="fill-loss stroke-ink/40" strokeWidth={1.2} />
          <path d="M0 0C8-14 28-16 26-2C24 8 8 6 0 0Z" className="fill-loss stroke-ink/40" strokeWidth={1.2} />
          <path d="M-2 2L-10 22L-4 19L0 24ZM2 2L10 22L4 19L0 24Z" className="fill-loss stroke-ink/40" strokeWidth={1} />
          <circle r={4.5} className="fill-loss stroke-ink/50" strokeWidth={1.2} />
        </svg>
        {/* Ножницы остриём вниз — из рук мопса к ленте. Поворот — у обёртки:
            внутри анимация сдвигает их вдоль своей оси, то есть сверху вниз. */}
        <div className="absolute left-[calc(50%-64px)] top-[-38px] h-16 w-32 -rotate-90">
          <div className="go-scissors h-full w-full">
            <Scissors />
          </div>
        </div>
      </div>

      <p className="go-line max-w-md text-balance text-center text-xl font-semibold leading-snug text-ink sm:text-2xl">{line}</p>
      <button type="button" className="go-line ps-label mt-2 hover:text-ink" onClick={leave}>
        {skip}
      </button>
    </div>
  );
}
