"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function InsightsDetailRedirect() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  useEffect(() => { if (id) router.replace(`/discover/${id}`); }, [router, id]);
  return null;
}
