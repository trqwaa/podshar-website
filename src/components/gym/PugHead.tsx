'use client';

import { C, LINE, Part } from './pug-parts';

/**
 * Голова мопса: в профиль и анфас.
 *
 * Мопс узнаётся по немногому, и всё это здесь. В профиль — купол черепа,
 * почти отвесный лоб и глубокий «стоп» у глаз, выпуклый глаз, толстая складка
 * над носом, которая выступает дальше самого носа, короткая морда, нижняя
 * челюсть чуть впереди верхней, брыли и складки подгрудка, ухо-«пуговка»
 * высоко на черепе. Анфас — морщины лба, сходящиеся к тёмному «отпечатку
 * пальца», складка над носом от щеки до щеки, складки под глазами и по щекам,
 * чёрная маска, глаза навыкате, уши, упавшие вперёд.
 *
 * Подвижное помечено `data-part`: веко, моргание, брови, язык, пот, выдох,
 * уши, черты морды при наклоне головы — их пишет кадр `PugRig`, как суставы.
 * Зубов нет: оскал на тяжёлом читался как злость, а не как усилие.
 */

const SKULL_SIDE =
  'M-8 4C-18-2-24-16-23-30C-22-46-10-57 6-57C20-57 28-50 30-42C31-38 30-35 31-33C34-32 39-30 39-27C39-25 37-24 36-23C38-22 38-19 35-18C35-15 35-13 33-11C33-9 32-6 31-4C29 0 24 2 20 3C14 5 8 7 2 7C-2 7-5 6-8 4Z';
const MASK_SIDE =
  'M28-40C30-37 30-35 31-33C34-32 39-30 39-27C39-25 37-24 36-23C38-22 38-19 35-18C35-15 35-13 33-11C33-9 32-6 31-4C29 0 24 2 20 3C16 2 13-1 12-5C12-12 15-19 18-26C21-32 24-37 28-40Z';
const EAR_SIDE = 'M2-50C8-56 18-54 19-47C16-42 9-40 5-42C2-44 1-47 2-50Z';
/** Капюшон сбоку: стоит над черепом с зазором, обод — перед ухом, низ уходит в ворот. */
const HOOD_SIDE = 'M33-47C28-60 14-67-4-67C-20-66-30-54-30-38C-30-22-28-10-22 6C-14 10 0 11 12 8C9-2 9-14 13-26C16-35 22-42 33-47Z';
const HOOD_SIDE_RIM = 'M33-47C22-42 16-35 13-26C9-14 9-2 12 8L7 9C4-3 4-15 8-27C12-37 20-45 31-50Z';

/** Голова в профиль: начало координат — у основания шеи, морда смотрит вправо. */
export function HeadSide({ hood = false, outline = false }: { hood?: boolean; outline?: boolean }) {
  if (outline) {
    return (
      <>
        <path d={SKULL_SIDE} {...LINE} />
        {hood ? (
          <path d={HOOD_SIDE} {...LINE} />
        ) : (
          <Part name="ear">
            <path d={EAR_SIDE} {...LINE} strokeWidth={2.4} />
          </Part>
        )}
      </>
    );
  }
  return (
    <>
      <path d={SKULL_SIDE} fill={C.skin} />
      {/* Объём: затылок и щека темнее, свет сверху-спереди на лбу. */}
      <path d="M-21-12C-24-28-17-46-2-53C-12-42-16-28-13-12C-11-4-6 1 0 4C-8 3-17-2-21-12Z" fill={C.shade} />
      <path d="M8-52C16-54 24-50 27-44C22-47 14-49 8-49Z" fill={C.light} />
      <path d="M12-5C12-12 15-19 18-26C12-20 9-12 10-4Z" fill={C.shade} />
      <path d={MASK_SIDE} fill={C.mask} />
      {/* Морщины лба над глазом: складка с тенью снизу и бликом сверху. */}
      <path d="M13-47Q21-50 28-45M15-42Q21-44.5 27-40" stroke={C.mask} strokeOpacity={0.55} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <path d="M13-49Q21-52 28-47" stroke={C.light} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      {/* Складка над носом выступает дальше носа; под ней — нос. */}
      <path d="M31-31Q36-31.5 38.6-28" stroke={C.skin} strokeOpacity={0.5} strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M33-24.6Q36-24 37.6-25.6" stroke={C.ink} strokeOpacity={0.6} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <path d="M34.5-23.5C38-23 38.6-19.5 35.5-18.2C34-18 33.8-20.5 34.5-23.5Z" fill={C.ink} />
      {/* Брыли и складки подгрудка. */}
      <path d="M31-12Q29-8 30.5-4" stroke={C.skin} strokeOpacity={0.3} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <path d="M6 5Q12 2 18 3M2 0Q8-2 14 0M-20-12Q-14-10-10-14" stroke={C.mask} strokeOpacity={0.28} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <path d="M33-11Q26-8 18-10" stroke={C.ink} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      {/* Глаз навыкате: белок в заднем углу, блик. */}
      <circle cx={25.5} cy={-35} r={7.2} fill={C.mask} />
      <circle cx={24.6} cy={-35} r={5.9} fill={C.white} />
      <circle cx={26.6} cy={-35} r={5.2} fill={C.ink} />
      <circle cx={28.1} cy={-37} r={1.6} fill={C.white} />
      <Part name="lid">
        <path d="M20.5-35C21-42.5 33-42.5 33.4-35C30-37.5 24-37.5 20.5-35Z" fill={C.mask} />
      </Part>
      <Part name="blink" opacity={0}>
        <path d="M20.2-35C20.5-43 33.6-43 33.6-35C33.2-27.5 20.5-27.5 20.2-35Z" fill={C.mask} />
      </Part>
      <Part name="brow">
        <path d="M18-42Q24-45.5 30.5-42.5" stroke={C.mask} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      </Part>
      <Part name="tongue" opacity={0}>
        <path d="M27-5C27 2 33 3 34-3C31-4 29-4 27-5Z" fill={C.tongue} />
      </Part>
      {hood ? (
        <>
          <path d={HOOD_SIDE} fill={C.hoodie} />
          <path d={HOOD_SIDE_RIM} fill={C.hoodieInner} />
          <path d="M26-57C14-63-4-63-18-53" stroke={C.ink} strokeOpacity={0.25} strokeWidth={1.2} fill="none" />
          <path d="M-22-30Q-18-16-20-4M0-58Q6-50 4-40" stroke={C.ink} strokeOpacity={0.15} strokeWidth={1.2} fill="none" />
          {/* Тень от козырька капюшона на глаз. */}
          <path d="M33-47C26-42 22-36 21-28C28-30 34-36 39-41Z" fill={C.ink} fillOpacity={0.22} />
        </>
      ) : (
        <Part name="ear">
          <path d={EAR_SIDE} fill={C.mask} />
          <path d="M5-48C9-51 14-51 17-48" stroke={C.skin} strokeOpacity={0.3} strokeWidth={1.2} fill="none" />
        </Part>
      )}
      <Part name="sweat" opacity={0}>
        <path d="M0-6C-3-1-3 2 0 2C3 2 3-1 0-6Z" fill={C.sweat} stroke={C.ink} strokeOpacity={0.4} strokeWidth={0.8} />
      </Part>
      <Part name="puff" opacity={0}>
        <circle cx={0} cy={0} r={3.2} fill={C.white} fillOpacity={0.7} />
        <circle cx={6} cy={-3} r={2.4} fill={C.white} fillOpacity={0.55} />
        <circle cx={10} cy={1} r={1.8} fill={C.white} fillOpacity={0.4} />
      </Part>
    </>
  );
}

const SKULL_FRONT = 'M0-38C25-38 41-24 42-4C43 14 35 28 21 33C12 36-12 36-21 33C-35 28-43 14-42-4C-41-24-25-38 0-38Z';
/** Уши-«пуговки»: тонкий тёмный клапан падает вперёд, к глазу. */
const EAR_R = 'M15-35C25-42 38-39 42-30C45-24 45-15 42-10C37-13 33-19 29-24C25-29 20-32 15-35Z';
const EAR_L = 'M-15-35C-25-42-38-39-42-30C-45-24-45-15-42-10C-37-13-33-19-29-24C-25-29-20-32-15-35Z';
/** Капюшон анфас: тело с шовчиком на макушке, обод вокруг морды, подкладка в проёме. */
const HOOD_OUT =
  'M0-58C7-56 13-54 20-52C40-45 53-26 53-2C53 22 46 40 34 52L26 56C14 54-14 54-26 56L-34 52C-46 40-53 22-53-2C-53-26-40-45-20-52C-13-54-7-56 0-58Z';
const RIM_OUTER = 'M0-44C25-44 45-28 46-4C47 16 40 32 27 42C17 47-17 47-27 42C-40 32-47 16-46-4C-45-28-25-44 0-44Z';
const RIM_INNER = 'M0-34C21-34 36-22 37-4C38 12 32 26 20 35C12 39-12 39-20 35C-32 26-38 12-37-4C-36-22-21-34 0-34Z';

function EyeFront({ x }: { x: number }) {
  // Глаз мопса — большой и тёмный, белок видно только во внешнем углу.
  const s = Math.sign(x);
  return (
    <>
      <circle cx={x} cy={-4} r={11.2} fill={C.mask} />
      <circle cx={x + s * 1.6} cy={-3.6} r={8.4} fill={C.white} />
      <circle cx={x - s * 0.4} cy={-4} r={8.2} fill={C.ink} />
      <circle cx={x - s * 0.4} cy={-4} r={4.6} fill={C.mask} fillOpacity={0.5} />
      <circle cx={x + 2.4} cy={-7} r={2.3} fill={C.white} />
      <circle cx={x - 3} cy={-1} r={0.9} fill={C.white} fillOpacity={0.7} />
    </>
  );
}

/** Складка: тёмная борозда и светлый валик над ней — так складка объёмная, а не нарисованная. */
function Fold({ d, width = 2.2, light = true }: { d: string; width?: number; light?: boolean }) {
  return (
    <>
      {light ? <path d={d} transform="translate(0 -1.6)" stroke={C.light} strokeWidth={width * 0.8} fill="none" strokeLinecap="round" /> : null}
      <path d={d} stroke={C.mask} strokeOpacity={0.62} strokeWidth={width} fill="none" strokeLinecap="round" />
    </>
  );
}

/**
 * Голова анфас: начало координат — между глаз. `back` — затылок: мопс лежит
 * или висит вниз головой, и морды отсюда не видно. Черты морды — в `feat`:
 * при наклоне головы кадр сдвигает их вниз-вверх, а череп остаётся круглым,
 * как у настоящей головы, а не сплющивается.
 */
export function HeadFront({ hood = false, outline = false, back = false, blinkClass }: { hood?: boolean; outline?: boolean; back?: boolean; blinkClass?: string }) {
  if (outline) {
    return (
      <>
        {hood ? <path d={HOOD_OUT} {...LINE} /> : null}
        <path d={SKULL_FRONT} {...LINE} />
        {hood ? null : (
          <>
            <path d={EAR_R} {...LINE} strokeWidth={2.4} />
            <path d={EAR_L} {...LINE} strokeWidth={2.4} />
          </>
        )}
      </>
    );
  }
  if (back) {
    return (
      <>
        {hood ? <path d={HOOD_OUT} fill={C.hoodie} /> : null}
        <path d={SKULL_FRONT} fill={hood ? C.hoodie : C.skin} />
        {hood ? (
          <path d="M0-58V34M-30-40Q-40-8-30 30M30-40Q40-8 30 30" stroke={C.ink} strokeOpacity={0.18} strokeWidth={1.4} fill="none" />
        ) : (
          <>
            <path d="M-34 14C-38 0-36-18-24-28C-30-12-30 4-24 20C-28 20-32 18-34 14Z" fill={C.shade} />
            <path d="M-14-30Q0-36 14-30M-18-20Q0-26 18-20" stroke={C.mask} strokeOpacity={0.3} strokeWidth={2} fill="none" strokeLinecap="round" />
            <path d={EAR_R} fill={C.mask} />
            <path d={EAR_L} fill={C.mask} />
          </>
        )}
      </>
    );
  }
  return (
    <>
      {hood ? (
        <>
          <path d={HOOD_OUT} fill={C.hoodie} />
          <path d="M44-22Q49 0 44 26M-44-22Q-49 0-44 26" stroke={C.ink} strokeOpacity={0.14} strokeWidth={1.3} fill="none" />
          <path d={RIM_OUTER} fill={C.hoodieInner} />
        </>
      ) : null}
      <path d={SKULL_FRONT} fill={C.skin} />
      {/* Объём: щёки и брыли темнее к краю, лоб светлее. */}
      <path d="M-41 2C-41 16-34 27-21 33C-29 26-33 14-33 0C-33-8-31-16-27-22C-35-16-41-8-41 2Z" fill={C.shade} />
      <path d="M41 2C41 16 34 27 21 33C29 26 33 14 33 0C33-8 31-16 27-22C35-16 41-8 41 2Z" fill={C.shade} />
      <ellipse cx={0} cy={-30} rx={18} ry={6} fill={C.light} />
      <Part name="feat">
        {/* Лоб: «отпечаток пальца» и морщины, сходящиеся к нему, и две
            продольные складки над переносицей. */}
        <ellipse cx={0} cy={-27} rx={7} ry={4.8} fill={C.mask} fillOpacity={0.5} />
        <ellipse cx={0} cy={-26.4} rx={3.2} ry={2.2} fill={C.mask} fillOpacity={0.45} />
        <Fold d="M-23-19C-15-26-6-27 0-23C6-27 15-26 23-19" />
        <Fold d="M-18-12C-11-18-5-19 0-15C5-19 11-18 18-12" width={2} />
        <Fold d="M-4.5-14C-3.6-9-3.6-6-4.5-2M4.5-14C3.6-9 3.6-6 4.5-2" width={1.6} light={false} />
        {/* Маска и глаза. */}
        <path d="M0 2C15 2 26 8 27 19C28 30 16 36 0 36C-16 36-28 30-27 19C-26 8-15 2 0 2Z" fill={C.mask} />
        <EyeFront x={-16} />
        <EyeFront x={16} />
        {/* Складки под глазами. */}
        <path d="M-25 7Q-16 11-7 6M7 6Q16 11 25 7" stroke={C.skin} strokeOpacity={0.28} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <Part name="lidF">
          <path d="M-25-4C-25-15-7-15-7-4C-11-7.5-21-7.5-25-4ZM7-4C7-15 25-15 25-4C21-7.5 11-7.5 7-4Z" fill={C.mask} />
        </Part>
        <Part name="blinkF" opacity={0} className={blinkClass} style={blinkClass ? { transformBox: 'fill-box', transformOrigin: 'center top' } : undefined}>
          <path d="M-25.5-4C-25.5-15.5-6.5-15.5-6.5-4C-6.5 6-25.5 6-25.5-4ZM6.5-4C6.5-15.5 25.5-15.5 25.5-4C25.5 6 6.5 6 6.5-4Z" fill={C.mask} />
        </Part>
        <Part name="browF">
          <path d="M-25-15Q-16-20-8-16M8-16Q16-20 25-15" stroke={C.mask} strokeWidth={2.6} fill="none" strokeLinecap="round" />
        </Part>
        {/* Складка над носом — от щеки до щеки, светлый валик на тёмной маске. */}
        <path d="M-21 7C-14-1 14-1 21 7C14 3.6-14 3.6-21 7Z" fill={C.skin} fillOpacity={0.72} />
        <path d="M-20.5 7.4C-13 4-6 3.6 0 3.6C6 3.6 13 4 20.5 7.4" stroke={C.ink} strokeOpacity={0.55} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        {/* Складки щёк от складки над носом к брылям. */}
        <path d="M-21 8Q-26 16-23 24M21 8Q26 16 23 24" stroke={C.skin} strokeOpacity={0.3} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        {/* Нос под складкой, ноздри щелями, рот, брыли, прикус. */}
        <path d="M-9.5 12C-9.5 7.5 9.5 7.5 9.5 12C9.5 16.6 4.6 18.6 0 18.6C-4.6 18.6-9.5 16.6-9.5 12Z" fill={C.ink} />
        <path d="M-5.4 11.2Q-3.2 13-5.2 15.2M5.4 11.2Q3.2 13 5.2 15.2" stroke={C.mask} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <path d="M-2.6 9.6Q0 8.8 2.6 9.6" stroke={C.white} strokeOpacity={0.25} strokeWidth={1} fill="none" strokeLinecap="round" />
        <path d="M0 18.6V22.4M-14 23.4Q-7 28.6 0 22.4Q7 28.6 14 23.4" stroke={C.skin} strokeOpacity={0.5} strokeWidth={2} fill="none" strokeLinecap="round" />
        <path d="M-22 16Q-24.5 24-18.5 30.5M22 16Q24.5 24 18.5 30.5" stroke={C.ink} strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <path d="M-8 30.6Q0 33.8 8 30.6" stroke={C.ink} strokeOpacity={0.45} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <Part name="tongueF" opacity={0}>
          <path d="M-5.5 27C-5.5 36 5.5 36 5.5 27Q0 29-5.5 27Z" fill={C.tongue} />
        </Part>
      </Part>
      {hood ? (
        <>
          {/* Тень от козырька на лоб и глаза — взгляд из-под капюшона. */}
          <ellipse cx={0} cy={-24} rx={38} ry={17} fill={C.ink} fillOpacity={0.24} />
          <path d={`${RIM_OUTER}${RIM_INNER}`} fill={C.hoodie} fillRule="evenodd" />
          <path d={RIM_INNER} fill="none" stroke={C.ink} strokeOpacity={0.35} strokeWidth={1.2} />
          <path d="M-38-14C-34-30-20-40 0-41C20-40 34-30 38-14" stroke={C.white} strokeOpacity={0.18} strokeWidth={1.6} fill="none" />
          <path d="M0-58V-44" stroke={C.ink} strokeOpacity={0.25} strokeWidth={1.2} />
          <circle cx={-10} cy={40} r={1.6} fill={C.ink} fillOpacity={0.5} />
          <circle cx={10} cy={40} r={1.6} fill={C.ink} fillOpacity={0.5} />
        </>
      ) : (
        <>
          <Part name="earR">
            <path d={EAR_R} fill={C.mask} />
            <path d="M17-34C26-38 36-36 41-29" stroke={C.skin} strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          </Part>
          <Part name="earL">
            <path d={EAR_L} fill={C.mask} />
            <path d="M-17-34C-26-38-36-36-41-29" stroke={C.skin} strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          </Part>
        </>
      )}
      <Part name="sweatF" opacity={0}>
        <path d="M0-6C-3-1-3 2 0 2C3 2 3-1 0-6Z" fill={C.sweat} stroke={C.ink} strokeOpacity={0.4} strokeWidth={0.8} />
      </Part>
    </>
  );
}

/** Шнурки капюшона: выходят из люверсов у подбородка и свисают на грудь. */
export function HoodStrings() {
  return (
    <g>
      <path d="M-10 40C-12 50-9 60-11 72M10 40C12 50 9 60 11 72" stroke={C.white} strokeWidth={2} fill="none" strokeLinecap="round" />
      <rect x={-12.7} y={70} width={3.4} height={6} rx={1} fill={C.ink} />
      <rect x={9.3} y={70} width={3.4} height={6} rx={1} fill={C.ink} />
    </g>
  );
}
