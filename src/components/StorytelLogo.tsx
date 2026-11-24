"use client";

import React from "react";

export default function StorytelLogo({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const iconCls =
    size === "lg" ? "w-10 h-10" : size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const textCls =
    size === "lg"
      ? "text-3xl tracking-tight"
      : size === "sm"
        ? "text-lg tracking-tight"
        : "text-xl tracking-tight";

  return (
    <div className="inline-flex items-center gap-2 select-none">
      <svg
        viewBox="0 0 64 64"
        className={`${iconCls} shrink-0`}
        aria-hidden="true"
      >
        <path
          d="M32 6C17.6 6 6 17.6 6 32c0 10.7 6.4 19.9 15.6 23.9L16 61l13.2-3.4c.9.1 1.9.1 2.8.1 14.4 0 26-11.6 26-26S46.4 6 32 6z"
          fill="#FF5500"
        />
        <circle cx="32" cy="32" r="9.5" fill="#FFFFFF" />
      </svg>
      <span className={`font-extrabold lowercase st-ink ${textCls}`}>
        storytel
      </span>
    </div>
  );
}
