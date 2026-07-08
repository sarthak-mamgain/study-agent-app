'use client'

import { useMemo, useState } from 'react'

import { TopNav } from '../components/top-nav'

type ConceptRow = {
  id: string
  subject: string
  concept: string
  mastery_score: number | null
  mastery_level: string | null
  overview_gist: string | null
  deep_dive_gist: string[] | null
  strong_areas: string[] | null
  weak_areas: string[] | null
  next_steps: string[] | null
  notes: string | null
  updated_at: string | null
}

type DashboardClientProps = {
  concepts: ConceptRow[]
}

const subjectStyles: Record<string, string> = {
  physics: 'bg-blue-500/15 text-blue-300 ring-blue-400/30',
  biology: 'bg-green-500/15 text-green-300 ring-green-400/30',
  mathematics: 'bg-violet-500/15 text-violet-300 ring-violet-400/30',
  'computer science': 'bg-orange-500/15 text-orange-300 ring-orange-400/30',
  chemistry: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
}

function getSubjectStyle(subject: string) {
  const normalized = subject.trim().toLowerCase()
  return subjectStyles[normalized] ?? 'bg-slate-500/15 text-slate-300 ring-slate-400/30'
}

function getMasteryLevel(value: string | null) {
  if (!value) return 'In Progress'
  return value
}

function getMasteryPercent(value: number | null, masteryLevel: string | null) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, value * 100))
  }

  const weightMap: Record<string, number> = {
    Strong: 4,
    Proficient: 3,
    Developing: 2,
    Introduced: 1,
    'In Progress': 0,
  }

  return (weightMap[masteryLevel ?? ''] ?? 0) / 4 * 100
}

function formatDate(value: string | null) {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function DashboardClient({ concepts }: DashboardClientProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const total = concepts.length
    const subjects = new Set(concepts.map((concept) => concept.subject.trim()).filter(Boolean))
    const average = total === 0
      ? 0
      : concepts.reduce((sum, concept) => sum + getMasteryPercent(concept.mastery_score, concept.mastery_level), 0) / total

    return {
      total,
      uniqueSubjects: subjects.size,
      averagePercent: Math.round(average),
    }
  }, [concepts])

  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <TopNav />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Mastery Dashboard</p>
            <h1 className="mt-1 text-3xl font-semibold">Concept progress overview</h1>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-5">
            <p className="text-sm text-slate-400">Total concepts studied</p>
            <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-5">
            <p className="text-sm text-slate-400">Unique subjects</p>
            <p className="mt-2 text-3xl font-semibold">{stats.uniqueSubjects}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-5">
            <p className="text-sm text-slate-400">Average mastery</p>
            <p className="mt-2 text-3xl font-semibold">{stats.averagePercent}%</p>
          </div>
        </div>

        <div className="grid gap-4">
          {concepts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b1120] p-8 text-center text-slate-400">
              No concepts have been saved yet.
            </div>
          ) : (
            concepts.map((concept) => {
              const masteryPercent = getMasteryPercent(concept.mastery_score, concept.mastery_level)
              const isExpanded = expandedId === concept.id
              const masteryLevel = getMasteryLevel(concept.mastery_level)

              return (
                <div key={concept.id} className="rounded-2xl border border-white/10 bg-[#0b1120] p-5 shadow-lg shadow-black/20">
                  <button type="button" className="w-full text-left" onClick={() => setExpandedId(isExpanded ? null : concept.id)}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${getSubjectStyle(concept.subject)}`}>
                          {concept.subject}
                        </span>
                        <div>
                          <h2 className="text-xl font-semibold">{concept.concept}</h2>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                              {masteryLevel}
                            </span>
                            <span className="text-sm text-slate-400">Updated {formatDate(concept.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="min-w-[180px] flex-1 md:max-w-[260px]">
                        <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
                          <span>Mastery</span>
                          <span>{Math.round(masteryPercent)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${masteryPercent}%` }} />
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="mt-5 grid gap-4 border-t border-white/10 pt-4 md:grid-cols-3">
                      <div>
                        <h3 className="text-sm font-semibold text-emerald-300">Strong areas</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(concept.strong_areas ?? []).length > 0 ? (
                            (concept.strong_areas ?? []).map((area) => (
                              <span key={area} className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-400">None recorded</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-rose-300">Weak areas</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(concept.weak_areas ?? []).length > 0 ? (
                            (concept.weak_areas ?? []).map((area) => (
                              <span key={area} className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-300">
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-400">None recorded</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-sky-300">Next steps</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(concept.next_steps ?? []).length > 0 ? (
                            (concept.next_steps ?? []).map((step) => (
                              <span key={step} className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300">
                                {step}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-400">None recorded</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
