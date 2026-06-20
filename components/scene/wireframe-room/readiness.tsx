// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Fires onReady after N rendered frames — placed inside a Suspense boundary so
 * it only mounts once suspended assets (fonts) load: "assets loaded + GPU warm".
 */
export function ReadinessSignal({ onReady, frames = 5 }: { onReady: () => void; frames?: number }) {
    const count = useRef(0);
    const fired = useRef(false);
    useFrame(() => {
        if (fired.current) return;
        count.current++;
        if (count.current >= frames) {
            fired.current = true;
            onReady();
        }
    });
    return null;
}
