import { CircleHelp, MonitorSmartphone, Stethoscope } from 'lucide-react'
import { motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, useResource } from '@/api'
import { lazyScene, SceneFrame } from '@/components/three/LazyScene'
import { ButtonLink } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EcgLine } from '@/features/patient/EcgLine'
import { Magnetic } from '@/features/patient/Magnetic'
import { PatientPage } from '@/features/patient/PatientPage'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { useT } from '@/state/language'
import { useSpeakable } from '@/state/speech'

const HeroScene = lazyScene(() => import('@/features/patient/HeroScene'))

const STEPS = ['safety', 'questions', 'answer', 'plan'] as const

/** Headline lines, with the config's one italic word set in italic (no colour change). */
function Headline({ lines, italic }: { lines: string[]; italic: string }) {
  return (
    <h1 className="type-display text-ink">
      {lines.map((line, i) => (
        <span key={i} className="block">
          {line.split(' ').map((word, j) => (
            <Fragment key={j}>
              {j > 0 && ' '}
              {word === italic ? <em className="italic">{word}</em> : word}
            </Fragment>
          ))}
        </span>
      ))}
    </h1>
  )
}

/**
 * Patient Mode · Home: an editorial, asymmetric hero. The 3D form is the hero (upper right, bleeding off
 * its column); a calm ECG line runs behind the headline (bottom left); the start button sits under it
 * with the time it takes. Scrolling docks the form into "How it works", whose steps light up in turn.
 */
export function PatientHome({ route }: { route: RouteMeta }) {
  const t = useT()
  const reduced = useReducedMotion() ?? false
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const cfg = datasets.data?.find((d) => d.id === datasetId)?.patient ?? null
  const [dataOpen, setDataOpen] = useState(false)
  const [startHover, setStartHover] = useState(false)

  const promises = [
    { icon: MonitorSmartphone, text: t('home.trust.browser') },
    { icon: CircleHelp, text: t('home.trust.unsure') },
    { icon: Stethoscope, text: t('home.trust.doctor') },
  ]
  useSpeakable(cfg ? `${cfg.headline.lines.join(' ')} ${t('home.warm')} ${promises.map((p) => p.text).join('. ')}.` : null)

  // ── Scroll moment: the form docks from its hero slot into the "How it works" strip.
  const root = useRef<HTMLDivElement>(null)
  const heroSlot = useRef<HTMLDivElement>(null)
  const dockSlot = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ left: number; top: number; size: number } | null>(null)
  const dx = useMotionValue(0)
  const dy = useMotionValue(0)
  const scale = useMotionValue(1)
  const vignette = useMotionValue(1)
  const track = useMotionValue(0)
  const trackWidth = useTransform(track, (v) => `${v * 100}%`)
  const [lit, setLit] = useState(0)

  useLayoutEffect(() => {
    const main = document.getElementById('main')
    if (!main || !root.current || !heroSlot.current || !dockSlot.current || !strip.current) return
    const rel = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      const o = root.current!.getBoundingClientRect()
      return { left: r.left - o.left, top: r.top - o.top, width: r.width, height: r.height }
    }
    let raf = 0
    const update = () => {
      if (!root.current || !heroSlot.current || !dockSlot.current || !strip.current) return
      const hero = rel(heroSlot.current)
      const dock = rel(dockSlot.current)
      const size = Math.min(hero.width, hero.height)
      setBox((b) => (b && b.left === hero.left && b.top === hero.top && b.size === size ? b : { left: hero.left + (hero.width - size) / 2, top: hero.top, size }))
      const vh = main.clientHeight
      const s = main.scrollTop
      const heroLeft = hero.left + (hero.width - size) / 2
      // Docked once the strip reaches the middle of the screen. Centre to centre; the form fills ~60% of
      // its canvas, so the canvas scales to 1.6× the slot for the form itself to fill it.
      const p = reduced ? 0 : Math.min(1, Math.max(0, s / Math.max(1, dock.top - vh * 0.5)))
      dx.set((dock.left + dock.width / 2 - (heroLeft + size / 2)) * p)
      dy.set((dock.top + dock.height / 2 - (hero.top + size / 2)) * p)
      scale.set(1 + ((dock.width * 1.6) / size - 1) * p)
      vignette.set(1 - p)
      // The strip's steps light up as it moves through the viewport.
      const st = rel(strip.current)
      const q = reduced ? 1 : Math.min(1, Math.max(0, (s - (st.top - vh * 0.85)) / (vh * 0.55)))
      track.set(q)
      setLit(Math.min(STEPS.length, Math.ceil(q * STEPS.length - 0.001)))
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    update()
    main.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const ro = new ResizeObserver(onScroll)
    ro.observe(root.current)
    return () => {
      cancelAnimationFrame(raf)
      main.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro.disconnect()
    }
  }, [reduced, dx, dy, scale, vignette, track, cfg])

  // Keep the page's own scroll at the top when arriving (the shell resets it; this covers remounts).
  useEffect(() => document.getElementById('main')?.scrollTo({ top: 0 }), [])

  return (
    <PatientPage label={route.label}>
      <div ref={root} className="relative">
        {/* ── Hero: form upper right, headline bottom left, ECG behind */}
        <section className="relative grid min-h-[calc(100vh-var(--topbar-h)-3rem)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-label="Welcome">
          <div ref={heroSlot} className="relative h-[58vh] min-h-[22rem] lg:col-start-2 lg:row-start-1 lg:-mr-12 lg:h-[64vh]" aria-hidden="true" />
          <div className="relative z-10 flex flex-col justify-end pb-6 lg:col-start-1 lg:row-start-1 lg:-mt-8 lg:pb-10">
            {cfg && (
              <p className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-rule bg-surface px-4 py-1.5 type-small text-muted">
                <span className="block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                {cfg.checkLabel}
              </p>
            )}
            <div className="relative">
              {/* Full-bleed ECG behind the headline */}
              <div className="absolute top-1/2 right-[-100vw] left-[-3rem] -translate-y-1/2 md:left-[-3rem]" aria-hidden="true">
                <EcgLine excited={startHover} />
              </div>
              <div className="relative">{cfg ? <Headline lines={cfg.headline.lines} italic={cfg.headline.italic} /> : <div className="h-[16rem]" />}</div>
            </div>
            <p className="mt-8 max-w-[44ch] type-body-lg text-muted">{t('home.warm')}</p>
            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Magnetic onHoverChange={setStartHover}>
                <ButtonLink to={`${PATIENT_BASE}/assessment`} className="!h-14 !px-7 !type-body-lg">
                  {t('home.start')} →
                </ButtonLink>
              </Magnetic>
              {cfg && <span className="type-body text-muted">{t('home.minutes', { n: cfg.minutes })}</span>}
            </div>
            <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 type-body text-muted">
              {promises.map(({ icon: Icon, text }, i) => (
                <span key={text} className="inline-flex items-center gap-2">
                  {i > 0 && (
                    <span className="mr-1 text-rule-strong" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <Icon size="1rem" strokeWidth={1.5} className="text-accent" aria-hidden="true" />
                  {text}
                </span>
              ))}
            </p>
            <button
              type="button"
              onClick={() => setDataOpen(true)}
              className="mt-4 w-fit type-body text-ink underline decoration-rule-strong underline-offset-4 transition-colors duration-300 hover:decoration-ink"
            >
              {t('home.data')}
            </button>
          </div>
        </section>

        {/* ── How it works: the form docks into the top-left; steps light up as you scroll */}
        <section ref={strip} className="relative mt-24 rounded-panel border border-rule bg-surface p-8 md:p-12" aria-labelledby="how-title">
          <div className="flex items-center gap-6">
            {/* Where the form docks; collapsed under reduced motion (the form then stays in the hero) */}
            <div ref={dockSlot} className={`shrink-0 ${reduced ? "h-20 w-0" : "h-20 w-20"}`} aria-hidden="true" />
            <h2 id="how-title" className="type-h2 text-ink">
              {t('home.how.title')}
            </h2>
          </div>
          <div className="relative mt-12">
            <div className="absolute top-[0.6875rem] right-0 left-0 h-0.5 rounded-full bg-rule" aria-hidden="true" />
            <motion.div className="absolute top-[0.6875rem] left-0 h-0.5 rounded-full bg-accent" style={{ width: trackWidth }} aria-hidden="true" />
            <ol className="relative grid grid-cols-1 gap-8 md:grid-cols-4">
              {STEPS.map((step, i) => {
                const on = i < lit
                return (
                  <li key={step}>
                    <span
                      className={`block h-6 w-6 rounded-full border-2 transition-colors duration-500 ${on ? 'border-accent bg-accent' : 'border-rule-strong bg-surface'}`}
                      aria-hidden="true"
                    />
                    <p className={`mt-5 type-body-lg transition-colors duration-500 ${on ? 'text-ink' : 'text-muted'}`}>{t(`home.how.${step}`)}</p>
                    <p className="mt-1 max-w-[28ch] type-body text-muted">{t(`home.how.${step}.body`)}</p>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        <p className="mt-16 type-body text-muted">{t('shell.footer')}</p>

        {/* The one 3D form, placed in page coordinates and moved by transform only (the canvas never resizes) */}
        {box && cfg && (
          <motion.div
            className="pointer-events-none absolute z-0"
            style={{ left: box.left, top: box.top, width: box.size, height: box.size, x: dx, y: dy, scale, transformOrigin: '50% 50%' }}
            aria-hidden="true"
          >
            {/* A soft vignette of the background's own colour behind the form */}
            <motion.div className="absolute inset-[-10%] rounded-full bg-[radial-gradient(closest-side,var(--raised),transparent)]" style={{ opacity: vignette }} />
            <SceneFrame label="Loading" shape="circle">
              <HeroScene shape={cfg.heroShape} animate={!reduced} />
            </SceneFrame>
          </motion.div>
        )}
      </div>

      <Drawer open={dataOpen} onClose={() => setDataOpen(false)} label={t('data.title')} width={440}>
        <div className="px-8 pt-8 pb-10">
          <p className="type-h2 text-ink">{t('data.title')}</p>
          <div className="mt-6 flex max-w-[60ch] flex-col gap-4 type-body-lg text-ink">
            <p>{t('data.p1')}</p>
            <p>{t('data.p2')}</p>
            <p className="text-muted">{t('data.p3')}</p>
          </div>
        </div>
      </Drawer>
    </PatientPage>
  )
}
