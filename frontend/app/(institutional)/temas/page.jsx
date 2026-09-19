import { Suspense } from "react";
import TopicWorkspace from "@/components/TopicWorkspace";
import { Loading } from "@/components/UI";
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <TopicWorkspace mode="list" />
    </Suspense>
  );
}
