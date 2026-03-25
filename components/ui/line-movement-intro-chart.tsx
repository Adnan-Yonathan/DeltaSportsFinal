'use client';

import * as React from 'react';
import { TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/line-charts-9';
import type { ChartConfig } from '@/components/ui/line-charts-9';

const lineMovementData = [
  { time: '09:00', line: -4.5 },
  { time: '10:00', line: -4.5 },
  { time: '11:00', line: -5.0 },
  { time: '12:00', line: -5.5 },
  { time: '13:00', line: -5.5 },
  { time: '14:00', line: -6.0 },
  { time: '15:00', line: -6.5 },
  { time: '16:00', line: -6.0 },
  { time: '17:00', line: -6.5 },
  { time: '18:00', line: -7.0 },
  { time: '19:00', line: -7.5 },
  { time: '20:00', line: -7.0 },
];

const chartConfig = {
  line: {
    label: 'Spread',
    color: '#3CCB97',
  },
} satisfies ChartConfig;

type TooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: {
      time: string;
      line: number;
    };
  }>;
};

function LineMovementTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const formattedLine = row.line > 0 ? `+${row.line.toFixed(1)}` : row.line.toFixed(1);

  return (
    <div className="rounded-md border border-emerald-300/25 bg-black/90 px-2.5 py-2 text-xs shadow-[0_8px_20px_rgba(0,0,0,0.5)]">
      <p className="text-white/70">{row.time}</p>
      <p className="font-semibold text-emerald-300">Line {formattedLine}</p>
    </div>
  );
}

export function LineMovementIntroChart() {
  return (
    <div className="intro-chart pointer-events-none mx-auto mt-5 w-full max-w-2xl rounded-2xl border border-emerald-300/20 bg-black/50 p-3 backdrop-blur-md shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
            Line movement
          </span>
          <span className="text-[11px] text-white/65">Today</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-emerald-300">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Steam up</span>
        </div>
      </div>
      <ChartContainer config={chartConfig} className="h-40 w-full">
        <LineChart
          data={lineMovementData}
          margin={{
            top: 8,
            right: 8,
            left: -24,
            bottom: 0,
          }}
        >
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.10)" strokeDasharray="3 6" />
          <ReferenceLine y={-6.5} stroke="#3CCB97" strokeDasharray="4 4" strokeOpacity={0.45} />
          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.66)' }} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.56)' }}
            tickFormatter={(value: number) => (value > 0 ? `+${value}` : `${value}`)}
            domain={[-8, -4]}
          />
          <ChartTooltip content={<LineMovementTooltip />} cursor={{ stroke: 'rgba(60,203,151,0.45)', strokeDasharray: '3 3' }} />
          <Line
            type="monotone"
            dataKey="line"
            stroke={chartConfig.line.color}
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 5, fill: '#3CCB97', stroke: '#0b0f12', strokeWidth: 2 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

