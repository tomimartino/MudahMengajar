import { Logo } from "@/components/shared/logo";
import { LearningIllustration } from "@/components/shared/learning-illustration";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-8 sm:px-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft lg:grid-cols-2">
        <div className="flex flex-col bg-mint p-7 sm:p-10 lg:p-12">
          <Logo />
          <div className="my-auto hidden py-8 lg:block">
            <LearningIllustration className="mx-auto w-full max-w-xs" />
          </div>
        </div>
        <div className="flex items-center justify-center px-6 py-9 sm:p-10 lg:p-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
