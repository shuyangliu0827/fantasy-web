// app/u/[username]/page.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { getSessionUser, listInsights } from "@/lib/store";

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;

  const sessionUser = getSessionUser();
  const allInsights = listInsights();

  const userInsights = useMemo(() => {
    return allInsights.filter(
      (i) => i.author.toLowerCase() === username.toLowerCase()
    );
  }, [allInsights, username]);

  const isSelf =
    sessionUser &&
    sessionUser.username.toLowerCase() === username.toLowerCase();

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">@{username}</h1>
        {isSelf && (
          <p className="text-sm text-gray-500 mt-1">
            This is your public profile
          </p>
        )}
      </div>

      <div className="space-y-4">
        {userInsights.length === 0 && (
          <p className="text-sm text-gray-500">No insights yet.</p>
        )}

        {userInsights.map((i) => (
          <div
            key={i.id}
            className="rounded-lg border bg-white p-4 hover:shadow-sm transition"
          >
            <h3 className="font-medium">{i.title}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(i.createdAt).toLocaleString()}
            </p>

            <div className="mt-3">
              <Link
                href={`/insights/${i.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Open →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
