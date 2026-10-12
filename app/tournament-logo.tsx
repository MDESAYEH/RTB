import Image from "next/image";

export function TournamentLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      className={`tournament-logo ${className}`}
      src="/logo.svg"
      alt="ROAD TO BAL"
      width={45}
      height={45}
      unoptimized
      sizes="(max-width: 600px) 52px, 76px"
    />
  );
}
