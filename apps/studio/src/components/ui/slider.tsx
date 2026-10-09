import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Ngón tay chạm ngoài núm: `preventDefault` để Radix bỏ qua, trang cuộn được và giá trị không nhảy.
 * Phải chặn cả move/up vì chạm luôn được implicit pointer capture. Chuột vẫn bấm-nhảy như cũ.
 */
const offThumb = (e: React.PointerEvent) =>
  e.pointerType === "touch" && !(e.target as HTMLElement).closest("[data-slot=slider-thumb]");

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-pan-y items-center select-none data-[disabled]:opacity-50 data-[orientation=horizontal]:py-3 sm:data-[orientation=horizontal]:py-1.5 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (offThumb(e)) e.preventDefault();
      }}
      onPointerMove={(e) => {
        onPointerMove?.(e);
        if (offThumb(e)) e.preventDefault();
      }}
      onPointerUp={(e) => {
        onPointerUp?.(e);
        if (offThumb(e)) e.preventDefault();
      }}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2.5",
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          // `before` là vùng chạm 44px quanh núm — chỗ duy nhất bắt được ngón tay.
          className="relative block size-5 shrink-0 touch-none rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] before:absolute before:-inset-3 before:content-[''] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden active:ring-4 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
