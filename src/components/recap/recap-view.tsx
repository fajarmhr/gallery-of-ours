"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useFormatter } from "next-intl";
import { useEffect, useRef } from "react";

export function RecapStats({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.08, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex min-w-0 flex-col gap-2 bg-card p-5 sm:p-6"
        >
          <dt className="order-last text-sm font-medium text-muted-foreground">{stat.label}</dt>
          <dd><CountUp value={stat.value} className="block font-display text-3xl font-normal tabular-nums tracking-tight sm:text-4xl" /></dd>
        </motion.div>
      ))}
    </dl>
  );
}

function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reducedMotion = useReducedMotion();
  const format = useFormatter();

  useEffect(() => {
    const element = ref.current;
    if (!element || !inView || reducedMotion) return;
    const controls = animate(0, value, {
      duration: 0.7,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => { element.textContent = format.number(Math.round(v)); },
    });
    return () => {
      controls.stop();
      element.textContent = format.number(value);
    };
  }, [inView, value, reducedMotion, format]);

  return (
    <span ref={ref} className={className}>
      {format.number(value)}
    </span>
  );
}

export function RecapFacts({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-6 border-b py-6 sm:grid-cols-3">
      {facts.map((fact, index) => (
        <motion.div
          key={fact.label}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + index * 0.08, duration: 0.45 }}
          className="min-w-0"
        >
          <dt className="text-sm text-muted-foreground">{fact.label}</dt>
          <dd className="mt-2 font-display text-2xl font-medium leading-tight [overflow-wrap:anywhere]">{fact.value}</dd>
        </motion.div>
      ))}
    </dl>
  );
}
