import React from "react"

export function PathBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-input app-border rounded-lg border p-3">
      <div className="app-text-faint">{label}</div>
      <div className="app-text-soft mt-1 break-all">{value}</div>
    </div>
  )
}
