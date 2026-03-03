import React from 'react';

function renderInlineFormatting(text: string) {
  if (typeof text !== "string") return text;
  if (text.trim() === "---") {
    return <hr className="my-6 border-t-2 border-slate-300" />;
  }
  const isList = /^[-•]\s+/.test(text);
  const cleanText = isList ? text.replace(/^[-•]\s+/, "") : text;

  const nodes: (string | React.ReactNode)[] = [];
  let key = 0;

  function pushFormattedSegment(segment: string) {
    // Matches: ***bolditalic***, **bold**, _italic_, *italic*
    const pattern = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|_(.+?)_|\*(.+?)\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(segment.slice(lastIndex, match.index));
      }
      if (match[1]) {
        nodes.push(
          <strong key={key++}>
            <em>{match[1]}</em>
          </strong>
        );
      } else if (match[2]) {
        nodes.push(<strong key={key++}>{match[2]}</strong>);
      } else if (match[3] || match[4]) {
        nodes.push(<em key={key++}>{match[3] || match[4]}</em>);
      }
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < segment.length) {
      nodes.push(segment.slice(lastIndex));
    }
  }

  // Matches [text](url)
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(cleanText)) !== null) {
    if (match.index > lastIndex) {
      pushFormattedSegment(cleanText.slice(lastIndex, match.index));
    }
    const linkText = match[1];
    const href = match[2];
    nodes.push(
      <a
        key={key++}
        href={href}
        className="text-blue-600 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {linkText}
      </a>
    );
    lastIndex = linkPattern.lastIndex;
  }
  if (lastIndex < cleanText.length) {
    pushFormattedSegment(cleanText.slice(lastIndex));
  }

  if (isList) {
    return (
      <div className="flex items-start gap-2 ml-1">
        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
        <div className="flex-1 leading-relaxed">{nodes}</div>
      </div>
    );
  }

  return <>{nodes}</>;
}

export default function FormattedText({ text, className = "" }: { text: string, className?: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <div key={i} className={line.trim() === "" ? "h-4" : "min-h-[1.5em]"}>
          {renderInlineFormatting(line)}
        </div>
      ))}
    </div>
  );
}
