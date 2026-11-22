"use client";

import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function RecapStats({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.08, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="rounded-xl border bg-card p-5"
        >
          <CountUp value={stat.value} className="block font-display text-3xl font-normal tabular-nums tracking-tight lg:text-4xl xl:text-5xl" />
          <span className="text-sm font-semibold text-muted-foreground">{stat.label}</span>
        </motion.div>
      ))}
    </div>
  );
}

function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration: 1.2, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
    </span>
  );
}

export function RecapFacts({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {facts.map((fact, index) => (
        <motion.div
          key={fact.label}
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + index * 0.08, duration: 0.45 }}
          className="rounded-xl bg-accent p-5 text-accent-foreground"
        >
          <p className="text-xs font-bold uppercase tracking-[0.12em]">{fact.label}</p>
          <p className="mt-1 font-display text-3xl font-medium leading-tight text-foreground [overflow-wrap:anywhere]">{fact.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
