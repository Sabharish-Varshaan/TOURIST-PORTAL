"use client"

import { useChat } from "@/lib/chat"
import ChatPanel from "./chat-panel"
import { Card, CardContent } from "@/components/ui/card"
import { Users } from "lucide-react"

interface GroupRoomChatProps {
  touristId: string
  roomId: string
  roomName?: string | null
}

export default function GroupRoomChat({ touristId, roomId, roomName }: GroupRoomChatProps) {
  const thread = { thread_type: "group_room" as const, room_id: roomId, tourist_id: touristId }
  const { messages, connected, sendMessage } = useChat(thread)

  return (
    <Card className="bg-white rounded-3xl shadow-xl border border-gray-100">
      <CardContent className="p-6">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {roomName ? `Group Chat · ${roomName}` : "Group Chat"}
          </h3>
          <p className="text-xs text-gray-600">Chat with your travel group members.</p>
        </div>
        <ChatPanel
          title="Room messages"
          messages={messages}
          connected={connected}
          onSend={(body) => sendMessage(body, "tourist", touristId)}
          senderRole="tourist"
          senderId={touristId}
        />
      </CardContent>
    </Card>
  )
}
