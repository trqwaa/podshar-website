import type { Config } from 'tailwindcss';

/**
 * Podshar design tokens — everyday minimalism.
 *
 * Nothing here is a literal colour. Every token resolves to a CSS variable
 * declared in src/app/globals.css, where two palettes ("Graphite" and "Paper")
 * live side by side and one is switched on. That indirection is the whole point:
 * a re-skin is one edit in one file, and no component ever learns a hex.
 *
 *   canvas   page ground
 *   surface  block fill — the one raised surface
 *   sunk     recessed fill, for the block the eye should land in last
 *   ink      text and outlines
 *   accent   the single interactive colour: hover, active, selection
 *   reactor  the warning red. The "ПХ" core, and nothing else.
 *
 * The `rgb(var(--x) / <alpha-value>)` form keeps Tailwind's alpha modifiers
 * working, so `border-ink/20` is available without a token for every opacity.
 *
 * One typeface, Manrope, at every size and weight. Hierarchy is carried by
 * weight, size and letter-spacing — never by a second family. Nothing lighter
 * than 400 is used anywhere: this palette is too pale to carry hairline type.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        sunk: 'rgb(var(--sunk) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        reactor: 'rgb(var(--reactor) / <alpha-value>)',
        // Derived, never hand-typed at call sites.
        'ink-muted': 'rgb(var(--ink) / 0.62)',
        'ink-faint': 'rgb(var(--ink) / 0.34)',
        hairline: 'rgb(var(--ink) / 0.08)',
        // The outline every block is drawn with. Carried at 2px, so it is the
        // separation between blocks rather than a hairline decorating them.
        rule: 'rgb(var(--ink) / 0.26)',
        // Half-strength, for divisions *inside* a block — panel headers, the
        // rule under the profile. Keeping these lighter is what stops the 2px
        // outline from reading as noise.
        'rule-soft': 'rgb(var(--ink) / 0.13)'
      },
      fontFamily: {
        // Manrope everywhere. `display` is kept as an alias so no call site has
        // to change to prove there is only one family in the system.
        sans: ['var(--font-sans)', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'Manrope', 'system-ui', 'sans-serif']
      },
      letterSpacing: {
        label: '0.12em',
        wordmark: '0.26em'
      },
      fontSize: {
        // The greeting is the only thing allowed to run this large.
        greeting: ['clamp(1.75rem, 5vw, 4rem)', { lineHeight: '1.06', letterSpacing: '-0.03em' }],
        // Labels sat at 10px, which is a caption size, not a heading size. At
        // 12px they are still quiet but no longer something you have to lean in
        // for — and the tracking does the "label" work anyway.
        label: ['0.75rem', { lineHeight: '1', letterSpacing: '0.12em' }],
        stat: ['clamp(1.5rem, 2.6vw, 2.25rem)', { lineHeight: '1', letterSpacing: '-0.02em' }]
      },
      width: {
        // Panel widths live here so the shell and the panels cannot drift apart.
        sidebar: '17rem',
        'sidebar-lg': '20rem',
        chat: '21rem'
      },
      borderRadius: {
        // Softened in v0.6. Blocks are still blocks — this is a 14px round on a
        // 2px outline, not a pill — but the sharp corner was the last piece of
        // the old severe look, and it fought the round objects on the page (the
        // reactor, the dog).
        //
        //   block  the bento cards and panels
        //   DEFAULT / sm  controls inside a block: inputs, buttons, chips
        block: '14px',
        DEFAULT: '8px',
        sm: '6px'
      },
      boxShadow: {
        // Nothing casts a shadow. Kept as an explicit token so a call site that
        // reaches for `shadow-block` gets flatness rather than a Tailwind grey.
        block: 'none',
        none: 'none'
      },
      transitionTimingFunction: {
        // One easing for every panel and hover in the system.
        drape: 'cubic-bezier(0.22, 1, 0.36, 1)'
      },
      transitionDuration: {
        drape: '420ms'
      },
      keyframes: {
        'wisp-drift': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-3px) rotate(-4deg)' }
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        // The reactor's idle breath. Scale only — the opacity swing rides on
        // the proximity value, and stacking the two would double-dip.
        breathe: {
          '0%, 100%': { transform: 'scale(0.94)' },
          '50%': { transform: 'scale(1.06)' }
        },
        // The ray layer turns, slowly enough that you never catch it moving —
        // you only notice the glow is never quite the same shape twice.
        'sun-turn': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' }
        },
        // The dog gathering himself before he speaks. Each dot spends most of
        // the cycle down and dim and only briefly comes up, so what travels
        // along the row is a highlight rather than a wave — three dots bobbing
        // in unison would just be a pulse with extra steps.
        'dot-hop': {
          '0%, 70%, 100%': { transform: 'translateY(0)', opacity: '0.3' },
          '35%': { transform: 'translateY(-4px)', opacity: '0.85' }
        },
        // On and off, never in between: a caret that fades is a caret that looks
        // like it is being animated. This one looks like a cursor.
        'caret-blink': {
          '0%, 45%': { opacity: '1' },
          '55%, 100%': { opacity: '0' }
        }
      },
      animation: {
        'wisp-drift': 'wisp-drift 6s ease-in-out infinite',
        'rise-in': 'rise-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        breathe: 'breathe 3.6s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'sun-turn': 'sun-turn 48s linear infinite',
        'dot-hop': 'dot-hop 1.15s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'caret-blink': 'caret-blink 1.05s steps(1, end) infinite'
      }
    }
  },
  plugins: []
};

export default config;
