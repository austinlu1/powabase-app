import { CpuChipIcon } from "@heroicons/react/24/outline";

interface AgentAvatarProps {
  color?: string;
  emoji?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { container: "w-7 h-7", icon: "w-3.5 h-3.5", text: "text-sm" },
  md: { container: "w-10 h-10", icon: "w-5 h-5", text: "text-lg" },
  lg: { container: "w-12 h-12", icon: "w-6 h-6", text: "text-xl" },
};

export default function AgentAvatar({ color = "#2563eb", emoji, size = "md" }: AgentAvatarProps) {
  const s = sizes[size];
  return (
    <div
      className={`${s.container} rounded-xl flex items-center justify-center shrink-0`}
      style={{ backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
    >
      {emoji ? (
        <span className={s.text}>{emoji}</span>
      ) : (
        <CpuChipIcon className={s.icon} style={{ color }} />
      )}
    </div>
  );
}
