export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-6 py-16">
      <div className="w-full p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
          Page Not Found
        </h1>
        <p className="mt-4 text-muted-foreground">
          If you are seeing this page, please submit a bug report and include
          how you got here.
        </p>
        <a
          href="https://github.com/Jaydchw/joker-forge-desktop/issues/new/choose"
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Submit Bug Report
        </a>
      </div>
    </div>
  );
}
