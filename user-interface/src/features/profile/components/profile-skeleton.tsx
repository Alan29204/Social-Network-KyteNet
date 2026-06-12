import { Skeleton } from '@/components/ui/skeleton';

export function ProfileSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 relative">
        {/* Cover Photo Skeleton */}
        <Skeleton className="w-full h-48 md:h-64 rounded-2xl" />

        {/* Profile Info Section Skeleton */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 px-4 sm:px-8 -mt-16 md:-mt-20 relative z-10">
          <div className="flex-shrink-0">
            <Skeleton className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background" />
          </div>
          
          <div className="flex-grow flex flex-col gap-4 mt-2 md:mt-20 w-full">
            <div className="flex flex-col md:flex-row items-center gap-4 w-full">
              <Skeleton className="h-8 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-9" />
              </div>
            </div>

            <div className="flex gap-6 justify-center md:justify-start w-full">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-32" />
            </div>

            <div className="space-y-2 w-full flex flex-col items-center md:items-start">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t">
        {/* Tabs Skeleton */}
        <div className="flex gap-8 border-b">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
        
        {/* Content Skeleton */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}
