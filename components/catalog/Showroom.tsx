"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { JewelryBookingDrawer } from "@/components/booking/JewelryBookingDrawer";
import {
    type AnchorWire,
    type EquippedMap,
    type JewelryWire,
    SOFT_CAP,
} from "@/lib/catalog/types";
import type { BookingUser, WizardJewelry } from "@/lib/booking/wizard-types";
import { serializeEquipped } from "@/lib/catalog/url-state";
import { CATALOG_DESIGN } from "@/lib/catalog/lab-state";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";
import { useIsDesktop } from "@/lib/catalog/use-is-desktop";
import type { CatalogViewProps } from "./views/parts";
import { ShowroomShell } from "./ShowroomShell";
import { DetailModal } from "./inspect/DetailModal";

// LiteMode (selfie/photo try-on) is the WebGL2-unsupported fallback — only a
// minority path. Load it on demand so SelfieCanvas + its deps never ship to
// WebGL2-capable visitors (the heavy mediapipe runtime is already deferred via
// a runtime `await import()` inside lib/lite/face-landmarker.ts).
const LiteMode = dynamic(
  () => import("@/components/lite/LiteMode").then((mod) => mod.LiteMode),
  { ssr: false },
);

interface ShowroomProps {
    anchors: AnchorWire[];
    jewelry: JewelryWire[];
    initialSelectedId: string | null;
    initialEquipped: EquippedMap;
    /** Piece to open in the inspect overlay on load, from the ?inspect= deep link. */
    initialInspectId?: string | null;
    /**
     * Where to write URL state when the user interacts. The Showroom is rendered
     * on `/catalog`; each owns its own search-param contract on its own pathname.
     */
    pathname?: string;
    /** Hide the "Простой каталог" link in the corner (unused by /catalog today). */
    hideGridLink?: boolean;
    /** Signed-in user, used to prefill the booking drawer's contact fields. */
    user?: BookingUser | null;
}

export function Showroom({
    anchors,
    jewelry,
    initialSelectedId,
    initialEquipped,
    initialInspectId = null,
    pathname = "/catalog",
    hideGridLink = false,
    user = null,
}: ShowroomProps) {
    const { replace, push } = useRouter();
    const [, startTransition] = useTransition();

    const [selectedId, setSelectedId] = useState<string | null>(
        initialSelectedId,
    );
    const [equipped, setEquipped] = useState<EquippedMap>(initialEquipped);
    const [bookingOpen, setBookingOpen] = useState(false);
    const webgl2Supported = useWebGL2Supported();
    const isDesktop = useIsDesktop();

    // The catalog design is locked to a single combination — no variant lab, URL
    // params, or switcher anymore. `inspectId` is the piece open in the inspect
    // overlay: pure client state, not deep-linked.
    const lab = CATALOG_DESIGN;
    const [inspectId, setInspectId] = useState<string | null>(initialInspectId);

    // Distinct jewelry pieces in the tray (a multi-anchor piece counts once),
    // shaped for the booking drawer.
    const bookingItems = useMemo<WizardJewelry[]>(() => {
        const seen = new Set<string>();
        const out: WizardJewelry[] = [];
        for (const jewelryId of Object.values(equipped)) {
            if (seen.has(jewelryId)) continue;
            seen.add(jewelryId);
            const j = jewelry.find((x) => x.id === jewelryId);
            if (j) {
                out.push({
                    id: j.id,
                    name: j.name,
                    price: j.price,
                    photo: j.photo,
                    inStock: j.inStock,
                });
            }
        }
        return out;
    }, [equipped, jewelry]);

    const anchorIdToSlug = useMemo(() => {
        const m = new Map<string, string>();
        for (const a of anchors) m.set(a.id, a.slug);
        return m;
    }, [anchors]);

    // Track previous query string to avoid unnecessary URL updates
    const prevQueryRef = useRef<string>("");

    // Sync URL after state changes — runs after render, not during. Only the
    // showroom's own try-on state (focused anchor + equipped tray) is deep-linked
    // now; the design axes are constants and the inspect overlay is local.
    useEffect(() => {
        const params = new URLSearchParams();

        const slugForAnchor = selectedId
            ? anchorIdToSlug.get(selectedId)
            : null;
        if (slugForAnchor) params.set("anchor", slugForAnchor);

        const eqStr = serializeEquipped(equipped, anchorIdToSlug);
        if (eqStr) params.set("eq", eqStr);

        // The inspect overlay is deep-linked so it survives refresh / back and
        // can be shared. (In `page` detail mode clicking navigates instead, so
        // inspectId stays null and this key is never written.)
        if (inspectId) params.set("inspect", inspectId);

        const qs = params.toString();

        if (qs !== prevQueryRef.current) {
            prevQueryRef.current = qs;
            startTransition(() => {
                replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
            });
        }
    }, [selectedId, equipped, inspectId, anchorIdToSlug, pathname, replace]);

    const handleSelectAnchor = useCallback((id: string | null) => {
        setSelectedId(id);
    }, []);

    const handleEquip = useCallback((anchorId: string, jewelryId: string) => {
        setEquipped((prev) => {
            if (Object.keys(prev).length >= SOFT_CAP && !(anchorId in prev)) {
                return prev;
            }
            return { ...prev, [anchorId]: jewelryId };
        });
    }, []);

    const handleUnequip = useCallback((anchorId: string) => {
        setEquipped((prev) => {
            if (!(anchorId in prev)) return prev;
            const next = { ...prev };
            delete next[anchorId];
            return next;
        });
    }, []);

    // Clicking a piece: in `page` mode navigate to the standalone detail route;
    // otherwise open the in-catalog inspect overlay (deep-linked via ?inspect=).
    const handleInspect = useCallback(
        (jewelryId: string) => {
            if (lab.detail === "page") push(`/catalog/${jewelryId}`);
            else setInspectId(jewelryId);
        },
        [lab.detail, push],
    );

    // Equip-from-inspect: drop the piece on its primary anchor, focus there so the
    // camera frames the try-on, then close the overlay.
    const handleInspectEquip = useCallback(
        (jewelryId: string) => {
            const piece = jewelry.find((j) => j.id === jewelryId);
            const anchorId = piece?.anchorBindings[0]?.anchorId;
            if (anchorId) {
                handleEquip(anchorId, jewelryId);
                setSelectedId(anchorId);
            }
            setInspectId(null);
        },
        [jewelry, handleEquip],
    );

    const inspectPiece = inspectId
        ? (jewelry.find((j) => j.id === inspectId) ?? null)
        : null;

    // WebGL2 capability check — render lite mode (selfie + sprite overlay) when 3D
    // isn't available. `?view=grid` opt-in is handled at the page level.
    if (webgl2Supported === false) {
        return (
            <LiteMode
                anchors={anchors}
                jewelry={jewelry}
                initialEquipped={initialEquipped}
                initialSelectedId={initialSelectedId}
                pathname={pathname}
                user={user}
            />
        );
    }

    const viewProps: CatalogViewProps = {
        anchors,
        jewelry,
        selectedAnchorId: selectedId,
        equipped,
        canBook: bookingItems.length > 0,
        onBook: () => setBookingOpen(true),
        onSelectAnchor: handleSelectAnchor,
        onEquip: handleEquip,
        onUnequip: handleUnequip,
        hideGridLink,
        cardVariant: "frame",
        env: lab.env,
        hud: lab.hud,
        place: lab.place,
        info: lab.info,
        bg: lab.bg,
        dots: lab.dots,
        cardview: lab.cardview,
        cardtx: lab.cardtx,
        loader: lab.loader,
        detail: lab.detail,
        user,
        onInspect: handleInspect,
        inspectId,
        onInspectClose: () => setInspectId(null),
        onInspectEquip: handleInspectEquip,
    };

    // The rail shows the detail INSIDE the panel; every other layout (incl. the
    // mobile hotbar) uses the centered overlay. So inline detail only applies on
    // desktop where the rail is actually rendered — otherwise mobile taps set
    // inspectId but nothing shows. `page` mode never opens an in-app detail.
    const railInlineDetail =
      isDesktop && lab.cards === "rail" && lab.detail !== "page";

    return (
        <>
            <ShowroomShell {...viewProps} cards={lab.cards} />

            <DetailModal
                piece={railInlineDetail ? null : inspectPiece}
                anchors={anchors}
                user={user}
                detail={lab.detail}
                loader={lab.loader}
                onClose={() => setInspectId(null)}
                onEquip={handleInspectEquip}
            />

            <JewelryBookingDrawer
                open={bookingOpen}
                onClose={() => setBookingOpen(false)}
                items={bookingItems}
                user={user}
            />
        </>
    );
}
