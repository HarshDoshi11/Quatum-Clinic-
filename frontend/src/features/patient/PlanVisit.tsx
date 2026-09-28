import { CalendarPlus, Check, Plus, Printer, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { downloadCalendarFile } from '@/lib/ics'
import { easeGentle } from '@/lib/motion'
import type { PatientReport } from '@/types'
import { PATIENT_ICONS } from './icons'

/** What the patient prepares for the visit; the doctor's PDF prints it. Kept in memory only. */
export interface VisitPlan {
  questions: string[]
  notes: string
  /** datetime-local value ("2026-10-02T09:30"), or empty. */
  appointment: string
}

export const EMPTY_PLAN: VisitPlan = { questions: [], notes: '', appointment: '' }

function Timeline({ r }: { r: PatientReport }) {
  const reduced = useReducedMotion() ?? false
  return (
    <ol className="relative flex flex-col gap-6">
      <span className="absolute top-6 bottom-6 left-6 w-px bg-rule" aria-hidden="true" />
      {r.journey.map((step, i) => {
        const Icon = PATIENT_ICONS[step.icon]
        return (
          <motion.li
            key={step.text}
            className="relative flex items-center gap-5 print:!transform-none print:!opacity-100"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.1, ease: easeGentle }}
          >
            <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rule-strong bg-bg" aria-hidden="true">
              <Icon size="1.25rem" strokeWidth={1.5} className="text-ink" />
            </span>
            <span className="type-body-lg text-ink">{step.text}</span>
          </motion.li>
        )
      })}
    </ol>
  )
}

/**
 * "Plan your visit": the steps as a gentle timeline, suggested questions as chips (plus your own),
 * notes, an optional appointment that can go into a calendar, and the PDF for the doctor.
 */
export function PlanVisit({
  r,
  suggestions,
  plan,
  onPlan,
  patientName,
  onPrint,
}: {
  r: PatientReport
  suggestions: string[]
  plan: VisitPlan
  onPlan: (p: VisitPlan) => void
  patientName: string
  onPrint: () => void
}) {
  const [draft, setDraft] = useState('')
  const ids = { own: useId(), notes: useId(), when: useId() }
  const own = plan.questions.filter((q) => !suggestions.includes(q))
  const toggle = (q: string) => onPlan({ ...plan, questions: plan.questions.includes(q) ? plan.questions.filter((x) => x !== q) : [...plan.questions, q] })
  const addOwn = () => {
    const q = draft.trim()
    if (!q || plan.questions.includes(q)) return
    onPlan({ ...plan, questions: [...plan.questions, q] })
    setDraft('')
  }
  const addToCalendar = () => {
    if (!plan.appointment) return
    downloadCalendarFile({
      start: new Date(plan.appointment),
      minutes: 30,
      title: `Doctor’s appointment: ${patientName} check`,
      description: ['Bring your screening report and your original test results.', ...(plan.questions.length ? ['', 'Questions to ask:', ...plan.questions.map((q) => `- ${q}`)] : [])].join('\n'),
    })
  }
  const chip = (q: string, removable = false) => {
    const on = plan.questions.includes(q)
    return (
      <button
        key={q}
        type="button"
        aria-pressed={on}
        onClick={() => toggle(q)}
        className={`relative inline-flex min-h-12 items-center gap-2 rounded-panel border px-4 py-2 text-left type-body-lg transition-colors duration-300 ${
          on ? 'border-accent bg-accent-soft text-ink' : 'border-rule-strong text-ink hover:border-ink'
        }`}
      >
        {on ? (removable ? <X size="1rem" strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" /> : <Check size="1rem" strokeWidth={1.5} className="shrink-0 text-accent" aria-hidden="true" />) : <Plus size="1rem" strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />}
        {q}
      </button>
    )
  }

  return (
    <div className="flex max-w-[48rem] flex-col gap-16">
      <section aria-label="Your steps">
        <Timeline r={r} />
      </section>

      <section aria-labelledby={`${ids.own}-title`}>
        <h3 id={`${ids.own}-title`} className="type-body-lg font-medium text-ink">
          Questions to ask your doctor
        </h3>
        <p className="mt-1 type-body-lg text-muted">Choose the ones you want to ask. They go on the page you bring to your doctor.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {suggestions.map((q) => chip(q))}
          {own.map((q) => chip(q, true))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label htmlFor={ids.own} className="sr-only">
            Add your own question
          </label>
          <input
            id={ids.own}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOwn()
              }
            }}
            placeholder="Add your own question"
            className="h-12 min-w-0 flex-1 rounded-panel border border-rule-strong bg-transparent px-4 type-body-lg text-ink outline-none transition-colors duration-300 placeholder:text-muted focus-visible:border-accent"
          />
          <Button variant="outline" onClick={addOwn} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
      </section>

      <section>
        <label htmlFor={ids.notes} className="type-body-lg font-medium text-ink">
          Anything else you want to mention
        </label>
        <textarea
          id={ids.notes}
          value={plan.notes}
          onChange={(e) => onPlan({ ...plan, notes: e.target.value })}
          rows={4}
          placeholder="For example: symptoms, medicines you take, or how you’ve been feeling."
          className="mt-4 block w-full resize-y rounded-panel border border-rule-strong bg-transparent p-4 type-body-lg text-ink outline-none transition-colors duration-300 placeholder:text-muted focus-visible:border-accent"
        />
      </section>

      <section>
        <label htmlFor={ids.when} className="type-body-lg font-medium text-ink">
          Your appointment <span className="font-normal text-muted">(optional)</span>
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            id={ids.when}
            type="datetime-local"
            value={plan.appointment}
            onChange={(e) => onPlan({ ...plan, appointment: e.target.value })}
            className="h-12 rounded-panel border border-rule-strong bg-transparent px-4 type-body-lg text-ink outline-none transition-colors duration-300 focus-visible:border-accent"
          />
          <Button variant="outline" onClick={addToCalendar} disabled={!plan.appointment}>
            <CalendarPlus size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
            Add to calendar
          </Button>
        </div>
      </section>

      <section className="print:hidden">
        <Button onClick={onPrint}>
          <Printer size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
          Download for my doctor
        </Button>
        <p className="mt-3 type-body text-muted">Page one is your summary with your questions and notes; page two is a summary for your doctor.</p>
      </section>
    </div>
  )
}
