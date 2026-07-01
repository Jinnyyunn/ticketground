import { TicketingPageShell } from "@/components/ticketing/page-shell";

type InformationSection = {
  readonly title: string;
  readonly body: string;
};

type InformationPageProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly sections: readonly InformationSection[];
};

export function InformationPage({ eyebrow, title, description, sections }: InformationPageProps) {
  return (
    <TicketingPageShell>
      <section className="bg-surface">
        <div className="ticketground-container py-12">
          <p className="text-sm font-black text-ticketground">{eyebrow}</p>
          <h1 className="balanced-title mt-3 text-[30px] font-black leading-tight text-ink sm:text-[34px]">{title}</h1>
          <p className="mt-4 max-w-[720px] text-sm leading-loose text-ink-3">{description}</p>
        </div>
      </section>

      <section className="ticketground-container py-10">
        <div className="grid gap-4">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-line bg-white p-5">
              <h2 className="text-lg font-black text-ink">{section.title}</h2>
              <p className="mt-3 text-sm leading-loose text-ink-3">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </TicketingPageShell>
  );
}
