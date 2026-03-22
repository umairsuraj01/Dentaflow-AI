// PageSkeleton.tsx — Loading skeleton displayed during lazy route loading.

export function PageSkeleton() {
  return (
    <div className="w-full p-6 space-y-6">
      {/* Header bar */}
      <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />

      {/* Card skeletons */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 w-full rounded-xl bg-gray-200 animate-pulse" />
        <div className="h-24 w-full rounded-xl bg-gray-200 animate-pulse" />
        <div className="h-24 w-full rounded-xl bg-gray-200 animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="h-64 w-full rounded-xl bg-gray-200 animate-pulse" />
    </div>
  );
}

export default PageSkeleton;
