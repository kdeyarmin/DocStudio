interface ResultMarkdownRendererProps {
  content: string;
}

export function ResultMarkdownRenderer({ content }: ResultMarkdownRendererProps) {
  return (
    <div className="prose prose-slate max-w-none whitespace-pre-wrap break-words text-sm leading-7">
      {content}
    </div>
  );
}
