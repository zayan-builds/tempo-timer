import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TimerScreen } from "@/components/TimerScreen";

export default function Page() {
  return (
    <ErrorBoundary>
      <TimerScreen />
    </ErrorBoundary>
  );
}
