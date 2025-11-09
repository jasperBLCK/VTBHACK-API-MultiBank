"use client"

import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Transaction } from '@/types'

interface Props {
  transactions: Transaction[]
}

const formatMonth = (d: Date) => {
  return d.toLocaleString('ru-RU', { month: 'short', year: 'numeric' })
}

export default function MetricsGraph({ transactions }: Props) {
  // Aggregate by month (last 6 months)
  const now = new Date()
  const months: { key: string; date: Date }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, date: d })
  }

  const data = months.map(m => {
    const start = new Date(m.date.getFullYear(), m.date.getMonth(), 1)
    const end = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 1)
    const total = transactions
      .filter(t => new Date(t.date) >= start && new Date(t.date) < end)
      .reduce((s, t) => s + (t.amount || 0), 0)
    return { name: formatMonth(m.date), value: Math.round(total * 100) / 100 }
  })

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#4F46E5" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
