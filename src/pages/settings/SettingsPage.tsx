import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { PageContainer } from "@/layouts/PageContainer";

interface SettingRowProps {
  label: string;
  description: string;
  defaultChecked?: boolean;
}

function SettingRow({ label, description, defaultChecked }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

export function SettingsPage() {
  return (
    <PageContainer title="Settings" description="Configure how Luna looks and behaves.">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="rounded-xl border border-border/70 bg-card/50 px-5">
          <h2 className="pt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            General
          </h2>
          <SettingRow
            label="Launch on startup"
            description="Start Luna automatically when you sign in to Windows."
          />
          <Separator />
          <SettingRow
            label="Minimize to tray"
            description="Keep Luna running in the system tray when the window is closed."
            defaultChecked
          />
        </section>

        <section className="rounded-xl border border-border/70 bg-card/50 px-5">
          <h2 className="pt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Appearance
          </h2>
          <SettingRow
            label="Reduce motion"
            description="Minimize interface animations and transitions."
          />
          <Separator />
          <SettingRow
            label="Compact sidebar"
            description="Use tighter spacing in the navigation sidebar."
          />
        </section>

        <section className="rounded-xl border border-border/70 bg-card/50 p-5">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            About
          </h2>
          <p className="mt-3 text-sm">Luna</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Version 0.1.0 · Application shell preview
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
