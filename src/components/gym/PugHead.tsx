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
/**
 * Уши-«пуговки»: тонкий тёмный клапан, сложенный вперёд. Сгиб — по верхнему
 * углу черепа, чуть выше контура, кончик лежит на голове и смотрит на
 * внешний угол глаза. Круглые лопухи по бокам макушки делали из мопса медведя.
 */
const EAR_R = 'M12-36C19-40.5 31-39.5 38-32C40-29.5 40-26.5 37.5-24C34.5-21 31-17.5 27.5-13.5C25.5-17 22-22 18.5-26.5C16-30 14-33 12-36Z';
const EAR_L = 'M-12-36C-19-40.5-31-39.5-38-32C-40-29.5-40-26.5-37.5-24C-34.5-21-31-17.5-27.5-13.5C-25.5-17-22-22-18.5-26.5C-16-30-14-33-12-36Z';
/**
 * Капюшон анфас: тонкий трикотаж, а не обод. Макушка чуть острится по шву,
 * бока ложатся на плечи, кромка проёма узкая, а внутри — тень, из которой
 * смотрит морда. Толстый светлый обод вплотную к морде читался платком.
 */
const HOOD_OUT =
  'M0-58C6-57.5 12-56 18-53C38-46 49-28 49-3C49 19 44 36 36 48L30 54C16 51-16 51-30 54L-36 48C-44 36-49 19-49-3C-49-28-38-46-18-53C-12-56-6-57.5 0-58Z';
const RIM_OUTER = 'M0-43C24-43 42-28 43-5C44 15 38 31 26 41C17 46-17 46-26 41C-38 31-44 15-43-5C-42-28-24-43 0-43Z';
const RIM_INNER = 'M0-37C21.5-37 38.5-24 39.5-5C40.5 12 35 27 23 36C15 41-15 41-23 36C-35 27-40.5 12-39.5-5C-38.5-24-21.5-37 0-37Z';
/** Глубина капюшона: тёмная полоса подкладки по краю проёма. */
const RIM_DEPTH = 'M0-33C19-33 34-21.5 35-5C36 10 31 24 21 32C14 36-14 36-21 32C-31 24-36 10-35-5C-34-21.5-19-33 0-33Z';

function EyeFront({ x, stern = false }: { x: number; stern?: boolean }) {
  // Глаз мопса — большой и тёмный, белок видно только во внешнем углу.
  const s = Math.sign(x);
  return (
    <>
      <circle cx={x} cy={-4} r={11.2} fill={C.mask} />
      <circle cx={x + s * 1.6} cy={-3.6} r={8.4} fill={C.white} />
      <circle cx={x - s * 0.4} cy={-4} r={8.2} fill={C.ink} />
      <circle cx={x - s * 0.4} cy={-4} r={4.6} fill={C.mask} fillOpacity={0.5} />
      {/* Хмурому — блик под веком: большой блестящий глаз и есть «добрый мопс». */}
      {stern ? (
        <circle cx={x + 3} cy={-0.6} r={1.2} fill={C.white} fillOpacity={0.85} />
      ) : (
        <>
          <circle cx={x + 2.4} cy={-7} r={2.3} fill={C.white} />
          <circle cx={x - 3} cy={-1} r={0.9} fill={C.white} fillOpacity={0.7} />
        </>
      )}
    </>
  );
}

/**
 * Хмурый тренер поверх обычной морды: веко срезано наискось к переносице,
 * брови сведены и опущены, рот уголками вниз, шрам через левую бровь.
 */
function SternBrow() {
  return (
    <>
      <path d="M-25.3-6.4A9.6 9.6 0 0 1-6.6-1.9ZM25.3-6.4A9.6 9.6 0 0 0 6.6-1.9Z" fill={C.mask} />
      <path d="M-25.3-6.4L-6.6-1.9M25.3-6.4L6.6-1.9" stroke={C.ink} strokeOpacity={0.7} strokeWidth={1.3} strokeLinecap="round" />
      <path d="M-28-17C-21-17.5-13-14.5-5.5-8.5M28-17C21-17.5 13-14.5 5.5-8.5" stroke={C.mask} strokeWidth={4} fill="none" strokeLinecap="round" />
    </>
  );
}

function Scar() {
  return (
    <>
      <path d="M-29-29L-17-10" stroke={C.white} strokeOpacity={0.6} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M-28.2-24.6L-24.6-26.8M-25.6-20.6L-22-22.8M-23-16.6L-19.4-18.8" stroke={C.white} strokeOpacity={0.5} strokeWidth={1.1} strokeLinecap="round" />
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
export function HeadFront({
  hood = false,
  outline = false,
  back = false,
  stern = false,
  brood = false,
  blinkClass
}: {
  hood?: boolean;
  outline?: boolean;
  back?: boolean;
  /** Морда тренера на аватаре: прищур, сведённые брови, рот вниз, шрам. */
  stern?: boolean;
  /** Задумчивая морда дня отдыха: тяжёлые веки, ровные брови, взгляд в себя — как Левроун на фото. */
  brood?: boolean;
  blinkClass?: string;
}) {
  const hard = stern;
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
          {/* Бок от света — темнее, по верху — блик лампы. */}
          <path d="M-49-3C-49-28-38-46-18-53C-30-43-38-28-40-7C-42 14-38 31-30 45L-36 48C-44 36-49 19-49-3Z" fill={C.hoodieFar} />
          <path d="M18-53C30-48 40-40 45-28C38-36 30-42 18-47Z" fill={C.hoodieWorn} fillOpacity={0.55} />
          <path d="M-20-52C-10-56.5 10-56.5 20-52" stroke={C.hoodieWorn} strokeWidth={2.2} fill="none" strokeLinecap="round" />
          {/* Одна мягкая складка с каждой стороны и у шеи: трикотаж, а не латы. */}
          <path d="M41-28Q47-8 44 16M-41-26Q-46-6-43 18" stroke={C.ink} strokeOpacity={0.25} strokeWidth={1.3} fill="none" strokeLinecap="round" />
          <path d="M-30 50Q-22 46-14 49M30 50Q22 46 14 49" stroke={C.ink} strokeOpacity={0.22} strokeWidth={1.2} fill="none" strokeLinecap="round" />
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
        {hard ? (
          // Нахмуренный лоб: складки стянуты к переносице, «11» между бровей глубже.
          <>
            <Fold d="M-24-25C-15-28-7-25-1-19M24-25C15-28 7-25 1-19" />
            <Fold d="M-19-31C-11-34-5-32 0-28C5-32 11-34 19-31" width={2} />
            <Fold d="M-4-17C-3-11-3-7-4-3M4-17C3-11 3-7 4-3" width={2} light={false} />
          </>
        ) : (
          <>
            <Fold d="M-23-19C-15-26-6-27 0-23C6-27 15-26 23-19" />
            <Fold d="M-18-12C-11-18-5-19 0-15C5-19 11-18 18-12" width={2} />
            <Fold d="M-4.5-14C-3.6-9-3.6-6-4.5-2M4.5-14C3.6-9 3.6-6 4.5-2" width={1.6} light={false} />
          </>
        )}
        {/* Маска и глаза. */}
        <path d="M0 2C15 2 26 8 27 19C28 30 16 36 0 36C-16 36-28 30-27 19C-26 8-15 2 0 2Z" fill={C.mask} />
        <EyeFront x={-16} stern={hard || brood} />
        <EyeFront x={16} stern={hard || brood} />
        {brood ? (
          // Веки опущены наполовину — смотрит в себя, а не на тебя.
          <path d="M-25.5-2.5C-25.5-15.5-6.5-15.5-6.5-2.5C-10-6.5-22-6.5-25.5-2.5ZM6.5-2.5C6.5-15.5 25.5-15.5 25.5-2.5C22-6.5 10-6.5 6.5-2.5Z" fill={C.mask} />
        ) : null}
        {/* Складки под глазами. */}
        <path d="M-25 7Q-16 11-7 6M7 6Q16 11 25 7" stroke={C.skin} strokeOpacity={0.28} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <Part name="lidF">
          <path d="M-25-4C-25-15-7-15-7-4C-11-7.5-21-7.5-25-4ZM7-4C7-15 25-15 25-4C21-7.5 11-7.5 7-4Z" fill={C.mask} />
        </Part>
        <Part name="blinkF" opacity={0} className={blinkClass} style={blinkClass ? { transformBox: 'fill-box', transformOrigin: 'center top' } : undefined}>
          <path d="M-25.5-4C-25.5-15.5-6.5-15.5-6.5-4C-6.5 6-25.5 6-25.5-4ZM6.5-4C6.5-15.5 25.5-15.5 25.5-4C25.5 6 6.5 6 6.5-4Z" fill={C.mask} />
        </Part>
        {hard ? (
          <SternBrow />
        ) : brood ? (
          <path d="M-26-13.5Q-17-16-8-12.5M8-12.5Q17-16 26-13.5" stroke={C.mask} strokeWidth={2.8} fill="none" strokeLinecap="round" />
        ) : (
          <Part name="browF">
            <path d="M-25-15Q-16-20-8-16M8-16Q16-20 25-15" stroke={C.mask} strokeWidth={2.6} fill="none" strokeLinecap="round" />
          </Part>
        )}
        {/* Складка над носом — от щеки до щеки, светлый валик на тёмной маске. */}
        <path d="M-21 7C-14-1 14-1 21 7C14 3.6-14 3.6-21 7Z" fill={C.skin} fillOpacity={0.72} />
        <path d="M-20.5 7.4C-13 4-6 3.6 0 3.6C6 3.6 13 4 20.5 7.4" stroke={C.ink} strokeOpacity={0.55} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        {/* Складки щёк от складки над носом к брылям. */}
        <path d="M-21 8Q-26 16-23 24M21 8Q26 16 23 24" stroke={C.skin} strokeOpacity={0.3} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        {/* Нос под складкой, ноздри щелями, рот, брыли, прикус. */}
        <path d="M-9.5 12C-9.5 7.5 9.5 7.5 9.5 12C9.5 16.6 4.6 18.6 0 18.6C-4.6 18.6-9.5 16.6-9.5 12Z" fill={C.ink} />
        <path d="M-5.4 11.2Q-3.2 13-5.2 15.2M5.4 11.2Q3.2 13 5.2 15.2" stroke={C.mask} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <path d="M-2.6 9.6Q0 8.8 2.6 9.6" stroke={C.white} strokeOpacity={0.25} strokeWidth={1} fill="none" strokeLinecap="round" />
        <path
          d={hard || brood ? 'M0 18.6V22.4M-14.5 28.4Q-8 22.4 0 22.8Q8 22.4 14.5 28.4' : 'M0 18.6V22.4M-14 23.4Q-7 28.6 0 22.4Q7 28.6 14 23.4'}
          stroke={C.skin}
          strokeOpacity={0.5}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
        <path d="M-22 16Q-24.5 24-18.5 30.5M22 16Q24.5 24 18.5 30.5" stroke={C.ink} strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <path d="M-8 30.6Q0 33.8 8 30.6" stroke={C.ink} strokeOpacity={0.45} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <Part name="tongueF" opacity={0}>
          <path d="M-5.5 27C-5.5 36 5.5 36 5.5 27Q0 29-5.5 27Z" fill={C.tongue} />
        </Part>
        {stern ? <Scar /> : null}
      </Part>
      {hood ? (
        <>
          {/* Тень от козырька: лоб и верх глаз — в темноте, взгляд из-под неё. */}
          <ellipse cx={0} cy={-17} rx={37} ry={15} fill={C.ink} fillOpacity={0.2} />
          <path d="M-39.5-5C-38.5-24-21.5-37 0-37C21.5-37 38.5-24 39.5-5C30-15 16-20 0-20C-16-20-30-15-39.5-5Z" fill={C.ink} fillOpacity={0.42} />
          {/* Подкладка по краю проёма — глубина капюшона, а не обод. */}
          <path d={`${RIM_INNER}${RIM_DEPTH}`} fill={C.hoodieInner} fillOpacity={0.85} fillRule="evenodd" />
          <path d={`${RIM_OUTER}${RIM_INNER}`} fill={C.hoodie} fillRule="evenodd" />
          <path d={RIM_INNER} fill="none" stroke={C.ink} strokeOpacity={0.55} strokeWidth={1.2} />
          {/* Кромка на свету. */}
          <path d="M-36-17C-31-31-18-40 0-40.5C18-40 31-31 36-17" stroke={C.hoodieWorn} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <path d="M0-58V-43" stroke={C.ink} strokeOpacity={0.45} strokeWidth={1.2} />
          <circle cx={-10} cy={40} r={1.6} fill={C.ink} fillOpacity={0.6} />
          <circle cx={10} cy={40} r={1.6} fill={C.ink} fillOpacity={0.6} />
        </>
      ) : (
        <>
          {/* Сгиб уха — светлый валик вдоль верхнего края. */}
          <Part name="earR">
            <path d={EAR_R} fill={C.mask} />
            <path d="M14.5-35.5C20.5-38.8 30-38.2 36-32" stroke={C.skin} strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          </Part>
          <Part name="earL">
            <path d={EAR_L} fill={C.mask} />
            <path d="M-14.5-35.5C-20.5-38.8-30-38.2-36-32" stroke={C.skin} strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round" />
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
