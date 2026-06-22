import type { QueryClient, QueryKey } from '@tanstack/react-query';

type RoomListType = 'primary' | 'requests';

const getRoomListType = (queryKey: QueryKey): RoomListType => {
  const params =
    queryKey[0] === 'infinite' ? (queryKey[2] as any) : (queryKey[1] as any);
  return params?.type === 'requests' ? 'requests' : 'primary';
};

export const isChatRoomsQueryKey = (queryKey: QueryKey) =>
  queryKey[0] === '/chat-rooms' ||
  (queryKey[0] === 'infinite' && queryKey[1] === '/chat-rooms');

const getCurrentMember = (room: any, currentUserId?: string) =>
  room?.members?.find((member: any) => member.id === currentUserId);

const isRoomRequestForUser = (room: any, currentUserId?: string) => {
  const currentMember = getCurrentMember(room, currentUserId);
  return (
    room?.is_request === true ||
    currentMember?.status === 'pending' ||
    currentMember?.status === 'PENDING'
  );
};

const roomBelongsToList = (
  room: any,
  listType: RoomListType,
  currentUserId?: string,
) => {
  const isRequest = isRoomRequestForUser(room, currentUserId);
  return listType === 'requests' ? isRequest : !isRequest;
};

const sortRoomsByLastActivity = (rooms: any[]) =>
  [...rooms].sort((a, b) => {
    const aTime = new Date(a.last_message_at || a.created_at || 0).getTime();
    const bTime = new Date(b.last_message_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });

const updateRoomsInPayload = (
  payload: any,
  updater: (rooms: any[], listType: RoomListType) => any[],
  listType: RoomListType,
) => {
  if (!payload) return payload;

  if (Array.isArray(payload?.data?.data)) {
    return {
      ...payload,
      data: {
        ...payload.data,
        data: updater(payload.data.data, listType),
      },
    };
  }

  if (Array.isArray(payload?.data)) {
    return {
      ...payload,
      data: updater(payload.data, listType),
    };
  }

  if (Array.isArray(payload?.pages)) {
    return {
      ...payload,
      pages: payload.pages.map((page: any, index: number) =>
        index === 0 ? updateRoomsInPayload(page, updater, listType) : page,
      ),
    };
  }

  return payload;
};

export const updateChatRoomCaches = (
  queryClient: QueryClient,
  updater: (rooms: any[], listType: RoomListType) => any[],
) => {
  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => isChatRoomsQueryKey(query.queryKey),
  });

  queries.forEach((query) => {
    const listType = getRoomListType(query.queryKey);
    queryClient.setQueryData(query.queryKey, (old: any) =>
      updateRoomsInPayload(old, updater, listType),
    );
  });
};

export const upsertChatRoomInCaches = (
  queryClient: QueryClient,
  room: any,
  currentUserId?: string,
) => {
  if (!room?.id) return;

  updateChatRoomCaches(queryClient, (rooms, listType) => {
    const withoutRoom = rooms.filter((item: any) => item.id !== room.id);
    if (!roomBelongsToList(room, listType, currentUserId)) {
      return withoutRoom;
    }

    return sortRoomsByLastActivity([room, ...withoutRoom]);
  });
};

export const patchChatRoomInCaches = (
  queryClient: QueryClient,
  roomId: string,
  patch: Record<string, unknown>,
) => {
  updateChatRoomCaches(queryClient, (rooms) =>
    rooms.map((room: any) => (room.id === roomId ? { ...room, ...patch } : room)),
  );
};

export const removeChatRoomFromCaches = (
  queryClient: QueryClient,
  roomId: string,
) => {
  updateChatRoomCaches(queryClient, (rooms) =>
    rooms.filter((room: any) => room.id !== roomId),
  );
};
