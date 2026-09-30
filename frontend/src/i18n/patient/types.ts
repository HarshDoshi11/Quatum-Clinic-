/**
 * The shape of Patient Mode's words. Each language provides one `PatientStrings`; the structure (which
 * inputs are asked, in which steps, which report section shows them) stays in the dataset config.
 */

/** One answer card: a plain label, and optionally an example of what it sounds like or how a report writes it. */
export interface OptionStrings {
  label: string
  example?: string
}

export interface FeatureStrings {
  /** The question, as asked on its own screen. */
  ask: string
  /** One line: why we ask. */
  why: string
  /** Plain labels for every answer value, shown as cards (never raw codes). A small count may use them too. */
  options?: Record<number, OptionStrings>
  /** Replaces the general out-of-range note, with {min} and {max}. */
  rangeNote?: string
  /** Report inputs: how the value usually appears on a report, its other names, and a short tip. */
  find?: { reportLabel: string; names: string[]; tip: string }
}

export interface DatasetStrings {
  home: { eyebrow: string; headline: string; subtext: string }
  /** When the dataset config has a safety check: the strip's wording and the signs asked about. */
  urgent: { strip: string; signs: string[] } | null
  report: {
    ask: string
    yes: { label: string; body: string }
    no: { label: string; body: string }
    /** Title of the illustrated sample report. */
    title: string
    /** One title per report section in the dataset config. */
    sections: Record<string, string>
  }
  /** One title per assessment step in the dataset config. */
  steps: Record<string, string>
  features: Record<string, FeatureStrings>
}
