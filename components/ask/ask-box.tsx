"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Card, SourceBadge } from "@/components/ui/card";
import type { MuseRouteResponse } from "@/lib/muse/types";

type AskAnswer = { answer: string; eventIds: string[] };
type EventTitle = { id: string; title: string };

export function AskBox({ placeholder, eventTitles }: { placeholder: string; eventTitles: EventTitle[] }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<MuseRouteResponse<AskAnswer> | null>(null);
  const [loading, setLoading] = useState(false);
  const titlesById = new Map(eventTitles.map((event) => [event.id, event.title]));

  async function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (question.trim().length === 0) return;
    setLoading(true);
    try {
      const response = await fetch("/api/muse/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      setResult((await response.json()) as MuseRouteResponse<AskAnswer>);
    } catch {
      setResult({ data: null, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="mx-3 mt-3">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="ask-question" className="text-[17px] font-bold">
            What do you feel like doing?
          </label>
          <input
            id="ask-question"
            value={question}
            onChange={(change) => setQuestion(change.target.value)}
            placeholder={placeholder}
            className="rounded-full bg-wash px-4 py-2 text-[15px]"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary py-2 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Asking Muse..." : "Ask Muse"}
          </button>
        </form>
      </Card>
      {result && (
        <Card className="mx-3">
          {result.data ? (
            <>
              {result.source && <SourceBadge source={result.source} />}
              <p className="mt-2 text-[15px]">{result.data.answer}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {result.data.eventIds.map((id) => (
                  <li key={id}>
                    <Link href={`/events/${id}`} className="text-[15px] font-semibold text-primary">
                      {titlesById.get(id) ?? id}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[14px] text-[#e41e3f]">{result.error}</p>
          )}
        </Card>
      )}
    </div>
  );
}
