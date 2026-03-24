"use client"

import { User, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type TripMode = "solo" | "group"

interface TripModeChoiceProps {
  onChoose: (mode: TripMode) => void
}

export default function TripModeChoice({ onChoose }: TripModeChoiceProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">How are you travelling?</CardTitle>
        <CardDescription>
          Choose once per session. You can change this later from the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1 h-auto py-6 flex flex-col gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900"
          onClick={() => onChoose("solo")}
        >
          <User className="size-8 text-slate-600" />
          <span className="font-semibold text-slate-800">Solo</span>
          <span className="text-xs text-slate-600 font-normal">
            Just you. SOS, geofence & authority chat.
          </span>
        </Button>
        <Button
          variant="outline"
          className="flex-1 h-auto py-6 flex flex-col gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900"
          onClick={() => onChoose("group")}
        >
          <Users className="size-8 text-slate-600" />
          <span className="font-semibold text-slate-800">Group</span>
          <span className="text-xs text-slate-600 font-normal">
            Create or join a room. Group chat & live map.
          </span>
        </Button>
      </CardContent>
    </Card>
  )
}
