import { cn } from "@/lib/utils";

/** An illustrated keepsake, never a preview of the family's private photographs. */
export function MemoryKeepsake({
  captions,
  className,
}: {
  captions: [string, string, string];
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("group relative mx-auto aspect-[1.1] w-full max-w-[490px] select-none", className)}>
      <div className="absolute inset-x-[8%] bottom-[8%] top-[8%] rounded-t-[46%] bg-secondary/55" />
      <div className="absolute left-[7%] top-[19%] w-[47%] -rotate-[9deg] border border-border bg-card p-[3%] pb-[4%] transition-transform duration-700 ease-out group-hover:-translate-y-1 motion-reduce:transition-none">
        <svg viewBox="0 0 200 230" fill="none" className="w-full" focusable="false">
          <path fill="#dddccf" d="M0 0h200v230H0z" />
          <circle cx="139" cy="64" r="27" fill="#c58e6c" />
          <path d="M0 157c35-26 65-34 101-12 35 22 59 5 99-13v98H0Z" fill="#b5b8a2" />
          <path d="M0 190c44-26 77-30 111-14 31 15 58 10 89-1v55H0Z" fill="#969e87" />
          <path d="M29 183c34-28 47-67 36-103m0 0c-20 5-23 24-13 35m13-35c19 1 25 19 18 31" stroke="#66715b" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="pt-[8%] text-center font-hand text-xl leading-none text-foreground">{captions[0]}</p>
      </div>
      <div className="absolute right-[5%] top-[10%] w-[46%] rotate-[8deg] border border-border bg-card p-[3%] pb-[4%] transition-transform duration-700 ease-out group-hover:translate-y-1 motion-reduce:transition-none">
        <svg viewBox="0 0 200 220" fill="none" className="w-full" focusable="false">
          <path fill="#e7d9c6" d="M0 0h200v220H0z" />
          <path d="M39 174V83a61 61 0 0 1 122 0v91Z" fill="#d0b39a" />
          <path d="M51 174V85a49 49 0 0 1 98 0v89Z" fill="#f0e8da" />
          <path d="M100 37v137M51 103h98" stroke="#b99a7c" strokeWidth="3" />
          <circle cx="125" cy="77" r="12" fill="#ca9470" />
          <path d="M52 153c19-17 39-19 58-9 15 8 25 7 38 1v29H52Z" fill="#aeb29d" />
          <path d="M28 174h145" stroke="#a58e76" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="pt-[8%] text-center font-hand text-xl leading-none text-foreground">{captions[1]}</p>
      </div>
      <div className="absolute bottom-[6%] left-[28%] flex w-[47%] -rotate-[3deg] flex-col items-center border border-border bg-print px-[5%] pb-[5%] pt-[7%] text-center">
        <span className="absolute -top-3 left-[31%] h-6 w-[38%] -rotate-[4deg] bg-[#d7c8aa]/70" />
        <svg viewBox="0 0 64 52" fill="none" className="mb-4 w-12 text-[#985740]" focusable="false">
          <path d="M32 43C23 36 8 27 8 16 8 4 24 3 32 15 40 3 56 4 56 16c0 11-15 20-24 27Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m23 24 6 6 13-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-hand text-2xl leading-tight text-[#51453b]">{captions[2]}</p>
      </div>
    </div>
  );
}
