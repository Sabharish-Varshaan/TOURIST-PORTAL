"use client";

import Image from "next/image";

interface TourismImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
  objectPosition?: string;
}

function handleImageError(src: string) {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.warn("TourismImage failed to load:", src);
  }
}

export function TourismImage({
  src,
  alt,
  fill = false,
  width,
  height,
  priority = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px",
  className = "object-cover rounded-[var(--radius-lg)]",
  objectPosition = "center",
}: TourismImageProps) {
  const commonProps = {
    src,
    alt,
    priority,
    sizes,
    className,
    style: { objectPosition } as React.CSSProperties,
    onError: () => handleImageError(src),
  };

  if (fill) {
    return <Image {...commonProps} fill />;
  }
  return (
    <Image
      {...commonProps}
      width={width ?? 800}
      height={height ?? 500}
    />
  );
}
