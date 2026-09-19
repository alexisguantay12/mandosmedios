"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import TopicDetail from "@/components/TopicDetail";
export default function TopicPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  return (
    <div className="page-panel">
      <TopicDetail id={id} onBack={() => router.push("/tablero")} />
    </div>
  );
}
