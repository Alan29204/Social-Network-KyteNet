import { create } from 'zustand';

interface FloatingChatState {
  isOpen: boolean;
  activeRoomId: string | null;
  hasUnreadInOtherRoom: boolean;
  
  toggleOpen: () => void;
  openRoom: (roomId: string) => void;
  goBackToList: () => void;
  closeChat: () => void;
  setHasUnreadInOtherRoom: (hasUnread: boolean) => void;
}

export const useFloatingChatStore = create<FloatingChatState>((set) => ({
  isOpen: false,
  activeRoomId: null,
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
      isOpen: true,
      hasUnreadInOtherRoom: false, // Reset khi mở phòng mới
    })),

  goBackToList: () =>
    set(() => ({
      activeRoomId: null,
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
