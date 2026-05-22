type PageTitleProps = {
  title: string;
  subtitle?: string;
};

export function PageTitle({ title, subtitle }: PageTitleProps) {
  return (
    <div className="px-4 mb-4">
      {subtitle && (
        <div className="text-xs text-muted mb-1">{subtitle}</div>
      )}
      <h1 className="text-2xl font-medium tracking-tight text-ink m-0">
        {title}
      </h1>
    </div>
  );
}
