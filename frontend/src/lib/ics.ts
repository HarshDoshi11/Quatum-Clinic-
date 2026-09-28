/**
 * A one-event iCalendar file, built in the browser (nothing leaves the device). The time is written as
 * floating local time, so the calendar app keeps the time the patient picked.
 */

const pad = (n: number) => String(n).padStart(2, '0')
/** 2026-10-02T09:30 → 20261002T093000 (floating local time) */
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
/** RFC 5545 text escaping: backslash, semicolon, comma, newline. */
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

export interface CalendarEvent {
  start: Date
  minutes: number
  title: string
  description: string
}

export function calendarFile({ start, minutes, title, description }: CalendarEvent): string {
  const end = new Date(start.getTime() + minutes * 60_000)
  const now = new Date()
  const utc = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Q/Clinical//Patient Mode//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${now.getTime()}-${Math.round(start.getTime() / 1000)}@qclinical.local`,
    `DTSTAMP:${utc}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(title)}`,
    `DESCRIPTION:${escape(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/** Saves the file through a temporary link. */
export function downloadCalendarFile(event: CalendarEvent, fileName = 'appointment.ics'): void {
  const url = URL.createObjectURL(new Blob([calendarFile(event)], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
