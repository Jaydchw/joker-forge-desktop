interface ResourceLinkProps {
  label: string;
  icon: any;
  href: string;
  colorClass?: string;
}

export function ResourceLink({
  label,
  icon: Icon,
  href,
  colorClass = "text-muted-foreground",
}: ResourceLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent/50 transition-all group cursor-pointer"
    >
      <div className="p-2 rounded-lg bg-accent group-hover:bg-background transition-colors">
        <Icon
          className={`h-5 w-5 ${colorClass} group-hover:text-primary transition-colors`}
          weight="duotone"
        />
      </div>
      <span className="font-medium text-foreground/80 group-hover:text-foreground">
        {label}
      </span>
    </a>
  );
}
