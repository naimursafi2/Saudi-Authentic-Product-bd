import { getPasswordStrength } from "@/lib/passwordStrength";
import { cn } from "@/lib/utils";

const BAR_COLOR: Record<string, string> = {
  "Too short": "bg-brown-500/20",
  Weak: "bg-[#8a4a3f]",
  Fair: "bg-gold-500",
  Strong: "bg-green-900",
};

const LABEL_COLOR: Record<string, string> = {
  "Too short": "text-brown-500",
  Weak: "text-[#8a4a3f]",
  Fair: "text-gold-700",
  Strong: "text-green-900",
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, label } = getPasswordStrength(password);

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("h-1 flex-1 rounded-full transition-colors", i < score ? BAR_COLOR[label] : "bg-brown-500/15")}
          />
        ))}
      </div>
      <p className={cn("mt-1 text-xs font-medium", LABEL_COLOR[label])}>
        {label === "Too short" ? "At least 8 characters" : `${label} password`}
        {label !== "Strong" && label !== "Too short" && " — add an uppercase letter, number or symbol"}
      </p>
    </div>
  );
}
