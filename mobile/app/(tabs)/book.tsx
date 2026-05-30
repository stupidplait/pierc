import { useEffect, useRef } from "react";
import {
  PiercWebView,
  type PiercWebViewHandle,
} from "@/components/PiercWebView";
import { urlFor, TABS } from "@/constants/config";
import { registerTabWebView } from "@/lib/tab-registry";

export default function BookTab() {
  const ref = useRef<PiercWebViewHandle>(null);
  useEffect(() => {
    registerTabWebView("book", ref.current);
    return () => registerTabWebView("book", null);
  }, []);
  return <PiercWebView ref={ref} source={urlFor(TABS.book.path)} />;
}
