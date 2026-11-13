import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";

export const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];
const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" } };
const shortDate = (d: string) => d.slice(5);

function Box({ children, h = 240, label }: { children: ReactNode; h?: number; label: string }) {
  return <div role="img" aria-label={label} style={{ height: h }}><ResponsiveContainer width="100%" height="100%">{children as never}</ResponsiveContainer></div>;
}

export function VolumeArea({ data, keys, label }: { data: Record<string, string | number>[]; keys: { key: string; name: string; color: string }[]; label: string }) {
  return (
    <Box label={label}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axis} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <defs>{keys.map((k) => <linearGradient key={k.key} id={`g-${k.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={k.color} stopOpacity={0.4} /><stop offset="100%" stopColor={k.color} stopOpacity={0.02} /></linearGradient>)}</defs>
        {keys.map((k) => <Area key={k.key} isAnimationActive={false} type="monotone" dataKey={k.key} name={k.name} stackId="1" stroke={k.color} strokeWidth={1.75} fill={`url(#g-${k.key})`} />)}
      </AreaChart>
    </Box>
  );
}

export function Spark({ data, dataKey, color }: { data: Record<string, string | number>[]; dataKey: string; color: string }) {
  const id = `sp-${dataKey}`;
  return (
    <div style={{ height: 38 }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area dataKey={dataKey} type="monotone" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({ data, x, y, name, label, color = "var(--c1)" }: { data: Record<string, string | number>[]; x: string; y: string; name: string; label: string; color?: string }) {
  return (
    <Box label={label} h={220}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey={x} {...axis} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tip} cursor={{ fill: "var(--surface-2)" }} />
        <Bar isAnimationActive={false} dataKey={y} name={name} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </Box>
  );
}

export function Lines({ data, lines, label, unit = "ms" }: { data: Record<string, string | number>[]; lines: { key: string; name: string; color: string }[]; label: string; unit?: string }) {
  return (
    <Box label={label} h={220}>
      <LineChart data={data} margin={{ left: -4, right: 8, top: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axis} />
        <YAxis {...axis} unit={unit} />
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {lines.map((l) => <Line key={l.key} isAnimationActive={false} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={false} />)}
      </LineChart>
    </Box>
  );
}

export function Donut({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  return (
    <Box label={label} h={200}>
      <PieChart>
        <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="var(--surface)">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </Box>
  );
}
