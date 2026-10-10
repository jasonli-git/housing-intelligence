"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Local preview and the ZIP reports outside Pages' static redirect budget. */
export function LegacyPlaceAddress({ target }: { target: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`${target}${window.location.search}${window.location.hash}`, { scroll: false });
  }, [router, target]);
  return null;
}
