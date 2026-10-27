import type { Area, Verdict } from '@/lib/gym/critic';
import { AskCritic } from './AskCritic';
import { PugFace } from './PugFace';

/**
 * Мопс-критик: приговор по трём областям, итог, что делать и добавки.
 *
 * Рисует сервер — и разнос правил, и сохранённый разнос модели. В браузер
 * уходит только кнопка «разнести по-взрослому».
 */

export type CriticWords = {
  title: string;
  hint: string;
  areas: { food: string; train: string; sleep: string; total: string };
  noScore: string;
  advice: string;
  supplements: string;
  take: string;
  skip: string;
  disclaimer: string;
  modelSaid: string | null;
  onlyOwn: string;
  score: (score: number) => string;
};

function AreaTile({ label, area, words }: { label: string; area: Area; words: CriticWords }) {
  return (
    <li className="flex gap-3 rounded-[10px] border-2 border-rule-soft p-3">
      <PugFace face={area.face} className="h-14 w-14 shrink-0" />
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="ps-label">{label}</span>
          <span className="text-sm font-bold tabular-nums text-ink">{area.score === null ? words.noScore : words.score(area.score)}</span>
        </p>
        <p className="mt-1 text-sm leading-snug text-ink">{area.line}</p>
      </div>
    </li>
  );
}

/** Текст модели: абзацы и строки-советы, начинающиеся с «- ». */
function ModelText({ text }: { text: string }) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const tips = lines.filter((l) => /^[-–•]\s/.test(l)).map((l) => l.replace(/^[-–•]\s+/, ''));
  const prose = lines.filter((l) => !/^[-–•]\s/.test(l));
  return (
    <div className="space-y-2">
      {prose.map((p, i) => (
        <p key={i} className="text-base font-medium leading-snug text-ink">
          {p}
        </p>
      ))}
      {tips.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-snug text-ink">
          {tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CriticCard({
  verdict,
  words,
  model,
  mine
}: {
  verdict: Verdict;
  words: CriticWords;
  /** Сохранённый разнос модели, если просили. */
  model: string | null;
  mine: boolean;
}) {
  return (
    <section className="block-card animate-rise-in p-5 [animation-delay:120ms] sm:p-7" aria-labelledby="critic-title">
      <div className="flex flex-wrap items-start gap-5">
        <PugFace face={verdict.total.face} className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" />
        <div className="min-w-0 flex-1">
          <h2 id="critic-title" className="text-xl font-semibold text-ink sm:text-2xl">
            {words.title}
          </h2>
          <p className="text-sm text-ink-muted">{words.hint}</p>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="ps-label">{words.areas.total}</span>
            <span className="text-stat font-semibold tabular-nums text-ink">
              {verdict.total.score === null ? words.noScore : words.score(verdict.total.score)}
            </span>
          </p>
          <p className="mt-1 text-lg font-medium leading-snug text-ink">{verdict.total.line}</p>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <AreaTile label={words.areas.food} area={verdict.food} words={words} />
        <AreaTile label={words.areas.train} area={verdict.train} words={words} />
        <AreaTile label={words.areas.sleep} area={verdict.sleep} words={words} />
      </ul>

      <div className="mt-5 grid grid-cols-1 gap-5 border-t border-rule-soft pt-5 md:grid-cols-2">
        <div>
          <h3 className="ps-label">{words.advice}</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-snug text-ink">
            {verdict.advice.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="ps-label">{words.supplements}</h3>
          <p className="mt-2 text-xs font-semibold lowercase text-ink-muted">{words.take}</p>
          <ul className="mt-1 space-y-1 text-sm leading-snug text-ink">
            {verdict.supplements.take.map((s, i) => (
              <li key={i}>+ {s}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-semibold lowercase text-ink-muted">{words.skip}</p>
          <ul className="mt-1 space-y-1 text-sm leading-snug text-ink">
            {verdict.supplements.skip.map((s, i) => (
              <li key={i}>− {s}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">{words.disclaimer}</p>
        </div>
      </div>

      <div className="mt-5 border-t border-rule-soft pt-5">
        {model && words.modelSaid ? (
          <div className="mb-4 rounded-[10px] border-2 border-ink p-4">
            <p className="ps-label mb-2">{words.modelSaid}</p>
            <ModelText text={model} />
          </div>
        ) : null}
        {mine ? <AskCritic again={Boolean(model)} /> : <p className="text-sm text-ink-muted">{words.onlyOwn}</p>}
      </div>
    </section>
  );
}
