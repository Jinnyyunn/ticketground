"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type HelpFaq = {
  readonly question: string;
  readonly answer: string;
};

type HelpContact = {
  readonly label: string;
  readonly value: string;
  readonly description: string;
  readonly href?: string;
};

type HelpSearchProps = {
  readonly categories: readonly string[];
  readonly faqs: readonly HelpFaq[];
  readonly contacts: readonly HelpContact[];
};

function includesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query);
}

export function HelpSearch({ categories, faqs, contacts }: HelpSearchProps) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;

  const results = useMemo(() => {
    if (!hasQuery) {
      return {
        categories: [] as string[],
        faqs: [] as HelpFaq[],
        contacts: [] as HelpContact[],
      };
    }

    return {
      categories: categories.filter((category) => includesQuery(category, normalizedQuery)),
      faqs: faqs.filter((faq) => [faq.question, faq.answer].some((value) => includesQuery(value, normalizedQuery))),
      contacts: contacts.filter((contact) =>
        [contact.label, contact.value, contact.description].some((value) => includesQuery(value, normalizedQuery)),
      ),
    };
  }, [categories, contacts, faqs, hasQuery, normalizedQuery]);

  const resultCount = results.categories.length + results.faqs.length + results.contacts.length;

  return (
    <div className="mt-7 max-w-[760px]">
      <form
        className="grid gap-2 rounded-[24px] bg-white p-1 text-ink shadow-sm sm:grid-cols-[minmax(0,1fr)_120px]"
        data-help-search-form
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
        }}
        role="search"
      >
        <input
          aria-label="고객센터 검색어"
          className="h-12 min-w-0 rounded-full px-5 text-sm font-bold text-ink outline-none placeholder:text-ink-3"
          data-help-search-input
          onChange={(event) => setDraft(event.target.value)}
          placeholder="예매번호, 문의 유형, 도움말 검색"
          value={draft}
        />
        <button className="h-12 rounded-full bg-ticketground px-5 text-sm font-black text-white" data-help-search-submit type="submit">
          검색
        </button>
      </form>

      {hasQuery && (
        <section className="mt-4 rounded-lg bg-white p-5 text-ink" data-help-search-results>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-black">고객센터 검색 결과</h2>
            <p className="text-sm font-bold text-ink-3" data-help-search-count>
              총 {resultCount}개
            </p>
          </div>

          {resultCount === 0 ? (
            <div className="mt-4 rounded-lg bg-surface p-4" data-help-search-empty>
              <p className="text-sm font-black text-ink">&quot;{query}&quot;에 대한 고객센터 결과가 없습니다.</p>
              <Link
                className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-line px-4 text-sm font-black text-ink hover:border-line-strong"
                href={`/contents/search?q=${encodeURIComponent(query)}`}
              >
                공연 검색에서 찾아보기
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {results.categories.map((category) => (
                <article key={category} className="rounded-lg border border-line bg-surface p-4" data-help-search-result="category">
                  <span className="text-xs font-black text-ticketground">카테고리</span>
                  <strong className="mt-1 block text-sm font-black text-ink">{category}</strong>
                </article>
              ))}
              {results.faqs.map((faq) => (
                <article key={faq.question} className="rounded-lg border border-line bg-surface p-4" data-help-search-result="faq">
                  <span className="text-xs font-black text-ticketground">FAQ</span>
                  <strong className="mt-1 block text-sm font-black text-ink">{faq.question}</strong>
                  <p className="mt-2 text-sm leading-relaxed text-ink-3">{faq.answer}</p>
                </article>
              ))}
              {results.contacts.map((contact) => {
                const body = (
                  <>
                    <span className="text-xs font-black text-ticketground">상담 채널</span>
                    <strong className="mt-1 block text-sm font-black text-ink">{contact.label}</strong>
                    <span className="mt-2 block text-sm leading-relaxed text-ink-3">
                      {contact.value} · {contact.description}
                    </span>
                  </>
                );

                return contact.href ? (
                  <Link
                    key={contact.label}
                    className="rounded-lg border border-line bg-surface p-4 hover:border-line-strong"
                    data-help-search-result="contact"
                    href={contact.href}
                  >
                    {body}
                  </Link>
                ) : (
                  <article key={contact.label} className="rounded-lg border border-line bg-surface p-4" data-help-search-result="contact">
                    {body}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
