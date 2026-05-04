"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface TexProps {
  children: string;
  display?: boolean;
  className?: string;
}

export function Tex({ children, display = false, className }: TexProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(children, {
        displayMode: display,
        throwOnError: false,
        strict: "ignore",
        output: "html",
      });
    } catch {
      return children;
    }
  }, [children, display]);
  if (display) {
    return (
      <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
    );
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
