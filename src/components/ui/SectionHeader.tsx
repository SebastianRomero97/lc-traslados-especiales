interface SectionHeaderProps {
  tag: string;
  title: string;
  description?: string;
  centered?: boolean;
}

export function SectionHeader({ tag, title, description, centered = false }: SectionHeaderProps) {
  return (
    <div className={`section__header${centered ? ' section__header--center' : ''}`}>
      <span className="section__tag">{tag}</span>
      <h2 className="section__title">{title}</h2>
      {description && <p className="section__desc">{description}</p>}
    </div>
  );
}
