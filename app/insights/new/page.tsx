"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InsightsNewRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/discover/new"); }, [router]);
  return null;
}
