"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch@1.1.3";

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-gray-700 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform data-[state=checked]:translate-x-[1.35rem] data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };