import { useEffect, useState } from "react";

import { Bell, FileText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/layouts/PageContainer";
import { useNotesStore } from "@/store/notes/notes.store";

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Notes and reminders created from chat. The user can open a note and
 * remove either kind. Creating them still happens in chat.
 */
export function NotesPage() {
  const notes = useNotesStore((state) => state.notes);
  const reminders = useNotesStore((state) => state.reminders);
  const status = useNotesStore((state) => state.status);
  const error = useNotesStore((state) => state.error);
  const refresh = useNotesStore((state) => state.refresh);
  const removeNote = useNotesStore((state) => state.removeNote);
  const openNote = useNotesStore((state) => state.openNote);
  const removeReminder = useNotesStore((state) => state.removeReminder);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PageContainer
      title="Notes"
      description="Notes and reminders Luna created for you. They stay on this computer."
    >
      <div className="mx-auto max-w-3xl space-y-8">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {status === "unavailable" && !error && (
          <p className="text-sm text-muted-foreground">Notes are unavailable right now.</p>
        )}

        <section>
          <h2 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <FileText className="h-3.5 w-3.5" />
            Notes
          </h2>
          {notes.length === 0 ? (
            <Empty label="No notes yet. Ask Luna in chat to write one." />
          ) : (
            <ul className="space-y-2">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{note.title}</p>
                    <p className="text-xs text-muted-foreground">{when.format(note.updatedAt)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void openNote(note.id)}>
                    Open
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${note.title}`}
                    disabled={pending === note.id}
                    onClick={() => {
                      setPending(note.id);
                      void removeNote(note.id).finally(() => setPending(null));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <Bell className="h-3.5 w-3.5" />
            Reminders
          </h2>
          {reminders.length === 0 ? (
            <Empty label="No reminders yet. Ask Luna in chat to set one." />
          ) : (
            <ul className="space-y-2">
              {reminders.map((reminder) => (
                <li
                  key={reminder.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{reminder.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {when.format(reminder.remindAt)}
                      {reminder.notified ? " · sent" : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${reminder.title}`}
                    disabled={pending === reminder.id}
                    onClick={() => {
                      setPending(reminder.id);
                      void removeReminder(reminder.id).finally(() => setPending(null));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 px-6 py-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
