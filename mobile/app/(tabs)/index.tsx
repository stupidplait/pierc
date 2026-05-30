import { useEffect, useRef } from "react";
import {
  PiercWebView,
  type PiercWebViewHandle,
} from "@/components/PiercWebView";
import { urlFor, TABS } from "@/constants/config";
import { registerTabWebView } from "@/lib/tab-registry";

export default function HomeTab() {
  const ref = useRef<PiercWebViewHandle>(null);
  useEffect(() => {
    registerTabWebView("home", ref.current);
    return () => registerTabWebView("home", null);
  }, []);
  return <PiercWebView ref={ref} source={urlFor(TABS.home.path)} />;
}
