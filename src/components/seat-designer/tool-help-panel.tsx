import type { ToolMode } from "@/types/seat-chart";
import { toolHelpFor } from "@/lib/seat-designer/tool-help";

export function ToolHelpPanel({ mode }: { readonly mode: ToolMode }) {
  const help = toolHelpFor(mode);
  return (
    <section className="mb-4 rounded border border-black/10 bg-white p-4 shadow-sm">
      <h3 className="text-[16px] font-medium leading-6 text-[#333]">{help.title}</h3>
      <ul className="mt-3 space-y-1.5 text-[13px] leading-5 text-[#666]">
        {help.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
      </ul>
      {help.defaults && (
        <dl className="mt-4 divide-y divide-black/5 border-y border-black/5 text-[13px]">
          {help.defaults.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2">
              <dt className="text-[#777]">{item.label}</dt>
              <dd className="font-medium text-[#333]">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
