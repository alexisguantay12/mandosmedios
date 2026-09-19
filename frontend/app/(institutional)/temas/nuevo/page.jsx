"use client";
import { useRouter } from "next/navigation";
import TopicForm from "@/components/TopicForm";
export default function NewTopicPage() {
  const router = useRouter();
  return (
    <div className="page-panel">
      <TopicForm
        onCancel={() => router.push("/tablero")}
        onSaved={(topic) => router.replace(`/temas/${topic.id}`)}
      />
    </div>
  );
}
