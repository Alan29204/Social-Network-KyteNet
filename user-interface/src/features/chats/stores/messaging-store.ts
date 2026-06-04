import { create } from 'zustand';

interface MessagingState {
  // Local caching for hybrid search
  activeChats: any[];

  // Selected chat room
  selectedRoomId: string | null;
  
  // Actions
  setActiveChats: (chats: any[]) => void;
  setSelectedRoomId: (roomId: string | null) => void;
}

export const useMessagingStore = create<MessagingState>((set) => ({
  activeChats: [],
  selectedRoomId: null,

  setActiveChats: (chats) => set({ activeChats: chats }),
  setSelectedRoomId: (roomId) => set({ selectedRoomId: roomId }),
}));
