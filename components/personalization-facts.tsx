import type { PersonalizationSnapshot } from "@/lib/personalization";
import { personalizationSummary } from "@/lib/personalization";

export function PersonalizationFacts({ snapshot, variantLabel = "" }: { snapshot: PersonalizationSnapshot | null; variantLabel?: string }) {
  if (!snapshot || snapshot.answers.length < 1) return null;
  const summary = personalizationSummary(variantLabel, snapshot.answers);
  return (
    <div className="mt-4 text-sm leading-6">
      {summary.line ? <p>{summary.line}</p> : null}
      {summary.files.map((file) => <p key={`${file.label}-${file.name}`}>{file.label}: {file.name}</p>)}
      {summary.notes.map((note) => <p key={note.label}>{note.label}: {note.value}</p>)}
      <div className="mt-2 flex flex-wrap gap-2">
        {snapshot.answers.flatMap((answer) => answer.files).map((file) => (
          <a key={file.path} href={file.path} target="_blank" rel="noreferrer" className="block h-24 w-24 overflow-hidden rounded-xl">
            <img src={file.path} alt={file.name} className="h-full w-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}
