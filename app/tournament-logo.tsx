import Image from "next/image";

export function TournamentLogo({
  className = "",
  header = false,
}: {
  className?: string;
  header?: boolean;
}) {
  return (
    <Image
      className={`tournament-logo ${className}`}
      src={header ? "/logo.svg" : "/Artboard%201-8.png"}
      alt="ROAD TO BAL"
      width={header ? 45 : 1920}
      height={header ? 45 : 1921}
      unoptimized={header}
      sizes="(max-width: 600px) 52px, 76px"
    />
  );
}
