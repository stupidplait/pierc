import { useEffect, useRef } from "react";
import {
  PiercWebView,
  type PiercWebViewHandle,
} from "@/components/PiercWebView";
import { urlFor, TABS } from "@/constants/config";
import { registerTabWebView } from "@/lib/tab-registry";

export default function AccountTab() {
  const ref = useRef<PiercWebViewHandle>(null);
  useEffect(() => {
    registerTabWebView("account", ref.current);
    return () => registerTabWebView("account", null);
  }, []);
  return <PiercWebView ref={ref} source={urlFor(TABS.account.path)} />;
}
