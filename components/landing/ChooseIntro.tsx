"use client";

import { forwardRef } from "react";

const ChooseIntro = forwardRef<HTMLElement>(function ChooseIntro(_, ref) {
    return (
        <section
            ref={ref}
            aria-hidden="true"
            className="relative h-[100svh] w-full pointer-events-none"
        />
    );
});

export default ChooseIntro;
export { ChooseIntro };
