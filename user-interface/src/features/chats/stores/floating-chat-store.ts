import { create } from 'zustand';

export type FloatingChatRecipient = {
  id: string;
  username?: string;
  full_name?: string;
  avatar?: string;
  profile_picture_url?: string;
  is_online?: boolean;
  last_active?: string | null;
};

interface FloatingChatState {
  isOpen: boolean;
  activeRoomId: string | null;
  virtualRecipient: FloatingChatRecipient | null;
  hasUnreadInOtherRoom: boolean;
  
  toggleOpen: () => void;
  openRoom: (roomId: string) => void;
  openVirtualUser: (recipient: FloatingChatRecipient) => void;
  setActiveRoom: (roomId: string) => void;
  goBackToList: () => void;
  closeChat: () => void;
  setHasUnreadInOtherRoom: (hasUnread: boolean) => void;
}

export const useFloatingChatStore = create<FloatingChatState>((set) => ({
  isOpen: false,
  activeRoomId: null,
  virtualRecipient: null,
  hasUnreadInOtherRoom: false,

  toggleOpen: () =>
    set((state) => ({
      isOpen: !state.isOpen,
      // Khi đóng cửa sổ, ta có thể giữ nguyên activeRoomId để lần mở sau nó vẫn ở phòng đó
      // hoặc reset về null tuỳ nghiệp vụ. Theo Facebook thì khi đóng thường giữ lại.
      // Dấu X sẽ đóng cửa sổ hoàn toàn.
    })),

  openRoom: (roomId: string) =>
    set(() => ({
      activeRoomId: roomId,
      virtualRecipient: null,
      isOpen: true,
      hasUnreadInOtherRoom: false, // Reset khi mở phòng mới
    })),

  openVirtualUser: (recipient: FloatingChatRecipient) =>
    set(() => ({
      activeRoomId: null,
      virtualRecipient: recipient,
      isOpen: true,
      hasUnreadInOtherRoom: false,
    })),

  setActiveRoom: (roomId: string) =>
    set(() => ({
      activeRoomId: roomId,
      virtualRecipient: null,
      isOpen: true,
    })),

  goBackToList: () =>
    set(() => ({
      activeRoomId: null,
      virtualRecipient: null,
      hasUnreadInOtherRoom: false, // Bấm back thì xoá cờ đỏ
    })),

  closeChat: () =>
    set(() => ({
      isOpen: false,
    })),

  setHasUnreadInOtherRoom: (hasUnread: boolean) =>
    set(() => ({
      hasUnreadInOtherRoom: hasUnread,
    })),
}));
