import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export function ScrollArea({ className, children, ...props }: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn("ui-scroll-area", className)} {...props}>
      <ScrollAreaPrimitive.Viewport data-slot="scroll-area-viewport" className="ui-scroll-viewport">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar data-slot="scroll-area-scrollbar" className="ui-scrollbar" orientation="vertical">
        <ScrollAreaPrimitive.Thumb className="ui-scrollbar-thumb" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
