import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

type RootProps = React.ComponentProps<typeof SliderPrimitive.Root>;
type SliderProps = Omit<RootProps, "value" | "defaultValue" | "onValueChange" | "onValueCommit"> & {
  value: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  thumbLabel: string;
};

export function Slider({ className, value, onValueChange, onValueCommit, thumbLabel, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("ui-slider", className)}
      value={[value]}
      onValueChange={values => onValueChange(values[0] ?? 0)}
      onValueCommit={values => onValueCommit?.(values[0] ?? 0)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="ui-slider-track">
        <SliderPrimitive.Range data-slot="slider-range" className="ui-slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb data-slot="slider-thumb" className="ui-slider-thumb" aria-label={thumbLabel} />
    </SliderPrimitive.Root>
  );
}
