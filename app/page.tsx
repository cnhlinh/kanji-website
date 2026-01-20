"use client";

import { useMemo, useState } from "react";
import kanjiData from "./data/kanji-jouyou.json";

type KanjiMeta = {
  jlpt_new?: number;
  meanings?: string[];
};

const KANJI_DATA = kanjiData as unknown as Record<
  string,
  KanjiMeta & { jlpt_new: number | null }
>;

type GeneratedQuestion = {
  kanji: string;
  prompt: string;
  answer: string;
  choices: string[];
};

const LEVELS: Array<"5" | "4" | "3" | "2" | "1"> = ["5", "4", "3", "2", "1"];

type McqTaskType = "mcq_compound_meaning" | "mcq_base_meaning" | "mcq_reading";
const MCQ_TASKS: McqTaskType[] = [
  "mcq_compound_meaning",
  "mcq_base_meaning",
  "mcq_reading",
];

function pickOne<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function getKanjiPoolForLevel(level: string) {
  const entries = Object.entries(KANJI_DATA);
  const filtered = entries.filter(
    ([, meta]) => meta.jlpt_new !== null && meta.jlpt_new === Number(level)
  );
  return filtered.map(([kanji, meta]) => ({
    kanji,
    meaning: meta.meanings?.[0] ?? "",
  }));
}

function parseMcqOutput(kanji: string, raw: string): GeneratedQuestion | null {
  const text = raw.split("\n---")[0].trim();
  if (!text) return null;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const ansIdx = lines.findIndex((l) => /^Ans:\s*/i.test(l));
  if (ansIdx === -1) return null;

  const answerLetter = lines[ansIdx]
    .replace(/^Ans:\s*/i, "")
    .trim()
    .toUpperCase();

  const body = lines.slice(0, ansIdx);

  const prompt = body[0] ?? "Question";
  const choiceLines = body.slice(1);

  const choices = choiceLines
    .filter((l) => /^[A-D]\.\s+/.test(l))
    .map((l) => l.replace(/^[A-D]\.\s+/, "").trim());

  if (choices.length !== 4) return null;

  const idx = { A: 0, B: 1, C: 2, D: 3 }[answerLetter as "A" | "B" | "C" | "D"];
  if (idx === undefined) return null;

  return {
    kanji,
    prompt,
    choices,
    answer: choices[idx],
  };
}

async function fetchOneMcqFromRoute(args: {
  kanji: string;
  level: string;
  taskType: McqTaskType;
}): Promise<string | null> {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kanji: args.kanji,
        level: args.level,
        taskType: args.taskType,
        maxNewTokens: 220,
        doSample: false,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    console.log(data)
    return typeof data?.output === "string" ? data.output : null;
  } catch (e) {
    console.error("Route call failed", e);
    return null;
  }
}

function randomMcqTask(): McqTaskType {
  return MCQ_TASKS[Math.floor(Math.random() * MCQ_TASKS.length)];
}

export default function Home() {
  const [level, setLevel] = useState<"5" | "4" | "3" | "2" | "1">("5");

  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [mcSelection, setMcSelection] = useState<string | null>(null);
  const [mcResult, setMcResult] = useState<"correct" | "wrong" | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poolCount = useMemo(() => getKanjiPoolForLevel(level).length, [level]);

  const resetPerQuestionState = () => {
    setMcSelection(null);
    setMcResult(null);
  };

  const generateOne = async () => {
    setLoading(true);
    setError(null);
    resetPerQuestionState();

    const pool = getKanjiPoolForLevel(level);
    if (!pool.length) {
      setError("No kanji found for this JLPT level.");
      setLoading(false);
      return;
    }

    const picked = pickOne(pool);
    if (!picked) {
      setError("Failed to pick kanji.");
      setLoading(false);
      return;
    }

    const taskType = randomMcqTask();

    const raw = await fetchOneMcqFromRoute({
      kanji: picked.kanji,
      level,
      taskType,
    });

    if (!raw) {
      setError("Failed to generate question from API.");
      setLoading(false);
      return;
    }

    const parsed = parseMcqOutput(picked.kanji, raw);
    if (!parsed) {
      setError("API returned an unexpected format. Please try again.");
      setLoading(false);
      return;
    }

    setQuestion(parsed);
    setLoading(false);
  };

  const handleMcSelect = (option: string) => {
    if (!question || mcResult) return;
    setMcSelection(option);
    setMcResult(option === question.answer ? "correct" : "wrong");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white text-zinc-900">
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-14">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold leading-tight">AI-generated Kanji practice questions</h1>
          <p className="text-base text-zinc-600">
            Choose a JLPT level. We randomly generate one multiple-choice question about a level-appropriate Kanji each time.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <label className="flex flex-col text-sm font-medium text-zinc-700">
              JLPT level
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as typeof level)}
                className="mt-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    N{lvl}
                  </option>
                ))}
              </select>
              <span className="mt-2 text-xs text-zinc-500">
                Pool size: {poolCount} kanji
              </span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={generateOne}
                disabled={loading || poolCount === 0}
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition enabled:hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-200"
              >
                {loading ? "Generating..." : "Generate 1 question"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuestion(null);
                  setError(null);
                  resetPerQuestionState();
                }}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-indigo-200 hover:text-indigo-700"
              >
                Reset
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </section>

        {!question ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-600">
            Pick a level and hit “Generate 1 question”.
          </div>
        ) : (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between text-sm text-zinc-500">
              <span className="font-medium text-zinc-700">Multiple choice</span>
              <button
                type="button"
                onClick={generateOne}
                disabled={loading}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition enabled:hover:border-indigo-200 enabled:hover:text-indigo-700 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Next question
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <p className="whitespace-pre-wrap text-base text-zinc-700">
                {question.prompt}
              </p>

              <div className="mt-2 grid gap-2">
                {question.choices.map((option) => {
                  const isSelected = mcSelection === option;
                  const showState = mcResult !== null && isSelected;

                  const base =
                    "w-full rounded-xl border px-4 py-3 text-left transition";
                  const stateClasses =
                    mcResult === null && isSelected
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : showState && mcResult === "correct"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : showState && mcResult === "wrong"
                          ? "border-rose-500 bg-rose-50 text-rose-700"
                          : "border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/60";

                  const icon =
                    mcResult && isSelected
                      ? mcResult === "correct"
                        ? "✅"
                        : "❌"
                      : "・";

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleMcSelect(option)}
                      className={`${base} ${stateClasses}`}
                      disabled={mcResult !== null}
                    >
                      <span className="mr-3">{icon}</span>
                      {option}
                    </button>
                  );
                })}
              </div>

              {mcResult && (
                <div
                  className={`rounded-xl px-4 py-3 text-sm ${
                    mcResult === "correct"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {mcResult === "correct"
                    ? "Nice! Keep going."
                    : `Answer: ${question.answer}`}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}