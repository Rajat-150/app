export default function PageHeader({ title, subtitle, right, testId }) {
  return (
    <div className="flex items-start justify-between mb-8 pb-6 border-b" style={{ borderColor: "var(--border-default)" }} data-testid={testId || "page-header"}>
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
