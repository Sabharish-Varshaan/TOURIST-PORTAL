"use client"

import dynamic from "next/dynamic"

const ResponderMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-2xl border border-gray-200 shadow-inner flex items-center justify-center bg-gray-50">
      <div className="text-sm font-semibold text-gray-700">Loading map…</div>
    </div>
  ),
})

export default ResponderMap

