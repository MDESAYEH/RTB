import Image from "next/image";

export function TournamentLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      className={`tournament-logo ${className}`}
      src="/Artboard%201-8.png"
      alt="ROAD TO BAL"
      width={1920}
      height={1921}
      sizes="(max-width: 600px) 52px, 76px"
    />
  );
}
