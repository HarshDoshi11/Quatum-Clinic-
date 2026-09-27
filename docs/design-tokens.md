# Design tokens — "Lab Instrument"

All colours are CSS variables in `frontend/src/styles/tokens.css`. Tailwind utilities map onto them
(`bg-bg`, `bg-surface`, `text-ink`, `text-muted`, `border-rule`, `text-accent`, `bg-classical`,
`text-risk-low|mid|high`), so components never branch on theme.

| Token        | Light                  | Dark                     | Use                                                    |
| ------------ | ---------------------- | ------------------------ | ------------------------------------------------------ |
| `--bg`       | `#F3F1EC`              | `#0D0D0D`                | Page background                                        |
| `--surface`  | `#ECE9E2`              | `#151515`                | Hover / subtle fills                                   |
| `--ink`      | `#0D0D0D`              | `#F3F1EC`                | Text, headlines, lines                                 |
| `--muted`    | `#6B6B6B`              | `#8A8A8A`                | Secondary text, labels                                 |
| `--rule`     | `rgba(13,13,13,.15)`   | `rgba(243,241,236,.14)`  | 1px hairlines                                          |
| `--accent`   | `#2340FF`              | `#4D63FF`                | Quantum, data values, active states — under ~10%       |
| `--classical`| `#8C8C8C`              | `#7A7A7A`                | Classical models on every chart                        |
| `--risk-*`   | `#5E8C61 / C8912B / B23A2E` | `#7FB083 / E0A84A / D25A4D` | Risk only                                       |

## Rules

- Accent never on headline text. Quantum = accent, classical = grey, on every chart.
- Instrument Serif for headlines (64–120px, single ink colour); IBM Plex Sans for UI; IBM Plex Mono
  for numbers, IDs, parameters and uppercase section labels (`.label-mono`).
- 1px hairline rules instead of cards. Corners ≤ 4px. No shadows except the command palette and drawer
  (`.shadow-float`).
- Motion: 200–400ms, `cubic-bezier(0.2, 0, 0, 1)`, never bouncy. Shared variants in `src/lib/motion.ts`.
  `MotionConfig reducedMotion="user"` disables transform animations for reduced-motion users.

## Theme

`index.html` resolves the theme (stored choice → `prefers-color-scheme`) before first paint.
`ThemeProvider` persists changes to `localStorage` (`qc.theme`) and enables the 300ms colour transition
only after first paint.
