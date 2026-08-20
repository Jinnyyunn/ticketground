export type EditorSnapshot<Document, Selection> = {
  readonly document: Document;
  readonly selection: Selection;
};

export type EditorHistory<Document, Selection> = {
  readonly past: readonly EditorSnapshot<Document, Selection>[];
  readonly present: EditorSnapshot<Document, Selection>;
  readonly future: readonly EditorSnapshot<Document, Selection>[];
  readonly limit: number;
};

export function createHistory<Document, Selection>(
  present: EditorSnapshot<Document, Selection>,
  limit = 80,
): EditorHistory<Document, Selection> {
  return { past: [], present, future: [], limit };
}

export function commitHistory<Document, Selection>(
  history: EditorHistory<Document, Selection>,
  present: EditorSnapshot<Document, Selection>,
): EditorHistory<Document, Selection> {
  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present,
    future: [],
  };
}

export function undoHistory<Document, Selection>(
  history: EditorHistory<Document, Selection>,
): EditorHistory<Document, Selection> {
  const present = history.past.at(-1);
  if (!present) return history;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<Document, Selection>(
  history: EditorHistory<Document, Selection>,
): EditorHistory<Document, Selection> {
  const present = history.future[0];
  if (!present) return history;
  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present,
    future: history.future.slice(1),
  };
}
