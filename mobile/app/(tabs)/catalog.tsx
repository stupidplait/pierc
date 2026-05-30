import { useEffect, useRef } from "react";
import {
  PiercWebView,
  type PiercWebViewHandle,
} from "@/components/PiercWebView";
import { urlFor, TABS } from "@/constants/config";
import { registerTabWebView } from "@/lib/tab-registry";

export default function CatalogTab() {
  const ref = useRef<PiercWebViewHandle>(null);
  useEffect(() => {
    registerTabWebView("catalog", ref.current);
    return () => registerTabWebView("catalog", null);
  }, []);
  return <PiercWebView ref={ref} source={urlFor(TABS.catalog.path)} />;
}
