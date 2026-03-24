"use client";

import React from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null;

  const renderContent = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];
    let listItems: string[] = [];
    let inList = false;

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(' ');
        elements.push(
          <p key={elements.length} className="mb-3 text-sm leading-relaxed">
            {formatInlineMarkdown(text)}
          </p>
        );
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={elements.length} className="mb-3 ml-4 space-y-1.5">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm leading-relaxed flex items-start">
                <span className="mr-2 text-primary mt-0.5">•</span>
                <span className="flex-1">{formatInlineMarkdown(item)}</span>
              </li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        flushParagraph();
        flushList();
        return;
      }

      // Handle headers
      if (trimmedLine.startsWith('##')) {
        flushParagraph();
        flushList();
        const headerText = trimmedLine.replace(/^##\s*/, '');
        elements.push(
          <h3 key={elements.length} className="text-base font-semibold mb-2 mt-4 first:mt-0 text-foreground">
            {formatInlineMarkdown(headerText)}
          </h3>
        );
        return;
      }

      if (trimmedLine.startsWith('#')) {
        flushParagraph();
        flushList();
        const headerText = trimmedLine.replace(/^#\s*/, '');
        elements.push(
          <h2 key={elements.length} className="text-lg font-bold mb-3 mt-4 first:mt-0 text-foreground">
            {formatInlineMarkdown(headerText)}
          </h2>
        );
        return;
      }

      // Handle list items
      if (trimmedLine.match(/^[-*]\s/)) {
        flushParagraph();
        inList = true;
        const itemText = trimmedLine.replace(/^[-*]\s*/, '');
        listItems.push(itemText);
        return;
      }

      // Regular paragraph text
      if (inList) {
        flushList();
      }
      currentParagraph.push(trimmedLine);
    });

    // Flush remaining content
    flushParagraph();
    flushList();

    return elements;
  };

  const formatInlineMarkdown = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let key = 0;

    // Match **bold**, *italic*, and `code`
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > currentIndex) {
        parts.push(text.substring(currentIndex, match.index));
      }

      const matched = match[0];
      if (matched.startsWith('**') && matched.endsWith('**')) {
        // Bold text
        parts.push(
          <strong key={key++} className="font-semibold text-foreground">
            {matched.slice(2, -2)}
          </strong>
        );
      } else if (matched.startsWith('*') && matched.endsWith('*')) {
        // Italic text
        parts.push(
          <em key={key++} className="italic">
            {matched.slice(1, -1)}
          </em>
        );
      } else if (matched.startsWith('`') && matched.endsWith('`')) {
        // Code text
        parts.push(
          <code key={key++} className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
            {matched.slice(1, -1)}
          </code>
        );
      }

      currentIndex = match.index + matched.length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      {renderContent()}
    </div>
  );
}
