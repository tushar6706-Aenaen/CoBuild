"use client";

import { useState } from "react";
import Image from "next/image";
import { transformedStorageUrl, IMAGE_SIZES } from "@cobuild/shared";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export type GalleryImage = {
  url: string;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
};

export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-[9px] border border-[var(--color-border-subtle)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_10px,var(--color-bg-panel-alt)_10px_20px)] font-mono text-[11px] tracking-widest text-[var(--color-text-tertiary)]">
        NO SCREENSHOTS
      </div>
    );
  }

  const current = images[active];
  // `fit: "contain"` throughout — these are `object-cover`/`object-contain`
  // boxes handling the visual crop in CSS; the server-side transform must
  // never squash (width-only defaults to `resize=cover`, which distorts
  // anything not already at the requested aspect ratio).
  const heroSrc = transformedStorageUrl(current.url, { width: IMAGE_SIZES.gallery[1], fit: "contain" });
  const lightboxSrc = transformedStorageUrl(current.url, { width: IMAGE_SIZES.gallery[2], fit: "contain" });

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="group relative aspect-[16/10] cursor-zoom-in overflow-hidden rounded-[9px] border border-[var(--color-border-subtle)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_10px,var(--color-bg-panel-alt)_10px_20px)]"
      >
        <Image
          src={heroSrc}
          alt={current.alt ?? `${title} screenshot ${active + 1}`}
          fill
          unoptimized
          sizes="(min-width: 1024px) 680px, 100vw"
          className="object-cover"
          priority
        />
        <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-bg-page-rgb)/0.72)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--color-text-primary)] backdrop-blur-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          Expand
        </span>
      </button>

      {current.caption && (
        <p className="text-[12.5px] text-[var(--color-text-secondary)]">{current.caption}</p>
      )}

      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View screenshot ${i + 1}`}
              aria-current={i === active}
              className={
                i === active
                  ? "relative h-14 w-[88px] flex-none overflow-hidden rounded-[5px] border-2 border-[var(--color-accent)]"
                  : "relative h-14 w-[88px] flex-none overflow-hidden rounded-[5px] border border-[var(--color-border-default)] opacity-60 hover:opacity-100"
              }
            >
              <Image
                src={transformedStorageUrl(img.url, { width: 176, fit: "contain" })}
                alt=""
                fill
                unoptimized
                sizes="88px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[92vw] border-[var(--color-border-default)] bg-[var(--color-bg-page)] p-3 sm:max-w-[880px]">
          <DialogTitle className="sr-only">
            {current.alt ?? `${title} screenshot ${active + 1}`}
          </DialogTitle>
          <div className="relative max-h-[80vh] w-full">
            <Image
              src={lightboxSrc}
              alt={current.alt ?? `${title} screenshot ${active + 1}`}
              width={current.width ?? 1600}
              height={current.height ?? 1000}
              unoptimized
              sizes="92vw"
              className="h-auto max-h-[80vh] w-full object-contain"
            />
          </div>
          {images.length > 1 && (
            <div className="flex justify-center gap-2 pt-1">
              {images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`View screenshot ${i + 1}`}
                  className={
                    i === active
                      ? "h-1.5 w-6 rounded-full bg-[var(--color-accent)]"
                      : "h-1.5 w-1.5 rounded-full bg-[var(--color-text-placeholder)] hover:bg-[var(--color-text-secondary)]"
                  }
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
