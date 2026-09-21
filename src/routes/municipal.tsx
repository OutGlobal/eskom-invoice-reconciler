import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/municipal")({
  head: () => ({
    meta: [
      { title: "Municipal Statement Reconciliation | ENERA" },
      {
        name: "description",
        content: "Reconcile uploaded municipal statements against applicable tariff schedules.",
      },
      { property: "og:title", content: "Municipal Statement Reconciliation | ENERA" },
      {
        property: "og:description",
        content: "Reconcile uploaded municipal statements against applicable tariff schedules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MunicipalPage,
});

function MunicipalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Municipal Statement Reconciliation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uploaded municipal statements and tariff documents will appear here after processing.
        </p>
      </div>

      <section className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">No municipal statements uploaded</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Upload a municipal statement and its applicable tariff document to create a line-by-line reconciliation.
        </p>
        <Button asChild className="mt-5">
          <Link to="/upload">
            <FileUp className="h-4 w-4" />
            Upload statements
          </Link>
        </Button>
      </section>
    </div>
  );
}