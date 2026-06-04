Created At: 2026-06-03T22:25:10Z
Completed At: 2026-06-03T22:25:10Z
File Path: `file:///c:/Users/Dell/Desktop/DATN/social-network-cnet/user-interface/src/features/chats/pages/messages-page.tsx`
Total Lines: 1847
Total Bytes: 75136
Showing lines 1601 to 1847
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
1601:                         className="absolute top-1 right-1 bg-black/75 hover:bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
1602:                       >
1603:                         ✕
1604:                       </button>
1605:                     </div>
1606:                   );
1607:                 })}
1608:               </div>
1609:             )}
1610: 
1611:             {/* Reply bar */}
1612:             {replyingTo && (
1613:               <div className="px-4 py-2 border-t border-border/40 bg-muted/30 flex items-center gap-3 shrink-0 animate-in slide-in-from-bottom-1 duration-150">
1614:                 <div className="w-1 h-10 bg-[#0084ff] rounded-full shrink-0" />
1615:                 <div className="flex-1 min-w-0">
1616:                   <p className="text-xs font-semibold text-[#0084ff]">
1617:                     Đang trả lời {replyingTo.user?.full_name || replyingTo.user?.username || 'người dùng'}
1618:   
  const [messageInput, setMessageInput] = useState('');
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { 
    activeChats, setActiveChats,
    selectedRoomId, setSelectedRoomId 
  } = useMessagingStore();
// MISSING LINE 34
  // 1. Fetch dat
                    id: 'temp-pin-' + Date.now(),
                    chat_room_id: selectedRoomId,
                    chat_message_id: msg.id,
                  }
                : null,
1811:               onClick={async () => {
1812:                 for (const targetRoomId of forwardTargets) {
1813:                   try {
1814:                     await createMessageMutation.mutateAsync({
1815:                       data: {
1816:                         chat_room_id: targetRoomId,
1817:                         message: forwardingMsg.message || '',
1818:                       },
1819:                     });
1820:                     updateSidebarWithMessage(targetRoomId, {
1821:                       message: forwardingMsg.message || '📷 Ảnh',
1822:                       created_by: user?.id,
1823:                       created_at: new Date().toISOString(),
1824:                     });
1825:                     queryClient.invalidateQueries({
1826:                       queryKey: getChatMessagesControllerGetMessageHistoryQueryKey(targetRoomId),
1827:                     });
1828:                   } catch (error) {
1829:                     console.error('Forward failed:', error);
1830:                   }
1831:                 }
1832:                 setForwardingMsg(null);
1833:                 setForwardTargets([]);
1834:                 setForwardSearch('');
1835:                 toast({ title: 'Đã chuyển tiếp', description: `Chuyển tiếp tới ${forwardTargets.length} cuộc trò chuyện` });
1836:               }}
1837:             >
1838:               Gửi
1839:             </button>
1840:           </div>
1841:         </div>
1842:       </div>
1843:     )}
1844:     </>
1845:   );
1846: }
1847: 
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
// MISSING LINE 79
                title: 'Lỗi',
                description: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
                variant: 'destructive',
              });
            },
          },
        );
      }
    }
  };
// MISSING LINE 90
  // Direct Heart click
  /**
   * Toggle emoji reaction on a message via REST API.
   */
  const handleToggleReaction = async (messageId: string, reactionType: string) => {
    try {
      await orvalClient(`/chat-messages/${messageId}/reactions`, {
        method: 'POST',
        data: { reaction_type: reactionType },
      });
- [chat-message.entity.ts](file:///c:/Users/Dell/Desktop/DATN/social-network-cnet/core-api/src/modules/chats/entities/chat-message.entity.ts) — `reactions` OneToMany relation
- [chat-messages.service.ts](file:///c:/Users/Dell/Desktop/DATN/social-network-cnet/core-api/src/modules/chats/chat-messages.service.ts) — `toggleReaction()`, `reactionRepository`
- [chat-messages.controller.ts](file:///c:/Users/Dell/Desktop/DATN/social-network-cnet/core-api/src/modules/chats/chat-messages.controller.ts) — `POST :id/reactions`
- [chat.module.ts](file:///c:/Users/Dell/Desktop/DATN/social-network-cnet/core-api/src/modules/chats/chat.module.ts) — `MessageReaction` registered
- [messages-page.tsx](file:///c:/Users/Dell/Desktop/DATN/social-network-cnet/user-interface/src/features/chats/pages/messages-page.tsx) — reaction UI
// MISSING LINE 106
---
// MISSING LINE 108
## UI Refinement & Interaction Fixes
// MISSING LINE 110
| Feature | Fix / Refinement |
|:--------|:-----------------|
| **Optimistic Reactions** | Implemented React Query cache update in `handleToggleReaction` to immediately add, update, or remove reaction badges before the REST API responds. Reverts on failure. |
| **Reaction Overlay Positioning** | Absolute positioned the reaction pill (`-bottom-2.5 right-2` for own messages, `left-2` for others) to overlap the bottom corner of message bubbles. Added dynamic row `marginBottom` to prevent overlap with the row below. |
| **Quoted Reply Styling** | Redesigned replies to match the mockup: moved quoted message preview above the main message bubble, added a small text header (`Bạn đã trả lời [Name]` or `[Name] đã trả lời [Name]`), and formatted the quoted text inside a small neutral-colored pill bubble. |
| **Reply State Management** | Ensured `replyingTo` state clears immediately upon sending (both for WebSocket & REST pathways) and resets when switching chat rooms. |
// MISSING LINE 117
---
// MISSING LINE 119
## Verification
// MISSING LINE 121
| Check | Result |
|:------|:-------|
| Frontend TypeScript compilation | ✅ No errors (`npx tsc --noEmit` runs clean) |
| Backend TypeScript compilation | ✅ Clean |
// MISSING LINE 126
### Manual Verification Needed
1. **Optimistic Reactions**: Toggle a reaction (e.g. ❤️) on any message. The badge should toggle instantly in the UI.
2. **Reaction Placement**: Confirm that the reaction badge overlaps the bottom edge/corner of the message bubble exactly as shown in the mockup image.
3. **Reply Layout**: Send a reply to a message. Verify that:
   - A header line like `Bạn đã trả lời [Name]` appears.
   - The quoted message is styled as a separate pill-shaped bubble.
   - The reply preview bar disappears immediately after sending the message.
   - Switching rooms resets any pending reply state.
// MISSING LINE 135
        result.edited_data,
      );
    }
// MISSING LINE 139
    return { message: result.message };
  }
// MISSING LINE 142
  /**
   * Delete (unsend) a message (only by the sender).
   * After deleting, broadcasts 'messageDeleted' to all room members.
   */
  @Delete(':id')
  @ResponseMessage('Delete message successfully')
  @ApiOperation({ summary: 'Delete a message' })
  async deleteMessage(@Param('id') id: string, @User() user: IUser) {
    const result = await this.chatMessagesService.deleteMessage(id, user.id);
// MISSING LINE 152
    // Broadcast delete event to all room members
    if (result.deleted_data) {
      await this.gatewayGateway.broadcastToMembers(
        result.chat_room_id,
        'messageDeleted',
        result.deleted_data,
      );
    }
// MISSING LINE 161
    return { message: result.message };
  }
}
// MISSING LINE 165
// MISSING LINE 166
  // ═══════════════════════════════════════════
  // GLOBAL Socket Listeners (independent of selected room)
  // These listen for events from ALL chat rooms via userId broadcast.
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (!token) return;
// MISSING LINE 173
    socketService.connect(token);
    const socket = socketService.getSocket();
                >
                  <X className="w-4 h-4 text-muted-foreground" />
            
            <button
              disabled={forwardTargets.length === 0}
              className="w-full py-2.5 bg-[#0084ff] text-white font-semibold rounded-xl hover:bg-[#0084ff]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={async () => {
                for (const targetRoomId of forwardTargets) {
                  try {
                    await createMessageMutation.mutateAsync({
                      data: {
                        chat_room_id: targetRoomId,
                        message: forwardingMsg.message || '',
                      },
                    });
                    updateSidebarWithMessage(targetRoomId, {
                      message: forwardingMsg.message || '📷 Ảnh',
                      created_by: user?.id,
                      created_at: new Date().toISOString(),
                    });
                    queryClient.invalidateQueries({
                      queryKey: getChatMessagesControllerGetMessageHistoryQueryKey(targetRoomId),
                    });
                  } catch (error) {
                    console.error('Forward failed:', error);
                  }
                }
                setForwardingMsg(null);
                setForwardTargets([]);
                setForwardSearch('');
                toast({ title: 'Đã chuyển tiếp', description: `Chuyển tiếp tới ${forwardTargets.length} cuộc trò chuyện` });
              }}
            >
              Gửi
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
// MISSING LINE 218
   * Typing indicator — broadcast to other room members.
   * Frontend should debounce: emit true on keypress, false after 1.5s idle.
   */
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { chat_room_id: string; is_typing: boolean },
  ) {
    // Broadcast typing status to all members except sender
    await this.broadcastToMembers(
      body.chat_room_id,
      'userTyping',
      {
        user_id: socket.data.user.id,
        is_typing: body.is_typing,
      },
      socket.data.user.id,
    );
  }
}
// MISSING LINE 239
   */
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.chatMessagesRepository.findOne({
      where: { id: messageId },
    });
// MISSING LINE 245
    if (!message) throw new NotFoundException('Message not found');
    if (message.created_by !== userId) {
      throw new BadRequestException('You can only delete your own messages');
    }
      // Optimistic sidebar update
      updateSidebarWithMessage(roomId, savedMsg);
    };
// MISSING LINE 253
    /**
     * messageError — server failed to save a text message sent via WebSocket.
     * Marks the optimistic message as failed.
     */
    const handleMessageError = (data: { tempId: string; error: string }) => {
      // Find which room this temp message belongs to by scanning all caches
// MISSING LINE 260
      created_by: message.created_by,
      created_at: message.created_at,
    }));
// MISSING LINE 264
    // Return delete payload for caller to broadcast
    return {
      message: 'Message deleted successfully',
      chat_room_id: message.chat_room_id,
      deleted_data: {
        id: message.id,
        chat_room_id: message.chat_room_id,
        message: message.message,
        message_status: message.message_status,
        medias: [],
        id: message.id,
        chat_room_id: message.chat_room_id,
        message: message.message,
        message_status: message.message_status,
        medias: [],
      },
    };
  }
}
// MISSING LINE 284
        .addOrderBy('room.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany();
// MISSING LINE 289
      // Get total count
      const total = await this.chatRoomsRepository
        .createQueryBuilder('room')
        .innerJoin(
          'room.chat_members',
          'my_member',
          'my_member.user_id = :userId',
          {
            userId: user.id,
          },
          return {
            ...old,
            data: {
              ...old.data,
              data: (old.data?.data || []).map((m: any) =>
                m.id === data.id
                  ? { ...m, message: data.message, message_status: data.message_status }
                  : m,
              ),
            },
          };
        },
      );
    };
// MISSING LINE 314
    /**
     * messageDeleted — a message was unsent/deleted in one of your rooms.
     */
    const handleMessageDeleted = (data: any) => {
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(data.chat_room_id),
        (old: any) => {
                </button>
                <input 
                  type="text" 
                  placeholder="Nhắn tin..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-transparent outline-none text-[15px]"
                />
                <div className="flex items-center text-foreground">
                  <button className="p-2 hover:opacity-70"><Mic className="w-6 h-6" /></button>
                  <button className="p-2 hover:opacity-70"><ImageIcon className="w-6 h-6" /></button>
                  <button className="p-2 hover:opacity-70" onClick={() => {
                    setMessageInput('❤️');
                    setTimeout(handleSendMessage, 100);
                  }}>
                    <Heart className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 border-2 border-foreground rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-12 h-12" />
            </div>
            <h2 className="text-xl font-bold mb-2">Tin nhắn của bạn</h2>
            <p className="text-muted-foreground mb-6">Gửi ảnh và tin nhắn riêng tư cho bạn bè hoặc nhóm.</p>
            <button className="px-4 py-1.5 bg-[#0084ff] text-white rounded-lg font-semibold text-sm hover:bg-[#0084ff]/90">
              Gửi tin nhắn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
// MISSING LINE 360
        },
      );
      // Update active header recipient
      setSelectedRecipient((prev: any) => {
        if (prev && prev.id === user_id) {
          return { ...prev, is_online, last_active };
        }
        return prev;
      });
      });
    };
// MISSING LINE 372
    /**
     * messageReactionUpdated — a reaction was added/removed/changed on a message.
     */
    socket.on('messageEdited', handleMessageEdited);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('userStatusChanged', handleUserStatusChanged);
// MISSING LINE 379
    };
// MISSING LINE 381
    /**
     * messageReactionUpdated — a reaction was added/removed/changed on a message.
     */
    const handleReactionUpdated = (data: { chat_room_id: string; message_id: string; reactions: any[] }) => {
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(data.chat_room_id),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: (old.data?.data || []).map((m: any) =>
                m.id === data.message_id ? { ...m, reactions: data.reactions } : m,
              ),
            },
          };
        },
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => otherUser?.id && navigate(`/profile/${otherUser.id}`)}
              >
                <div className="relative">
                  <Avatar className="w-11 h-11">
                    <AvatarImage
                      src={
                        otherUser.profile_picture_url ||
                        otherUser.avatar ||
                        'https://github.com/shadcn.png'
                      }
                    />
                    <AvatarFallback>
                      {otherUser.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {otherUser.is_online && (
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-base">
                    {otherUser.full_name || otherUser.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getStatusText(otherUser)}
                  </p>
                </div>
              </div>
// MISSING LINE 430
              <div className="flex items-center gap-4 text-foreground">
                <button className="
            { cursor: nextCursor }
          );
          const newMsgs = (res as any)?.data?.data || [];
          const meta = (res as any)?.data?.meta || {};
// MISSING LINE 437
          if (newMsgs.length > 0) {
            queryClient.setQueryData(
              getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
              (old: any) => {
                if (!old) return res;
                return {
                  ...old,
                  data: {
                    ...old.data,
                    data: [...newMsgs, ...(old.data?.data || [])],
                    meta: meta,
                  },
                };
              },
            );
          }
        } catch (error) {
          console.error('Error loading older messages:', error);
        } finally {
          setIsLoadingMore(false);
              {/* Infinite scroll sentinel — triggers auto-load when visible */}
              <div ref={loadMoreSentinelRef} className="h-1 shrink-0" />
              {isLoadingMore && (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
// MISSING LINE 465
              {/* Avatar introduction */}
              {!hasMore && (
                <div className="flex flex-col items-center justify-center pt-8 pb-12 gap-3">
                  <Avatar className="w-24 h-24">
                    <AvatarImage
                      src={
                        otherUser.profile_picture_url ||
                        otherUser.avatar ||
                        'https://github.com/shadcn.png'
                      }
                    />
                    <AvatarFallback>
                      {otherUser.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold">
                    {otherUser.full_name || otherUser.username}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {otherUser.username}
                  </p>
                  <button
                    className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg font-semibold text-sm hover:bg-secondary/80 transition-colors"
                    onClick={() => otherUser?.id && navigate(`/profile/${otherUser.id}`)}
                  >
                    Xem trang cá nhân
                  </button>
                </div>
              )}
// MISSING LINE 495
      medias: filesToSend.map((file) => URL.createObjectURL(file)),
      created_at: new Date().toISOString(),
      user: user,
      is_sending: true,
    };
// MISSING LINE 501
    // Step 1: Optimistically write temp message to query cache
    queryClient.setQueryData(
      getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
      (old: any) => {
        if (!old) {
          return {
            data: {
              data: [tempMsg],
              meta: { has_more: false, next_cursor: null },
            },
          };
        }
        return {
          ...old,
          data: {
            ...old.data,
            data: [...(old.data?.data || []), tempMsg],
          },
        };
      },
    );
// MISSING LINE 523
    if (hasMedia) {
      // ── REST PATH (media upload via multipart/form-data) ──
      createMessageMutation.mutate(
        {
          data: {
            chat_room_id: selectedRoomId,
            message: msg,
            'medias-messages': filesToSend as any,
          },
        },
        {
          onSuccess: (res: any) => {
            const savedMsg = res?.data || res;
            // Replace temp message with real saved message
            queryClient.setQueryData(
              getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
              (old: any) => {
                if (!old) return old;
                return {
                  ...old,
                  data: {
                    ...old.data,
                    data: (old.data?.data || []).map((m: any) =>
                      m.id === tempId ? savedMsg : m,
   *
   * Both paths use Optimistic Updates for instant UI feedback.
   */
    const handleSendMessage = async () => {
    if (!messageInput.trim() && selectedFiles.length === 0) return;
    if (!selectedRoomId && !virtualRecipient) return;
// MISSING LINE 554
    const msg = messageInput.trim();
    const filesToSend = [...selectedFiles];
    const hasMedia = filesToSend.length > 0;
// MISSING LINE 558
    setMessageInput('');
    setSelectedFiles([]);
              (old: any) => {
                if (!old) return old;
                return {
                  ...old,
                  data: {
                    ...old.data,
                    data: (old.data?.data || []).map((m: any) =>
                      m.id === tempId
                        ? { ...m, is_failed: true, is_sending: false }
                        : m,
                    ),
                  },
                };
              },
            );
            toast({
              title: 'Lỗi',
              description: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
              variant: 'destructive',
   * Text-only messages → WebSocket (fast path, ~50ms latency)
   * Media messages → REST multipart/form-data (supports file upload)
   *
   * Both paths use Optimistic Updates for instant UI feedback.
   */
    const handleSendMessage = async () => {
    if (!messageInput.trim() && selectedFiles.length === 0) return;
    if (!selectedRoomId && !virtualRecipient) return;
// MISSING LINE 588
    const msg = messageInput.trim();
    const filesToSend = [...selectedFiles];
    const hasMedia = filesToSend.length > 0;
// MISSING LINE 592
    setMessageInput('');
    setSelectedFiles([]);
// MISSING LINE 595
    // If in virtual chat mode → create room first, then send
    if (!selectedRoomId && virtualRecipient) {
      try {
        const res = await getOrCreateRoomMutation.mutateAsync({
          targetUserId: virtualRecipient.id,
        });
        const newRoomId = (res as any)?.data?.room_id || (res as any)?.room_id;
        if (newRoomId) {
          setSelectedRoomId(newRoomId);
          setVirtualRecipient(null);
          // Refetch room list to include the new room
          await queryClient.invalidateQueries({
            queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
          });
          // Now send the message via WebSocket
          const socket = socketService.getSocket();
          if (socket?.connected) {
            socket.emit('sendMessage', {
              chat_room_id:
      (old: any) => {
        if (!old) {
                    },
                  };
                },
              );
            },
            onError: () => {
              queryClient.setQueryData(
                getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
                (old: any) => {
                  if (!old) return old;
                  return {
                    ...old,
                    data: {
                      ...old.data,
// MISSING LINE 631
// MISSING LINE 632
// MISSING LINE 633
// MISSING LINE 634
// MISSING LINE 635
// MISSING LINE 636
// MISSING LINE 637
// MISSING LINE 638
// MISSING LINE 639
// MISSING LINE 640
// MISSING LINE 641
// MISSING LINE 642
// MISSING LINE 643
// MISSING LINE 644
// MISSING LINE 645
// MISSING LINE 646
// MISSING LINE 647
// MISSING LINE 648
// MISSING LINE 649
// MISSING LINE 650
// MISSING LINE 651
// MISSING LINE 652
// MISSING LINE 653
// MISSING LINE 654
// MISSING LINE 655
// MISSING LINE 656
// MISSING LINE 657
// MISSING LINE 658
// MISSING LINE 659
// MISSING LINE 660
// MISSING LINE 661
// MISSING LINE 662
// MISSING LINE 663
// MISSING LINE 664
// MISSING LINE 665
// MISSING LINE 666
// MISSING LINE 667
export type UsersControllerGetAccount200 = { [key: string]: unknown };
// MISSING LINE 669
export type UsersControllerSearchUsersForMessageParams = {
q: string;
};
// MISSING LINE 673
export type UsersControllerSearchUsersForMessage200 = { [key: string]: unknown };
// MISSING LINE 675
export type UsersControllerGetProfile200 = { [key: string]: unknown };
// MISSING LINE 677
export type UsersControllerUpdateUser200 = { [key: string]: unknown };
// MISSING LINE 679
// MISSING LINE 680
// MISSING LINE 681
// MISSING LINE 682
// MISSING LINE 683
// MISSING LINE 684
// MISSING LINE 685
// MISSING LINE 686
// MISSING LINE 687
// MISSING LINE 688
// MISSING LINE 689
// MISSING LINE 690
// MISSING LINE 691
// MISSING LINE 692
// MISSING LINE 693
// MISSING LINE 694
// MISSING LINE 695
// MISSING LINE 696
// MISSING LINE 697
// MISSING LINE 698
// MISSING LINE 699
            getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
            (old: any) => {
              if (!old) return old;
              const currentList = old.data?.data || [];
              return {
                ...old,
                data: {
                  ...old.data,
                  data: currentList.map((m: any) =>
                    m.id === tempId ? savedMsg : m
                  ),
                },
              };
            },
          );
        },
        onError: () => {
          queryClient.setQueryData(
            getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
            (old: any) => {
              if (!old) return old;
              const currentList = old.data?.data || [];
              return {
                ...old,
                data: {
                  ...old.data,
                  data: currentList.filter((m: any) => m.id !== tempId),
                },
              };
            },
          );
        },
      },
    );
  };
// MISSING LINE 735
  // Selecting a Suggested/Search User
  const handleSelectUser = async (targetUser: any) => {
    try {
      setSelectedRecipient(targetUser);
      const res = await getOrCreateRoomMutation.mutateAsync({
        targetUserId: targetUser.id,
      });
      const createdRoomId =
        (res as any)?.data?.room_id || (res as any)?.room_id;
// MISSING LINE 745
    createMessageMutation.mutate(
      {
        data: {
          chat_room_id: selectedRoomId,
          message: '❤️',
                (old: any) => {
                  if (!old) return old;
            });
          },
        },
      );
    } else {
      // ── WEBSOCKET PATH (text-only, low-latency) ──
      // Server will respond with 'messageSaved' or 'messageError' events
      const socket = socketService.getSocket();
      if (socket?.connected) {
          socket.emit('sendMessage', {
            chat_room_id: selectedRoomId,
            message: msg,
            tempId,
            reply_to_id: replyToId,
          });
      } else {
        // Fallback to REST if socket is disconnected
        createMessageMutation.mutate(
          {
            data: {
              chat_room_id: selectedRoomId,
              message: msg,
              reply_to_id: replyToId,
            } as any,
          },
          {
            onSuccess: (res: any) => {
              const savedMsg = res?.data || res;
              queryClient.setQueryData(
                getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
                (old: any) => {
                  if (!old) return old;
                  return {
                    ...old,
                    data: {
                      ...old.data,
                      data: (old.data?.data || []).map((m: any) =>
                        m.id === tempId ? savedMsg : m,
                      ),
                    },
                  };
                },
              );
            },
            onError: () => {
              queryClient.setQueryData(
                getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
                (old: any) => {
                  if (!old) return old;
                  return {
                    ...old,
                    data: {
                      ...old.data,
                      data: (old.data?.data || []).map((m: any) =>
                        m.id === tempId
                          ? { ...m, is_failed: true, is_sending: false }
                          : m,
                      ),
                    },
                  };
                },
              );
              toast({
                title: 'Lỗi',
                description: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
                variant: 'destructive',
              });
            },
          },
        );
      }
    }
  };
// MISSING LINE 826
  // Direct Heart click
  /**
   * Toggle emoji reaction on a message via REST API with optimistic UI update.
   */
  const handleToggleReaction = async (messageId: string, reactionType: string) => {
    if (!selectedRoomId) return;
    const queryKey = getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId);
// MISSING LINE 834
    // Snapshot the current cache value
    const previousMessages = queryClient.getQueryData(queryKey);
// MISSING LINE 837
    // Optimistically update the cache
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old?.data?.data) return old;
      return {
        ...old,
      
                chat_message_id: messageId,
                user_id: user?.id || '',
                reaction_type: reactionType,
                user: user,
                created_at: new Date().toISOString(),
              });
            }
// MISSING LINE 851
            return {
              ...msg,
              reactions: newReactions,
              if (prevReaction.reaction_type === reactionType) {
                // If it is the same reaction, remove it (un-react)
                newReactions.splice(userReactionIdx, 1);
              } else {
                // If it is a different reaction, change the type
                newReactions[userReactionIdx] = {
                  ...prevReaction,
                  reaction_type: reactionType,
                };
              }
            } else {
              // Add a new reaction object
              newReactions.push({
                id: 'temp-reaction-' + Date.now(),
                chat_message_id: messageId,
                user_id: user?.id || '',
                reaction_type: reactionType,
                user: user,
                created_at: new Date().toISOString(),
              });
            }
// MISSING LINE 876
            return {
              ...msg,
              reactions: newReactions,
            };
          }),
        },
      };
    });
// MISSING LINE 885
    try {
      await orvalClient(`/chat-messages/${messageId}/reactions`, {
        method: 'POST',
        data: { reaction_type: reactionType },
      });
    } catch (error) {
      console.error('Error toggling reaction:', error);
      // Revert cache to previous snapshot on failure
      if (previousMessages) {
        queryClient.setQueryData(queryKey, previousMessages);
      }
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật reaction. Vui lòng thử lại.',
        variant: 'destructive',
      });
    }
  };
// MISSING LINE 904
              {isSearchLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                filteredSearch.suggested.map((u: any) => (
        </div>
      </div>
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Sidebar - Chat List */}
      <div className="w-[350px] flex flex-col border-r border-border/40 shrink-0">
        {/* Header */}
            {/* Chat Header */}
            <div className="h-[75px] border-b border-border/40 flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <Avatar className="w-11 h-11">
                    <AvatarImage
                      src={
                        otherUser.profile_picture_url ||
                        otherUser.avatar ||
                        'https://github.com/shadcn.png'
                      }
                    />
                    <AvatarFallback>
                      {otherUser.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
    
// MISSING LINE 935
// MISSING LINE 936
// MISSING LINE 937
// MISSING LINE 938
// MISSING LINE 939
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">
                        {targetUser?.full_name || targetUser?.username}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {room.last_message
                          ? `${room.last_message.created_by === user?.id ? 'Bạn: ' : ''}${room.last_message.message} · ${formatRelativeTime(room.last_message_at)}`
                          : 'Bắt đầu cuộc trò chuyện'}
                      </p>
                    </div>
                  </div>
                );
              })}
// MISSING LINE 955
              {filteredSearch.suggested.length > 0 && (
                <div className="mt-4 mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase">
                  {filteredSearch.isSearching ? 'Kết quả khác' : 'Gợi ý'}
                </div>
              )}
                  <p className="font-bold text-base">
                    {otherUser.full_name || otherUser.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getStatusText(otherUser)}
                  </p>
                </div>
              </div>
// MISSING LINE 969
              <div className="flex items-center gap-4 text-foreground">
                <button className="hover:opacity-70">
                  <Info className="w-6 h-6" />
                </button>
              </div>
            </div>
// MISSING LINE 976
            {/* Chat Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* Load More Trigger */}
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore || isFetchingMessages}
                  className="mx-auto my-2 text-xs font-semibold text-[#0084ff] hover:underline disabled:opacity-50"
                >
                  {isLoadingMore || isFetchingMessages ? 'Đang tải...' : 'Xem tin nhắn cũ hơn'}
                </button>
              )}
// MISSING LINE 989
              {/* Avatar introduction */}
              {!hasMore && (
                <div className="flex flex-col items-center justify-center pt-8 pb-12 gap-3">
              
                  </p>
              </div>
            </div>
// MISSING LINE 997
            {/* Chat Messages — no gap, grouping handled per-message */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col">
              {/* Load More Trigger */}
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore || isFetchingMessages}
                  className="mx-auto my-2 text-xs font-semibold text-[#0084ff] hover:underline disabled:opacity-50"
                >
                  {isLoadingMore || isFetchingMessages ? 'Đang tải...' : 'Xem tin nhắn cũ hơn'}
                </button>
              )}
// MISSING LINE 1010
      {/* Right Column - Chat View */}
      <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
        {selectedRoomId && otherUser ? (
          <>
            {/* Chat Header */}
            <div className="h-[75px] border-b border-border/40 flex items-center justify-between px-6 shrink-0">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => otherUser?.id && navigate(`/profile/${otherUser.id}`)}
              >
                <div className="relative">
                  <Avatar className="w-11 h-11">
                    <AvatarImage
                      src={
                        otherUser.profile_picture_url ||
                        otherUser.avatar ||
                        'https://github.com/shadcn.png'
                      }
                    />
                    <AvatarFallback>
                  </p>
                  <button
                    className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg font-semibold text-sm hover:bg-secondary/80 transition-colors"
                    onClick={() => otherUser?.id && navigate(`/profile/${otherUser.id}`)}
                  >
                    Xem trang cá nhân
                  </button>
                </div>
              )}
// MISSING LINE 1040
              {/* Messages Mapping — Instagram-style grouping */}
              {messages.map((msg: any, idx: number) => {
                const isMine = msg.created_by === user?.id;
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
                const isSameSenderAsPrev = prevMsg && prevMsg.created_by === msg.created_by;
                const isSameSenderAsNext = nextMsg && nextMsg.created_by === msg.created_by;
                // Show avatar only on the LAST message of a group
                const showAvatar = !isMine && !isSameSenderAsNext;
// MISSING LINE 1050
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 group ${isMine ? 'justify-end' : ''}`}
                    style={{ marginTop: isSameSenderAsPrev ? '2px' : '12px' }}
                  >
                    {/* Show avatar only on last message of a group, invisible spacer otherwise */}
                    {!isMine && (
                      showAvatar ? (
                        <Avatar className="w-7 h-7 shrink-0">
                          <AvatarImage
                            src={
                              otherUser.profile_picture_url ||
                              otherUser.avatar ||
                              'https://github.com/shadcn.png'
                            }
                          />
                          <AvatarFallback>
                            {otherUser.username?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-7 shrink-0" /> /* spacer to keep alignment */
                      )
                    )}
// MISSING LINE 1076
                    {isMine && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className="opacity-0 group-hover:opacity
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground self-start pl-1">
                          <Pin className="w-3 h-3 rotate-45 text-amber-500 fill-amber-500" />{' '}
                          Đã ghim
                        </div>
                      )}
// MISSING LINE 1086
                      {msg.medias && msg.medias.length > 0 && (
                        <div
                          className={`grid gap-1 relative ${
                            msg.medias.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
// MISSING LINE 1091
// MISSING LINE 1092
// MISSING LINE 1093
// MISSING LINE 1094
// MISSING LINE 1095
// MISSING LINE 1096
// MISSING LINE 1097
// MISSING LINE 1098
// MISSING LINE 1099
                        />
                        <AvatarFallback>
                          {targetUser?.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {targetUser?.is_online && (
                        <span className="absolute bottom-0.5 right-0.5 block h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">
                        {targetUser?.full_name || targetUser?.username}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {room.last_message
                          ? `${room.last_message.created_by === user?.id ? 'Bạn: ' : ''}${room.last_message.message} · ${formatRelativeTime(room.last_message_at)}`
                          : 'Bắt đầu cuộc trò chuyện'}
                      </p>
                    </div>
                  </div>
                );
              })}
// MISSING LINE 1122
              {filteredSearch.suggested.length > 0 && (
                <div className="mt-4 mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase">
                  {filteredSearch.isSearching ? 'Kết quả khác' : 'Gợi ý'}
                </div>
              )}
// MISSING LINE 1128
              {isSearchLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                filteredSearch.suggested.map((u: any) => (
                  <div
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    <div className="relative shrink-0">
                      <Avatar className="w-14 h-14">
                        <AvatarImage
                          src={u.avatar || 'https://github.com/shadcn.png'}
                        />
                        <AvatarFallback>
                          {u.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {u.is_online && (
                        <span className="absolute bottom-0.5 right-0.5 block h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">
                        {u.full_name || u.username}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        @{u.username}
                      </p>
                    </div>
                  </div>
                ))
              )}
// MISSING LINE 1164
              {filteredSearch.isSearching &&
                filteredSearch.active.length === 0 &&
                filteredSearch.suggested.length === 0 &&
                !isSearchLoading && (
                  <div className="text-center p-6 text-sm text-muted-foreground">
                    Không tìm thấy kết quả nào cho "{searchTerm}"
                  </div>
                )}
            </>
          )}
        </div>
      </div>
// MISSING LINE 1177
      {/* Right Column - Chat View */}
      <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
        {(selectedRoomId && otherUser) || isVirtualChat ? (
          <>
            {/* Chat Header */}
            <div className="h-[75px] border-b border-border/40 flex items-center justify-between px-6 shrink-0">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => otherUser?.id && navigate(`/profile/${otherUser.id}`)}
              >
                <div className="relative">
                  <Avatar className="w-11 h-11">
                    <AvatarImage
                      src={
                        otherUser.profile_picture_url ||
                        otherUser.avatar ||
                        'https://github.com/shadcn.png'
                      }
                    />
                    <AvatarFallback>
                      {otherUser.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {otherUser.is_online && (
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-base">
                    {otherUser.full_name || otherUser.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getStatusText(otherUser)}
                  </p>
                </div>
              </div>
// MISSING LINE 1214
              <div className="flex items-center gap-4 text-foreground">
                <button className="hover:opacity-70">
                  <Info className="w-6 h-6" />
                </button>
              </div>
            </div>
// MISSING LINE 1221
            {/* Chat Messages — no gap, grouping handled per-message */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col">
              {/* Infinite scroll sentinel — triggers auto-load when visible */}
              <div ref={loadMoreSentinelRef} className="h-1 shrink-0" />
              {isLoadingMore && (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
                  } else if (isSameSenderAsPrev && !isSameSenderAsNext) {
                    bubbleRadius = `${r} ${R} ${R} ${R}`;
                  } else if (!isSameSenderAsPrev && isSameSenderAsNext) {
                    bubbleRadius = `${R} ${R} ${R} ${r}`;
                  } else {
                    bubbleRadius = `${R} ${R} ${R} ${R}`;
                  }
                }
                // Reset radius grouping if time separator is shown
                if (showTimeSeparator) {
                  if (isSameSenderAsNext) {
                    bubbleRadius = isMine
                      ? `${R} ${R} ${r} ${R}`
                      : `${R} ${R} ${R} ${r}`;
                  } else {
                    bubbleRadius = `${R} ${R} ${R} ${R}`;
                  }
                }
// MISSING LINE 1249
                return (
                  <div key={msg.id}>
                    {/* Time separator */}
                    {showTimeSeparator && (
                      <div className="flex justify-center py-4">
                        <span className="text-[11px] text-muted-foreground font-medium px-3 py-0.5 rounded-full bg-muted/60">
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                      </div>
                    )}
                return (
                  <div key={msg.id}>
                    {/* Time separator */}
                    {showTimeSeparator && (
                      <div className="flex justify-center py-4">
                        <span className="text-[11px] text-muted-foreground font-medium px-3 py-0.5 rounded-full bg-muted/60">
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                      </div>
                    )}
// MISSING LINE 1270
                    <div
                      className={`flex items-end gap-2 group ${isMine ? 'justify-end' : ''}`}
                      style={{
                        marginTop: showTimeSeparator
                          ? '4px'
                          : isSameSenderAsPrev
                            ? '2px'
                            : '12px',
                      }}
                    >
                      {/* Avatar: show on last message of group, spacer otherwise */}
                      {!isMine && (
                        showAvatar ? (
                          <Avatar className="w-7 h-7 shrink-0">
                            <AvatarImage
                              src={
                                otherUser.profile_picture_url ||
                                otherUser.avatar ||
                                'https://github.c
// MISSING LINE 1290
                      {/* Context menu + quick actions for own messages */}
                      {isMine && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                          {/* Quick reaction picker */}
                          <div className="flex items-center bg-background border border-border/50 rounded-full px-1 py-0.5 shadow-sm mr-0.5">
                            {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                              <button
                                key={type}
                                className="text-xs hover:scale-125 transition-transform p-0.5"
                                title={type}
                                onClick={() => handleToggleReaction(msg.id, type)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <button
                            className="p-1.5 hover:bg-muted rounded-full transition-colors"
                            title="Trả lời"
                            onClick={() => setReplyingTo(msg)}
                          >
                            <CornerUpLeft className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="cursor-pointer p-1">
                                <MoreVertical className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 rounded-xl"
                            >
                      : `${R} ${R} ${R} ${r}`;
                  } else {
                    bubbleRadius = `${R} ${R} ${R} ${R}`;
                  }
                }
// MISSING LINE 1329
                return (
                  <div key={msg.id}>
                    {/* Time separator */}
                    {showTimeSeparator && (
                      <div className="flex justify-center py-4">
                        <span className="text-[11px] text-muted-foreground font-medium px-3 py-0.5 rounded-full bg-muted/60">
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                      </div>
                    )}
// MISSING LINE 1340
                    <div
                      className={`flex items-end gap-2 group ${isMine ? 'justify-end' : ''}`}
                      style={{
                        marginTop: showTimeSeparator
                          ? '4px'
                          : isSameSenderAsPrev
                            ? '2px'
                            : '12px',
                        marginBottom: msg.reactions && msg.reactions.length > 0 ? '10px' : '0px',
                      }}
                    >
                      {/* Avatar: show on last message of group, spacer otherwise */}
                      {!isMine && (
                        showAvatar ? (
                          <Avatar className="w-7 h-7 shrink-0">
                            <AvatarImage
                              src={
                                otherUser.profile_picture_url ||
                                otherUser.avatar ||
                                'https://github.com/shadcn.png'
                              }
                            />
                            <AvatarFallback>
                              {otherUser.username?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-7 shrink-0" />
                        )
                      )}
// MISSING LINE 1371
                      {/* Context menu + quick actions for own messages */}
                      {isMine && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                          {/* Quick reaction picker */}
                          <div className="flex items-center bg-background border border-border/50 rounded-full px-1 py-0.5 shadow-sm mr-0.5">
                            {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                              <button
                                key={type}
                                className="text-xs hover:scale-125 transition-transform p-0.5"
                                title={type}
                                onClick={() => handleToggleReaction(msg.id, type)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <button
                            className="p-1.5 hover:bg-muted rounded-full transition-colors"
                            title="Trả lời"
                            onClick={() => setReplyingTo(msg)}
                          >
                            <CornerUpLeft className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="cursor-pointer p-1">
                                <MoreVertical className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 rounded-xl"
                            >
     
                                {format(new Date(msg.created_at), 'HH:mm')}
                              </div>
                              <DropdownMenuItem
                                className="cursor-pointer flex justify-between py-2 rounded-lg"
                                onClick={() => setForwardingMsg(msg)}
                              >
                                Chuyển tiếp <Forward className="w-4 h-4 ml-2" />
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                                Sao chép <Copy className="w-4 h-4 ml-2" />
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer flex justify-between py-2 rounded-lg"
                                onClick={() =>
                                  togglePinMutation.mutate({ messageId: msg.id })
                                }
                              >
                                Ghim <Pin className="w-4 h-4 ml-2" />
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer flex justify-between py-2 text-destructive focus:text-destructive rounded-lg"
                                onClick={() => {
                                  queryClient.setQueryData(
                                    getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
                                    (old: any) => {
                                  src={fullUrl}
                                  alt="attachment"
                                  className="max-h-60 w-full object-cover hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(full
                    )}
// MISSING LINE 1436
                    {!isMine && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                        <button
                          className="p-1.5 hover:bg-muted rounded-full transition-colors"
                        />
                        <DropdownMenuTrigger asChild>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer p-1">
                            <MoreVertical className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-48 rounded-xl"
                        >
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground text-center border-b mb-1">
                            {format(new Date(msg.created_at), 'HH:mm')}
                                  : 'bg-muted text-foreground'
                              } ${msg.is_sending ? 'opacity-70' : ''} ${
                                msg.is_failed ? 'bg-red-500 text-white' : ''
                              }`}
                              style={{ borderRadius: bubbleRadius }}
                            >
                              {msg.message}
                              {msg.is_sending && (
                                <span className="absolute bottom-0.5 right-2 text-[8px] opacity-60">
                                  đang gửi...
                                </span>
                              )}
                              {msg.is_failed && (
                                <span className="absolute bottom-0.5 right-2 text-[8px] text-white font-bold">
                                  lỗi
                                </span>
                              )}
                            </div>
                          )
                        )}
                      </div>
// MISSING LINE 1474
                        {/* Reaction badges */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className="inline-flex items-center gap-0.5 bg-background border border-border/50 rounded-full px-1.5 py-0.5 shadow-sm">
                              {Object.entries(
                                msg.reactions.reduce((acc: Record<string, number>, r: any) => {
                                  acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
                                  return acc;
                      </div>
// MISSING LINE 1484
                        {/* Reaction badges */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className="inline-flex items-center gap-0.5 bg-background border border-border/50 rounded-full px-1.5 py-0.5 shadow-sm">
                              {Object.entries(
                                msg.reactions.reduce((acc: Record<string, number>, r: any) => {
                                  acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
                                  return acc;
                                }, {})
                              ).map(([type, count]) => (
                                <span key={type} className="text-xs cursor-pointer hover:scale-125 transition-transform" title={type}>
                                  {REACTION_EMOJIS[type] || type}{(count as number) > 1 ? ` ${count}` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
// MISSING LINE 1502
// MISSING LINE 1503
// MISSING LINE 1504
                    {!isMine && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                        {/* Quick reaction picker */}
                        <div className="flex items-center bg-background border border-border/50 rounded-full px-1 py-0.5 shadow-sm mr-0.5">
                          {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                            <button
                          className="p-1.5 hover:bg-muted rounded-full transition-colors"
                          title="Trả lời"
                          onClick={() => setReplyingTo(msg)}
                        >
                          <CornerUpLeft className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <DropdownMenu>
                    </button>
                  ) : (
                    /* Show Image + Heart when input is empty */
                    <>
                      <button
                        className="p-2 hover:opacity-70"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImageIcon className="w-6 h-6" />
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground text-center border-b mb-1">
                            {format(new Date(msg.created_at), 'HH:mm')}
                          </div>
                          <DropdownMenuItem
                            className="cursor-pointer flex justify-between py-2 rounded-lg"
                            onClick={() => setForwardingMsg(msg)}
                          >
                            Chuyển tiếp <Forward className="w-4 h-4 ml-2" />
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                            Sao chép <Copy className="w-4 h-4 ml-2" />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer flex justify-between py-2 rounded-lg"
                            onClick={() =>
                              togglePinMutation.mutate({ messageId: msg.id })
                            }
                          >
                            Ghim <Pin className="w-4 h-4 ml-2" />
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer flex justify-between py-2 text-destructive focus:text-destructive rounded-lg">
                            Báo cáo <Flag className="w-4 h-4 ml-2" />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
// MISSING LINE 1559
            {/* Previews of selected files */}
                      </DropdownMenu>
                      </div>
                    )}
                  </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
// MISSING LINE 1570
            {/* Previews of selected files */}
            {selectedFiles.length > 0 && (
              <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto border-t border-border/40 shrink-0 bg-background/50">
                {selectedFiles.map((file, idx) => {
                  const url = URL.createObjectURL(file);
                  const isVideo = file.type.startsWith('video');
                  return (
                    <div
                      key={idx}
                    {!isMine && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                        {/* Quick reaction picker */}
                        <div className="flex items-center bg-background border border-border/50 rounded-full px-1 py-0.5 shadow-sm mr-0.5">
                          {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                            <button
                              key={type}
                              className="text-xs hover:scale-125 transition-transform p-0.5"
                              title={type}
                              onClick={() => handleToggleReaction(msg.id, type)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        <button
                          className="p-1.5 hover:bg-muted rounded-full transition-colors"
                          title="Trả lời"
                          onClick={() => setReplyingTo(msg)}
                        >
                          <CornerUpLeft className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          
                    </div>
                  );
                })}
              </div>
            )}
// MISSING LINE 1610
            {/* Reply bar */}
            {replyingTo && (
                            {format(new Date(msg.created_at), 'HH:mm')}
                          </div>
                          <DropdownMenuItem
                            className="cursor-pointer flex justify-between py-2 rounded-lg"
                            onClick={() => setForwardingMsg(msg)}
                          >
                            Chuyển tiếp <Forward className="w-4 h-4 ml-2" />
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer flex justify-between py-2 rounded-lg">
                            Sao chép <Copy className="w-4 h-4 ml-2" />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer flex justify-between py-2 rounded-lg"
                            onClick={() =>
                              togglePinMutation.mutate({ messageId: msg.id })
                            }
                          >
                            Ghim <Pin className="w-4 h-4 ml-2" />
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer flex justify-between py-2 text-destructive focus:text-destructive rounded-lg">
                            Báo cáo <Flag className="w-4 h-4 ml-2" />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    )}
                  </div>
                  </div>
// MISSING LINE 1641
// MISSING LINE 1642
// MISSING LINE 1643
// MISSING LINE 1644
// MISSING LINE 1645
// MISSING LINE 1646
// MISSING LINE 1647
// MISSING LINE 1648
// MISSING LINE 1649
// MISSING LINE 1650
// MISSING LINE 1651
// MISSING LINE 1652
// MISSING LINE 1653
// MISSING LINE 1654
// MISSING LINE 1655
// MISSING LINE 1656
// MISSING LINE 1657
// MISSING LINE 1658
// MISSING LINE 1659
// MISSING LINE 1660
// MISSING LINE 1661
// MISSING LINE 1662
// MISSING LINE 1663
// MISSING LINE 1664
// MISSING LINE 1665
// MISSING LINE 1666
// MISSING LINE 1667
// MISSING LINE 1668
// MISSING LINE 1669
// MISSING LINE 1670
// MISSING LINE 1671
// MISSING LINE 1672
// MISSING LINE 1673
// MISSING LINE 1674
// MISSING LINE 1675
// MISSING LINE 1676
// MISSING LINE 1677
// MISSING LINE 1678
// MISSING LINE 1679
// MISSING LINE 1680
// MISSING LINE 1681
// MISSING LINE 1682
// MISSING LINE 1683
// MISSING LINE 1684
// MISSING LINE 1685
// MISSING LINE 1686
// MISSING LINE 1687
// MISSING LINE 1688
// MISSING LINE 1689
// MISSING LINE 1690
// MISSING LINE 1691
// MISSING LINE 1692
// MISSING LINE 1693
// MISSING LINE 1694
// MISSING LINE 1695
// MISSING LINE 1696
// MISSING LINE 1697
// MISSING LINE 1698
// MISSING LINE 1699
// MISSING LINE 1700
// MISSING LINE 1701
// MISSING LINE 1702
// MISSING LINE 1703
// MISSING LINE 1704
// MISSING LINE 1705
// MISSING LINE 1706
// MISSING LINE 1707
// MISSING LINE 1708
// MISSING LINE 1709
// MISSING LINE 1710
// MISSING LINE 1711
// MISSING LINE 1712
// MISSING LINE 1713
// MISSING LINE 1714
// MISSING LINE 1715
// MISSING LINE 1716
// MISSING LINE 1717
// MISSING LINE 1718
// MISSING LINE 1719
// MISSING LINE 1720
// MISSING LINE 1721
// MISSING LINE 1722
// MISSING LINE 1723
// MISSING LINE 1724
// MISSING LINE 1725
// MISSING LINE 1726
// MISSING LINE 1727
// MISSING LINE 1728
// MISSING LINE 1729
// MISSING LINE 1730
// MISSING LINE 1731
// MISSING LINE 1732
// MISSING LINE 1733
// MISSING LINE 1734
// MISSING LINE 1735
// MISSING LINE 1736
// MISSING LINE 1737
// MISSING LINE 1738
// MISSING LINE 1739
                  }
                }
                setForwardingMsg(null);
                setForwardTargets([]);
                setForwardSearch('');
                toast({ title: 'Đã chuyển tiếp', description: `Chuyển tiếp tới ${forwardTargets.length} cuộc trò chuyện` });
              }}
            >
              Gửi
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
// MISSING LINE 1757
// MISSING LINE 1758
// MISSING LINE 1759
// MISSING LINE 1760
// MISSING LINE 1761
// MISSING LINE 1762
// MISSING LINE 1763
// MISSING LINE 1764
// MISSING LINE 1765
// MISSING LINE 1766
// MISSING LINE 1767
// MISSING LINE 1768
// MISSING LINE 1769
// MISSING LINE 1770
// MISSING LINE 1771
// MISSING LINE 1772
// MISSING LINE 1773
// MISSING LINE 1774
// MISSING LINE 1775
// MISSING LINE 1776
// MISSING LINE 1777
// MISSING LINE 1778
// MISSING LINE 1779
// MISSING LINE 1780
// MISSING LINE 1781
// MISSING LINE 1782
// MISSING LINE 1783
// MISSING LINE 1784
// MISSING LINE 1785
// MISSING LINE 1786
// MISSING LINE 1787
// MISSING LINE 1788
// MISSING LINE 1789
// MISSING LINE 1790
// MISSING LINE 1791
// MISSING LINE 1792
// MISSING LINE 1793
// MISSING LINE 1794
// MISSING LINE 1795
// MISSING LINE 1796
// MISSING LINE 1797
// MISSING LINE 1798
// MISSING LINE 1799
// MISSING LINE 1800
// MISSING LINE 1801
// MISSING LINE 1802
// MISSING LINE 1803
// MISSING LINE 1804
// MISSING LINE 1805
// MISSING LINE 1806
// MISSING LINE 1807
            <button
              disabled={forwardTargets.length === 0}
              className="w-full py-2.5 bg-[#0084ff] text-white font-semibold rounded-xl hover:bg-[#0084ff]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={async () => {
                for (const targetRoomId of forwardTargets) {
                  try {
                    await createMessageMutation.mutateAsync({
                      data: {
                        chat_room_id: targetRoomId,
                        message: forwardingMsg.message || '',
                      },
                    });
                    updateSidebarWithMessage(targetRoomId, {
                      message: forwardingMsg.message || '📷 Ảnh',
                      created_by: user?.id,
                      created_at: new Date().toISOString(),
                    });
                    queryClient.invalidateQueries({
                      queryKey: getChatMessagesControllerGetMessageHistoryQueryKey(targetRoomId),
                    });
                  } catch (error) {
                    console.error('Forward failed:', error);
                  }
                }
                setForwardingMsg(null);
                setForwardTargets([]);
                setForwardSearch('');
                toast({ title: 'Đã chuyển tiếp', description: `Chuyển tiếp tới ${forwardTargets.length} cuộc trò chuyện` });
              }}
            >
              Gửi
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
// MISSING LINE 1847
// MISSING LINE 1848
// MISSING LINE 1849
// MISSING LINE 1850
// MISSING LINE 1851
// MISSING LINE 1852
// MISSING LINE 1853
// MISSING LINE 1854
// MISSING LINE 1855
// MISSING LINE 1856
// MISSING LINE 1857
// MISSING LINE 1858
// MISSING LINE 1859
// MISSING LINE 1860
// MISSING LINE 1861
// MISSING LINE 1862
// MISSING LINE 1863
// MISSING LINE 1864
// MISSING LINE 1865
// MISSING LINE 1866
// MISSING LINE 1867
// MISSING LINE 1868
// MISSING LINE 1869
// MISSING LINE 1870
// MISSING LINE 1871
// MISSING LINE 1872
// MISSING LINE 1873
// MISSING LINE 1874
// MISSING LINE 1875
// MISSING LINE 1876
// MISSING LINE 1877
// MISSING LINE 1878
// MISSING LINE 1879
// MISSING LINE 1880
// MISSING LINE 1881
// MISSING LINE 1882
// MISSING LINE 1883
// MISSING LINE 1884
// MISSING LINE 1885
// MISSING LINE 1886
// MISSING LINE 1887
// MISSING LINE 1888
// MISSING LINE 1889
// MISSING LINE 1890
// MISSING LINE 1891
// MISSING LINE 1892
// MISSING LINE 1893
// MISSING LINE 1894
// MISSING LINE 1895
// MISSING LINE 1896
// MISSING LINE 1897
// MISSING LINE 1898
// MISSING LINE 1899
// MISSING LINE 1900
// MISSING LINE 1901
// MISSING LINE 1902
// MISSING LINE 1903
// MISSING LINE 1904
// MISSING LINE 1905
// MISSING LINE 1906
// MISSING LINE 1907
// MISSING LINE 1908
// MISSING LINE 1909
// MISSING LINE 1910
// MISSING LINE 1911
// MISSING LINE 1912
// MISSING LINE 1913
// MISSING LINE 1914
// MISSING LINE 1915
// MISSING LINE 1916
// MISSING LINE 1917
// MISSING LINE 1918
// MISSING LINE 1919
// MISSING LINE 1920
// MISSING LINE 1921
// MISSING LINE 1922
// MISSING LINE 1923
// MISSING LINE 1924
// MISSING LINE 1925
// MISSING LINE 1926
// MISSING LINE 1927
// MISSING LINE 1928
// MISSING LINE 1929
// MISSING LINE 1930
// MISSING LINE 1931
// MISSING LINE 1932
// MISSING LINE 1933
// MISSING LINE 1934
// MISSING LINE 1935
// MISSING LINE 1936
// MISSING LINE 1937
// MISSING LINE 1938
// MISSING LINE 1939
// MISSING LINE 1940
// MISSING LINE 1941
// MISSING LINE 1942
// MISSING LINE 1943
// MISSING LINE 1944
// MISSING LINE 1945
// MISSING LINE 1946
// MISSING LINE 1947
// MISSING LINE 1948
// MISSING LINE 1949
// MISSING LINE 1950
// MISSING LINE 1951
// MISSING LINE 1952
// MISSING LINE 1953
// MISSING LINE 1954
// MISSING LINE 1955
// MISSING LINE 1956
// MISSING LINE 1957
// MISSING LINE 1958
// MISSING LINE 1959
// MISSING LINE 1960
// MISSING LINE 1961
// MISSING LINE 1962
// MISSING LINE 1963
// MISSING LINE 1964
// MISSING LINE 1965
// MISSING LINE 1966
// MISSING LINE 1967
// MISSING LINE 1968
// MISSING LINE 1969
// MISSING LINE 1970
// MISSING LINE 1971
// MISSING LINE 1972
// MISSING LINE 1973
// MISSING LINE 1974
// MISSING LINE 1975
// MISSING LINE 1976
// MISSING LINE 1977
// MISSING LINE 1978
// MISSING LINE 1979
// MISSING LINE 1980
// MISSING LINE 1981
// MISSING LINE 1982
// MISSING LINE 1983
// MISSING LINE 1984
// MISSING LINE 1985
// MISSING LINE 1986
// MISSING LINE 1987
// MISSING LINE 1988
// MISSING LINE 1989
// MISSING LINE 1990
// MISSING LINE 1991
// MISSING LINE 1992
// MISSING LINE 1993
// MISSING LINE 1994
// MISSING LINE 1995
// MISSING LINE 1996
// MISSING LINE 1997
// MISSING LINE 1998
// MISSING LINE 1999
// MISSING LINE 2000
// MISSING LINE 2001
// MISSING LINE 2002
// MISSING LINE 2003
// MISSING LINE 2004
// MISSING LINE 2005
// MISSING LINE 2006
// MISSING LINE 2007
// MISSING LINE 2008
// MISSING LINE 2009
// MISSING LINE 2010
// MISSING LINE 2011
// MISSING LINE 2012
// MISSING LINE 2013
// MISSING LINE 2014
// MISSING LINE 2015
// MISSING LINE 2016
// MISSING LINE 2017
// MISSING LINE 2018
// MISSING LINE 2019
// MISSING LINE 2020
// MISSING LINE 2021
// MISSING LINE 2022
// MISSING LINE 2023
// MISSING LINE 2024
// MISSING LINE 2025
// MISSING LINE 2026
// MISSING LINE 2027
// MISSING LINE 2028
// MISSING LINE 2029
// MISSING LINE 2030
// MISSING LINE 2031
// MISSING LINE 2032
// MISSING LINE 2033
// MISSING LINE 2034
// MISSING LINE 2035
// MISSING LINE 2036
// MISSING LINE 2037
// MISSING LINE 2038
// MISSING LINE 2039
// MISSING LINE 2040
// MISSING LINE 2041
// MISSING LINE 2042
// MISSING LINE 2043
// MISSING LINE 2044
// MISSING LINE 2045
// MISSING LINE 2046
// MISSING LINE 2047
// MISSING LINE 2048
// MISSING LINE 2049
// MISSING LINE 2050
// MISSING LINE 2051
// MISSING LINE 2052
// MISSING LINE 2053
// MISSING LINE 2054
// MISSING LINE 2055
// MISSING LINE 2056
// MISSING LINE 2057
// MISSING LINE 2058
// MISSING LINE 2059
// MISSING LINE 2060
// MISSING LINE 2061
// MISSING LINE 2062
// MISSING LINE 2063
// MISSING LINE 2064
// MISSING LINE 2065
// MISSING LINE 2066
// MISSING LINE 2067
// MISSING LINE 2068
// MISSING LINE 2069
// MISSING LINE 2070
// MISSING LINE 2071
// MISSING LINE 2072
// MISSING LINE 2073
// MISSING LINE 2074
// MISSING LINE 2075
// MISSING LINE 2076
// MISSING LINE 2077
// MISSING LINE 2078
// MISSING LINE 2079
// MISSING LINE 2080
// MISSING LINE 2081
// MISSING LINE 2082
// MISSING LINE 2083
// MISSING LINE 2084
// MISSING LINE 2085
// MISSING LINE 2086
// MISSING LINE 2087
// MISSING LINE 2088
// MISSING LINE 2089
// MISSING LINE 2090
// MISSING LINE 2091
// MISSING LINE 2092
// MISSING LINE 2093
// MISSING LINE 2094
// MISSING LINE 2095
// MISSING LINE 2096
// MISSING LINE 2097
// MISSING LINE 2098
// MISSING LINE 2099
// MISSING LINE 2100
// MISSING LINE 2101
// MISSING LINE 2102
// MISSING LINE 2103
// MISSING LINE 2104
// MISSING LINE 2105
// MISSING LINE 2106
// MISSING LINE 2107
// MISSING LINE 2108
// MISSING LINE 2109
// MISSING LINE 2110
// MISSING LINE 2111
// MISSING LINE 2112
// MISSING LINE 2113
// MISSING LINE 2114
// MISSING LINE 2115
// MISSING LINE 2116
// MISSING LINE 2117
// MISSING LINE 2118
// MISSING LINE 2119
// MISSING LINE 2120
// MISSING LINE 2121
// MISSING LINE 2122
// MISSING LINE 2123
// MISSING LINE 2124
// MISSING LINE 2125
// MISSING LINE 2126
// MISSING LINE 2127
// MISSING LINE 2128
// MISSING LINE 2129
// MISSING LINE 2130
// MISSING LINE 2131
// MISSING LINE 2132
// MISSING LINE 2133
// MISSING LINE 2134
// MISSING LINE 2135
// MISSING LINE 2136
// MISSING LINE 2137
// MISSING LINE 2138
// MISSING LINE 2139
// MISSING LINE 2140
// MISSING LINE 2141
// MISSING LINE 2142
// MISSING LINE 2143
// MISSING LINE 2144
// MISSING LINE 2145
// MISSING LINE 2146
// MISSING LINE 2147
// MISSING LINE 2148
// MISSING LINE 2149
// MISSING LINE 2150
// MISSING LINE 2151
// MISSING LINE 2152
// MISSING LINE 2153
// MISSING LINE 2154
// MISSING LINE 2155
// MISSING LINE 2156
// MISSING LINE 2157
// MISSING LINE 2158
// MISSING LINE 2159
// MISSING LINE 2160
// MISSING LINE 2161
// MISSING LINE 2162
// MISSING LINE 2163
// MISSING LINE 2164
// MISSING LINE 2165
// MISSING LINE 2166
// MISSING LINE 2167
// MISSING LINE 2168
// MISSING LINE 2169
// MISSING LINE 2170
// MISSING LINE 2171
// MISSING LINE 2172
// MISSING LINE 2173
// MISSING LINE 2174
// MISSING LINE 2175
// MISSING LINE 2176
// MISSING LINE 2177
// MISSING LINE 2178
// MISSING LINE 2179
// MISSING LINE 2180
// MISSING LINE 2181
// MISSING LINE 2182
// MISSING LINE 2183
// MISSING LINE 2184
// MISSING LINE 2185
// MISSING LINE 2186
// MISSING LINE 2187
// MISSING LINE 2188
// MISSING LINE 2189
// MISSING LINE 2190
// MISSING LINE 2191
// MISSING LINE 2192
// MISSING LINE 2193
    "schemas": {
      "Relation": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "request_side_id": {
            "type": "string"
          },
          "accept_side_id": {
            "type": "string"
          },
          "request_side": {
            "$ref": "#/components/schemas/User"
          },
          "accept_side": {
            "$ref": "#/components/schemas/User"
          },
          "relation_type": {
            "type": "string",
            "enum": [
              "following",
              "block",
              "none"
            ]
          },
          "created_at": {
            "format": "date-time",
            "type": "string"
          }
        },
        "required": [
          "id",
          "request_side_id",
          "accept_side_id",
          "request_side",
          "accept_side",
          "relation_type",
          "created_at"
        ]
      },
      "Notification": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "message": {
            "type": "string"
          },
          "notification_type": {
            "type": "string",
            "enum": [
              "like",
              "comment",
              "follow",
              "reaction",
              "system"
            ]
          },
          "created_at": {
            "format": "date-time",
            "type": "string"
          },
          "notification_user": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/NotificationUser"
            }
          }
        },
        "required": [
          "id",
          "title",
          "message",
          "notification_type",
          "created_at",
          "notification_user"
        ]
      },
      "NotificationUser": {
        "type": "object",
        "properties": {
// MISSING LINE 2281
// MISSING LINE 2282
// MISSING LINE 2283
// MISSING LINE 2284
// MISSING LINE 2285
// MISSING LINE 2286
// MISSING LINE 2287
// MISSING LINE 2288
// MISSING LINE 2289
// MISSING LINE 2290
// MISSING LINE 2291
// MISSING LINE 2292
// MISSING LINE 2293
// MISSING LINE 2294
// MISSING LINE 2295
// MISSING LINE 2296
// MISSING LINE 2297
// MISSING LINE 2298
// MISSING LINE 2299
// MISSING LINE 2300
// MISSING LINE 2301
// MISSING LINE 2302
// MISSING LINE 2303
// MISSING LINE 2304
// MISSING LINE 2305
// MISSING LINE 2306
// MISSING LINE 2307
// MISSING LINE 2308
// MISSING LINE 2309
// MISSING LINE 2310
// MISSING LINE 2311
// MISSING LINE 2312
// MISSING LINE 2313
// MISSING LINE 2314
// MISSING LINE 2315
// MISSING LINE 2316
// MISSING LINE 2317
// MISSING LINE 2318
// MISSING LINE 2319
// MISSING LINE 2320
// MISSING LINE 2321
// MISSING LINE 2322
// MISSING LINE 2323
// MISSING LINE 2324
// MISSING LINE 2325
// MISSING LINE 2326
// MISSING LINE 2327
// MISSING LINE 2328
// MISSING LINE 2329
// MISSING LINE 2330
// MISSING LINE 2331
// MISSING LINE 2332
// MISSING LINE 2333
// MISSING LINE 2334
// MISSING LINE 2335
// MISSING LINE 2336
// MISSING LINE 2337
// MISSING LINE 2338
// MISSING LINE 2339
// MISSING LINE 2340
// MISSING LINE 2341
// MISSING LINE 2342
// MISSING LINE 2343
// MISSING LINE 2344
// MISSING LINE 2345
// MISSING LINE 2346
// MISSING LINE 2347
// MISSING LINE 2348
// MISSING LINE 2349
// MISSING LINE 2350
// MISSING LINE 2351
// MISSING LINE 2352
// MISSING LINE 2353
// MISSING LINE 2354
// MISSING LINE 2355
// MISSING LINE 2356
// MISSING LINE 2357
// MISSING LINE 2358
// MISSING LINE 2359
// MISSING LINE 2360
// MISSING LINE 2361
// MISSING LINE 2362
// MISSING LINE 2363
// MISSING LINE 2364
// MISSING LINE 2365
// MISSING LINE 2366
// MISSING LINE 2367
// MISSING LINE 2368
// MISSING LINE 2369
// MISSING LINE 2370
// MISSING LINE 2371
// MISSING LINE 2372
// MISSING LINE 2373
// MISSING LINE 2374
// MISSING LINE 2375
// MISSING LINE 2376
// MISSING LINE 2377
// MISSING LINE 2378
// MISSING LINE 2379
// MISSING LINE 2380
// MISSING LINE 2381
// MISSING LINE 2382
// MISSING LINE 2383
// MISSING LINE 2384
// MISSING LINE 2385
// MISSING LINE 2386
// MISSING LINE 2387
// MISSING LINE 2388
// MISSING LINE 2389
// MISSING LINE 2390
// MISSING LINE 2391
// MISSING LINE 2392
// MISSING LINE 2393
// MISSING LINE 2394
// MISSING LINE 2395
// MISSING LINE 2396
// MISSING LINE 2397
// MISSING LINE 2398
// MISSING LINE 2399
// MISSING LINE 2400
// MISSING LINE 2401
// MISSING LINE 2402
// MISSING LINE 2403
// MISSING LINE 2404
// MISSING LINE 2405
// MISSING LINE 2406
// MISSING LINE 2407
// MISSING LINE 2408
// MISSING LINE 2409
// MISSING LINE 2410
// MISSING LINE 2411
// MISSING LINE 2412
// MISSING LINE 2413
// MISSING LINE 2414
// MISSING LINE 2415
// MISSING LINE 2416
// MISSING LINE 2417
// MISSING LINE 2418
// MISSING LINE 2419
// MISSING LINE 2420
// MISSING LINE 2421
// MISSING LINE 2422
// MISSING LINE 2423
// MISSING LINE 2424
// MISSING LINE 2425
// MISSING LINE 2426
// MISSING LINE 2427
// MISSING LINE 2428
// MISSING LINE 2429
// MISSING LINE 2430
// MISSING LINE 2431
// MISSING LINE 2432
// MISSING LINE 2433
// MISSING LINE 2434
// MISSING LINE 2435
// MISSING LINE 2436
// MISSING LINE 2437
// MISSING LINE 2438
// MISSING LINE 2439
// MISSING LINE 2440
// MISSING LINE 2441
// MISSING LINE 2442
// MISSING LINE 2443
// MISSING LINE 2444
// MISSING LINE 2445
// MISSING LINE 2446
// MISSING LINE 2447
// MISSING LINE 2448
// MISSING LINE 2449
// MISSING LINE 2450
// MISSING LINE 2451
// MISSING LINE 2452
// MISSING LINE 2453
// MISSING LINE 2454
// MISSING LINE 2455
// MISSING LINE 2456
// MISSING LINE 2457
// MISSING LINE 2458
// MISSING LINE 2459
// MISSING LINE 2460
// MISSING LINE 2461
// MISSING LINE 2462
// MISSING LINE 2463
// MISSING LINE 2464
// MISSING LINE 2465
// MISSING LINE 2466
// MISSING LINE 2467
// MISSING LINE 2468
// MISSING LINE 2469
// MISSING LINE 2470
// MISSING LINE 2471
// MISSING LINE 2472
// MISSING LINE 2473
// MISSING LINE 2474
// MISSING LINE 2475
// MISSING LINE 2476
// MISSING LINE 2477
// MISSING LINE 2478
// MISSING LINE 2479
// MISSING LINE 2480
// MISSING LINE 2481
// MISSING LINE 2482
// MISSING LINE 2483
// MISSING LINE 2484
// MISSING LINE 2485
// MISSING LINE 2486
// MISSING LINE 2487
// MISSING LINE 2488
// MISSING LINE 2489
// MISSING LINE 2490
// MISSING LINE 2491
// MISSING LINE 2492
// MISSING LINE 2493
// MISSING LINE 2494
// MISSING LINE 2495
// MISSING LINE 2496
// MISSING LINE 2497
// MISSING LINE 2498
// MISSING LINE 2499
// MISSING LINE 2500
// MISSING LINE 2501
// MISSING LINE 2502
// MISSING LINE 2503
// MISSING LINE 2504
// MISSING LINE 2505
// MISSING LINE 2506
// MISSING LINE 2507
// MISSING LINE 2508
// MISSING LINE 2509
// MISSING LINE 2510
// MISSING LINE 2511
// MISSING LINE 2512
// MISSING LINE 2513
// MISSING LINE 2514
// MISSING LINE 2515
// MISSING LINE 2516
// MISSING LINE 2517
// MISSING LINE 2518
// MISSING LINE 2519
// MISSING LINE 2520
// MISSING LINE 2521
// MISSING LINE 2522
// MISSING LINE 2523
// MISSING LINE 2524
// MISSING LINE 2525
// MISSING LINE 2526
// MISSING LINE 2527
// MISSING LINE 2528
// MISSING LINE 2529
// MISSING LINE 2530
// MISSING LINE 2531
// MISSING LINE 2532
// MISSING LINE 2533
// MISSING LINE 2534
// MISSING LINE 2535
// MISSING LINE 2536
// MISSING LINE 2537
// MISSING LINE 2538
// MISSING LINE 2539
// MISSING LINE 2540
// MISSING LINE 2541
// MISSING LINE 2542
// MISSING LINE 2543
// MISSING LINE 2544
// MISSING LINE 2545
// MISSING LINE 2546
// MISSING LINE 2547
// MISSING LINE 2548
// MISSING LINE 2549
// MISSING LINE 2550
// MISSING LINE 2551
// MISSING LINE 2552
// MISSING LINE 2553
// MISSING LINE 2554
// MISSING LINE 2555
// MISSING LINE 2556
// MISSING LINE 2557
// MISSING LINE 2558
// MISSING LINE 2559
// MISSING LINE 2560
// MISSING LINE 2561
// MISSING LINE 2562
// MISSING LINE 2563
// MISSING LINE 2564
// MISSING LINE 2565
// MISSING LINE 2566
// MISSING LINE 2567
// MISSING LINE 2568
// MISSING LINE 2569
// MISSING LINE 2570
// MISSING LINE 2571
// MISSING LINE 2572
// MISSING LINE 2573
// MISSING LINE 2574
// MISSING LINE 2575
// MISSING LINE 2576
// MISSING LINE 2577
// MISSING LINE 2578
// MISSING LINE 2579
// MISSING LINE 2580
// MISSING LINE 2581
// MISSING LINE 2582
// MISSING LINE 2583
// MISSING LINE 2584
// MISSING LINE 2585
// MISSING LINE 2586
// MISSING LINE 2587
// MISSING LINE 2588
// MISSING LINE 2589
// MISSING LINE 2590
// MISSING LINE 2591
// MISSING LINE 2592
// MISSING LINE 2593
// MISSING LINE 2594
// MISSING LINE 2595
// MISSING LINE 2596
// MISSING LINE 2597
// MISSING LINE 2598
// MISSING LINE 2599
// MISSING LINE 2600
// MISSING LINE 2601
// MISSING LINE 2602
// MISSING LINE 2603
// MISSING LINE 2604
// MISSING LINE 2605
// MISSING LINE 2606
// MISSING LINE 2607
// MISSING LINE 2608
// MISSING LINE 2609
// MISSING LINE 2610
// MISSING LINE 2611
// MISSING LINE 2612
// MISSING LINE 2613
// MISSING LINE 2614
// MISSING LINE 2615
// MISSING LINE 2616
// MISSING LINE 2617
// MISSING LINE 2618
// MISSING LINE 2619
// MISSING LINE 2620
// MISSING LINE 2621
// MISSING LINE 2622
// MISSING LINE 2623
// MISSING LINE 2624
// MISSING LINE 2625
// MISSING LINE 2626
// MISSING LINE 2627
// MISSING LINE 2628
// MISSING LINE 2629
// MISSING LINE 2630
// MISSING LINE 2631
// MISSING LINE 2632
// MISSING LINE 2633
// MISSING LINE 2634
// MISSING LINE 2635
// MISSING LINE 2636
// MISSING LINE 2637
// MISSING LINE 2638
// MISSING LINE 2639
// MISSING LINE 2640
// MISSING LINE 2641
// MISSING LINE 2642
// MISSING LINE 2643
// MISSING LINE 2644
// MISSING LINE 2645
// MISSING LINE 2646
// MISSING LINE 2647
// MISSING LINE 2648
// MISSING LINE 2649
// MISSING LINE 2650
// MISSING LINE 2651
// MISSING LINE 2652
// MISSING LINE 2653
// MISSING LINE 2654
// MISSING LINE 2655
// MISSING LINE 2656
// MISSING LINE 2657
// MISSING LINE 2658
// MISSING LINE 2659
// MISSING LINE 2660
// MISSING LINE 2661
// MISSING LINE 2662
// MISSING LINE 2663
// MISSING LINE 2664
// MISSING LINE 2665
// MISSING LINE 2666
// MISSING LINE 2667
// MISSING LINE 2668
// MISSING LINE 2669
// MISSING LINE 2670
// MISSING LINE 2671
// MISSING LINE 2672
// MISSING LINE 2673
// MISSING LINE 2674
// MISSING LINE 2675
// MISSING LINE 2676
// MISSING LINE 2677
// MISSING LINE 2678
// MISSING LINE 2679
// MISSING LINE 2680
// MISSING LINE 2681
// MISSING LINE 2682
// MISSING LINE 2683
// MISSING LINE 2684
// MISSING LINE 2685
// MISSING LINE 2686
// MISSING LINE 2687
// MISSING LINE 2688
// MISSING LINE 2689
// MISSING LINE 2690
// MISSING LINE 2691
// MISSING LINE 2692
// MISSING LINE 2693
// MISSING LINE 2694
// MISSING LINE 2695
// MISSING LINE 2696
// MISSING LINE 2697
// MISSING LINE 2698
// MISSING LINE 2699
// MISSING LINE 2700
// MISSING LINE 2701
// MISSING LINE 2702
// MISSING LINE 2703
// MISSING LINE 2704
// MISSING LINE 2705
// MISSING LINE 2706
// MISSING LINE 2707
// MISSING LINE 2708
// MISSING LINE 2709
// MISSING LINE 2710
// MISSING LINE 2711
// MISSING LINE 2712
// MISSING LINE 2713
// MISSING LINE 2714
// MISSING LINE 2715
// MISSING LINE 2716
// MISSING LINE 2717
// MISSING LINE 2718
// MISSING LINE 2719
// MISSING LINE 2720
// MISSING LINE 2721
// MISSING LINE 2722
// MISSING LINE 2723
// MISSING LINE 2724
// MISSING LINE 2725
// MISSING LINE 2726
// MISSING LINE 2727
// MISSING LINE 2728
// MISSING LINE 2729
// MISSING LINE 2730
// MISSING LINE 2731
// MISSING LINE 2732
// MISSING LINE 2733
// MISSING LINE 2734
// MISSING LINE 2735
// MISSING LINE 2736
// MISSING LINE 2737
// MISSING LINE 2738
// MISSING LINE 2739
// MISSING LINE 2740
// MISSING LINE 2741
// MISSING LINE 2742
// MISSING LINE 2743
// MISSING LINE 2744
// MISSING LINE 2745
// MISSING LINE 2746
// MISSING LINE 2747
// MISSING LINE 2748
// MISSING LINE 2749
// MISSING LINE 2750
// MISSING LINE 2751
// MISSING LINE 2752
// MISSING LINE 2753
// MISSING LINE 2754
// MISSING LINE 2755
// MISSING LINE 2756
// MISSING LINE 2757
// MISSING LINE 2758
// MISSING LINE 2759
// MISSING LINE 2760
// MISSING LINE 2761
// MISSING LINE 2762
// MISSING LINE 2763
// MISSING LINE 2764
// MISSING LINE 2765
// MISSING LINE 2766
// MISSING LINE 2767
// MISSING LINE 2768
// MISSING LINE 2769
// MISSING LINE 2770
// MISSING LINE 2771
// MISSING LINE 2772
// MISSING LINE 2773
// MISSING LINE 2774
// MISSING LINE 2775
// MISSING LINE 2776
// MISSING LINE 2777
// MISSING LINE 2778
// MISSING LINE 2779
// MISSING LINE 2780
// MISSING LINE 2781
// MISSING LINE 2782
// MISSING LINE 2783
// MISSING LINE 2784
// MISSING LINE 2785
// MISSING LINE 2786
// MISSING LINE 2787
// MISSING LINE 2788
// MISSING LINE 2789
// MISSING LINE 2790
// MISSING LINE 2791
// MISSING LINE 2792
// MISSING LINE 2793
// MISSING LINE 2794
// MISSING LINE 2795
// MISSING LINE 2796
// MISSING LINE 2797
// MISSING LINE 2798
// MISSING LINE 2799
// MISSING LINE 2800
// MISSING LINE 2801
// MISSING LINE 2802
// MISSING LINE 2803
// MISSING LINE 2804
// MISSING LINE 2805
// MISSING LINE 2806
// MISSING LINE 2807
// MISSING LINE 2808
// MISSING LINE 2809
// MISSING LINE 2810
// MISSING LINE 2811
// MISSING LINE 2812
// MISSING LINE 2813
// MISSING LINE 2814
// MISSING LINE 2815
// MISSING LINE 2816
// MISSING LINE 2817
// MISSING LINE 2818
// MISSING LINE 2819
// MISSING LINE 2820
// MISSING LINE 2821
// MISSING LINE 2822
// MISSING LINE 2823
// MISSING LINE 2824
// MISSING LINE 2825
// MISSING LINE 2826
// MISSING LINE 2827
// MISSING LINE 2828
// MISSING LINE 2829
// MISSING LINE 2830
// MISSING LINE 2831
// MISSING LINE 2832
// MISSING LINE 2833
// MISSING LINE 2834
// MISSING LINE 2835
// MISSING LINE 2836
// MISSING LINE 2837
// MISSING LINE 2838
// MISSING LINE 2839
// MISSING LINE 2840
// MISSING LINE 2841
// MISSING LINE 2842
// MISSING LINE 2843
// MISSING LINE 2844
// MISSING LINE 2845
// MISSING LINE 2846
// MISSING LINE 2847
// MISSING LINE 2848
// MISSING LINE 2849
// MISSING LINE 2850
// MISSING LINE 2851
// MISSING LINE 2852
// MISSING LINE 2853
// MISSING LINE 2854
// MISSING LINE 2855
// MISSING LINE 2856
// MISSING LINE 2857
// MISSING LINE 2858
// MISSING LINE 2859
// MISSING LINE 2860
// MISSING LINE 2861
// MISSING LINE 2862
// MISSING LINE 2863
// MISSING LINE 2864
// MISSING LINE 2865
// MISSING LINE 2866
// MISSING LINE 2867
// MISSING LINE 2868
// MISSING LINE 2869
// MISSING LINE 2870
// MISSING LINE 2871
// MISSING LINE 2872
// MISSING LINE 2873
// MISSING LINE 2874
// MISSING LINE 2875
// MISSING LINE 2876
// MISSING LINE 2877
// MISSING LINE 2878
// MISSING LINE 2879
// MISSING LINE 2880
// MISSING LINE 2881
// MISSING LINE 2882
// MISSING LINE 2883
// MISSING LINE 2884
// MISSING LINE 2885
// MISSING LINE 2886
// MISSING LINE 2887
// MISSING LINE 2888
// MISSING LINE 2889
// MISSING LINE 2890
// MISSING LINE 2891
// MISSING LINE 2892
// MISSING LINE 2893
// MISSING LINE 2894
// MISSING LINE 2895
// MISSING LINE 2896
// MISSING LINE 2897
// MISSING LINE 2898
// MISSING LINE 2899
// MISSING LINE 2900
// MISSING LINE 2901
// MISSING LINE 2902
// MISSING LINE 2903
// MISSING LINE 2904
// MISSING LINE 2905
// MISSING LINE 2906
// MISSING LINE 2907
// MISSING LINE 2908
// MISSING LINE 2909
      "User": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "email": {
            "type": "string"
          },
          "password": {
            "type": "string",
            "minLength": 8,
            "maxLength": 15
          },
          "avatar": {
            "type": "string"
          },
          "cover_photo": {
            "type": "string"
          },
          "username": {
            "type": "string"
          },
          "bio": {
            "type": "string"
          },
          "website": {
            "type": "string"
          },
          "birthday": {
            "format": "date-time",
            "type": "string"
          },
          "gender": {
            "type": "string",
            "enum": [
              "male",
              "female",
              "other"
            ]
          },
          "address": {
            "type": "string"
          },
          "privacy": {
            "type": "string",
            "enum": [
              "public",
              "follower",
              "private"
            ]
          },
          "message_privacy": {
            "type": "string",
            "enum": [
              "
// MISSING LINE 2966
// MISSING LINE 2967
// MISSING LINE 2968
// MISSING LINE 2969
// MISSING LINE 2970
// MISSING LINE 2971
// MISSING LINE 2972
// MISSING LINE 2973
// MISSING LINE 2974
// MISSING LINE 2975
// MISSING LINE 2976
// MISSING LINE 2977
// MISSING LINE 2978
// MISSING LINE 2979
// MISSING LINE 2980
// MISSING LINE 2981
// MISSING LINE 2982
// MISSING LINE 2983
// MISSING LINE 2984
// MISSING LINE 2985
// MISSING LINE 2986
// MISSING LINE 2987
// MISSING LINE 2988
// MISSING LINE 2989
// MISSING LINE 2990
// MISSING LINE 2991
// MISSING LINE 2992
// MISSING LINE 2993
            "type": "string",
            "enum": [
              "user",
              "admin"
            ]
          },
          "created_at": {
            "format": "date-time",
            "type": "string"
          },
          "updated_at": {
            "format": "date-time",
            "type": "string"
          },
          "device_sessions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/DeviceSession"
            }
          },
          "sent_relations": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Relation"
            }
          },
          "received_relations": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Relation"
            }
          },
          "notification_users": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/NotificationUser"
            }
          },
          "chat_rooms": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ChatRoom"
            }
          },
          "chat_members": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ChatMember"
            }
          },
          "chat_messages": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ChatMessage"
            }
          },
          "posts": {
// MISSING LINE 3051
// MISSING LINE 3052
// MISSING LINE 3053
// MISSING LINE 3054
// MISSING LINE 3055
// MISSING LINE 3056
// MISSING LINE 3057
// MISSING LINE 3058
// MISSING LINE 3059
// MISSING LINE 3060
// MISSING LINE 3061
// MISSING LINE 3062
// MISSING LINE 3063
// MISSING LINE 3064
// MISSING LINE 3065
// MISSING LINE 3066
// MISSING LINE 3067
// MISSING LINE 3068
// MISSING LINE 3069
// MISSING LINE 3070
// MISSING LINE 3071
// MISSING LINE 3072
// MISSING LINE 3073
// MISSING LINE 3074
// MISSING LINE 3075
// MISSING LINE 3076
// MISSING LINE 3077
// MISSING LINE 3078
// MISSING LINE 3079
// MISSING LINE 3080
// MISSING LINE 3081
// MISSING LINE 3082
// MISSING LINE 3083
// MISSING LINE 3084
// MISSING LINE 3085
// MISSING LINE 3086
// MISSING LINE 3087
// MISSING LINE 3088
// MISSING LINE 3089
// MISSING LINE 3090
// MISSING LINE 3091
// MISSING LINE 3092
// MISSING LINE 3093
// MISSING LINE 3094
// MISSING LINE 3095
// MISSING LINE 3096
// MISSING LINE 3097
// MISSING LINE 3098
// MISSING LINE 3099
// MISSING LINE 3100
// MISSING LINE 3101
// MISSING LINE 3102
// MISSING LINE 3103
// MISSING LINE 3104
// MISSING LINE 3105
// MISSING LINE 3106
// MISSING LINE 3107
// MISSING LINE 3108
// MISSING LINE 3109
// MISSING LINE 3110
// MISSING LINE 3111
// MISSING LINE 3112
// MISSING LINE 3113
// MISSING LINE 3114
// MISSING LINE 3115
// MISSING LINE 3116
// MISSING LINE 3117
// MISSING LINE 3118
// MISSING LINE 3119
// MISSING LINE 3120
// MISSING LINE 3121
// MISSING LINE 3122
// MISSING LINE 3123
// MISSING LINE 3124
// MISSING LINE 3125
// MISSING LINE 3126
// MISSING LINE 3127
// MISSING LINE 3128
// MISSING LINE 3129
// MISSING LINE 3130
// MISSING LINE 3131
// MISSING LINE 3132
// MISSING LINE 3133
// MISSING LINE 3134
// MISSING LINE 3135
// MISSING LINE 3136
// MISSING LINE 3137
// MISSING LINE 3138
// MISSING LINE 3139
// MISSING LINE 3140
// MISSING LINE 3141
// MISSING LINE 3142
// MISSING LINE 3143
// MISSING LINE 3144
// MISSING LINE 3145
// MISSING LINE 3146
// MISSING LINE 3147
// MISSING LINE 3148
// MISSING LINE 3149
// MISSING LINE 3150
// MISSING LINE 3151
// MISSING LINE 3152
// MISSING LINE 3153
// MISSING LINE 3154
// MISSING LINE 3155
// MISSING LINE 3156
// MISSING LINE 3157
// MISSING LINE 3158
// MISSING LINE 3159
// MISSING LINE 3160
// MISSING LINE 3161
// MISSING LINE 3162
// MISSING LINE 3163
// MISSING LINE 3164
// MISSING LINE 3165
// MISSING LINE 3166
// MISSING LINE 3167
// MISSING LINE 3168
// MISSING LINE 3169
// MISSING LINE 3170
// MISSING LINE 3171
// MISSING LINE 3172
// MISSING LINE 3173
// MISSING LINE 3174
// MISSING LINE 3175
// MISSING LINE 3176
// MISSING LINE 3177
// MISSING LINE 3178
// MISSING LINE 3179
// MISSING LINE 3180
// MISSING LINE 3181
// MISSING LINE 3182
// MISSING LINE 3183
// MISSING LINE 3184
// MISSING LINE 3185
// MISSING LINE 3186
// MISSING LINE 3187
// MISSING LINE 3188
// MISSING LINE 3189
// MISSING LINE 3190
// MISSING LINE 3191
// MISSING LINE 3192
// MISSING LINE 3193
// MISSING LINE 3194
// MISSING LINE 3195
// MISSING LINE 3196
// MISSING LINE 3197
// MISSING LINE 3198
// MISSING LINE 3199
// MISSING LINE 3200
// MISSING LINE 3201
// MISSING LINE 3202
// MISSING LINE 3203
// MISSING LINE 3204
// MISSING LINE 3205
// MISSING LINE 3206
// MISSING LINE 3207
// MISSING LINE 3208
// MISSING LINE 3209
// MISSING LINE 3210
// MISSING LINE 3211
// MISSING LINE 3212
// MISSING LINE 3213
// MISSING LINE 3214
// MISSING LINE 3215
// MISSING LINE 3216
// MISSING LINE 3217
// MISSING LINE 3218
// MISSING LINE 3219
// MISSING LINE 3220
// MISSING LINE 3221
// MISSING LINE 3222
// MISSING LINE 3223
// MISSING LINE 3224
// MISSING LINE 3225
// MISSING LINE 3226
// MISSING LINE 3227
// MISSING LINE 3228
// MISSING LINE 3229
// MISSING LINE 3230
// MISSING LINE 3231
// MISSING LINE 3232
// MISSING LINE 3233
// MISSING LINE 3234
// MISSING LINE 3235
// MISSING LINE 3236
// MISSING LINE 3237
// MISSING LINE 3238
// MISSING LINE 3239
// MISSING LINE 3240
// MISSING LINE 3241
// MISSING LINE 3242
// MISSING LINE 3243
// MISSING LINE 3244
// MISSING LINE 3245
// MISSING LINE 3246
// MISSING LINE 3247
// MISSING LINE 3248
// MISSING LINE 3249
// MISSING LINE 3250
// MISSING LINE 3251
// MISSING LINE 3252
// MISSING LINE 3253
// MISSING LINE 3254
// MISSING LINE 3255
// MISSING LINE 3256
// MISSING LINE 3257
// MISSING LINE 3258
// MISSING LINE 3259
// MISSING LINE 3260
// MISSING LINE 3261
// MISSING LINE 3262
// MISSING LINE 3263
// MISSING LINE 3264
// MISSING LINE 3265
// MISSING LINE 3266
// MISSING LINE 3267
// MISSING LINE 3268
// MISSING LINE 3269
// MISSING LINE 3270
// MISSING LINE 3271
// MISSING LINE 3272
// MISSING LINE 3273
// MISSING LINE 3274
// MISSING LINE 3275
// MISSING LINE 3276
// MISSING LINE 3277
// MISSING LINE 3278
// MISSING LINE 3279
// MISSING LINE 3280
// MISSING LINE 3281
// MISSING LINE 3282
// MISSING LINE 3283
// MISSING LINE 3284
// MISSING LINE 3285
// MISSING LINE 3286
// MISSING LINE 3287
// MISSING LINE 3288
// MISSING LINE 3289
// MISSING LINE 3290
// MISSING LINE 3291
// MISSING LINE 3292
// MISSING LINE 3293
// MISSING LINE 3294
// MISSING LINE 3295
// MISSING LINE 3296
// MISSING LINE 3297
// MISSING LINE 3298
// MISSING LINE 3299
// MISSING LINE 3300
// MISSING LINE 3301
// MISSING LINE 3302
// MISSING LINE 3303
// MISSING LINE 3304
// MISSING LINE 3305
// MISSING LINE 3306
// MISSING LINE 3307
// MISSING LINE 3308
// MISSING LINE 3309
      return useMutation(getNotificationUsersControllerDeleteAllNotiMutationOptions(options), queryClient);
    }
// MISSING LINE 3312
export type chatRoomsControllerGetListChatRoomResponse200 = {
  data: void
  status: 200
}
// MISSING LINE 3317
export type chatRoomsControllerGetListChatRoomResponseSuccess = (chatRoomsControllerGetListChatRoomResponse200) & {
  headers: Headers;
};
;
// MISSING LINE 3322
export type chatRoomsControllerGetListChatRoomResponse = (chatRoomsControllerGetListChatRoomResponseSuccess)
// MISSING LINE 3324
export const getChatRoomsControllerGetListChatRoomUrl = (params?: ChatRoomsControllerGetListChatRoomParams,) => {
  const normalizedParams = new URLSearchParams();
// MISSING LINE 3327
  Object.entries(params || {}).forEach(([key, value]) => {
// MISSING LINE 3329
    if (value !== undefined) {
// MISSING LINE 3331
// MISSING LINE 3332
// MISSING LINE 3333
// MISSING LINE 3334
// MISSING LINE 3335
// MISSING LINE 3336
// MISSING LINE 3337
// MISSING LINE 3338
// MISSING LINE 3339
/**
 * @summary Get list chat room
 */
export const chatRoomsControllerGetListChatRoom = async (params?: ChatRoomsControllerGetListChatRoomParams, options?: RequestInit): Promise<chatRoomsControllerGetListChatRoomResponse> => {
// MISSING LINE 3344
  return orvalClient<chatRoomsControllerGetListChatRoomResponse>(getChatRoomsControllerGetListChatRoomUrl(params),
  {
    ...options,
    method: 'GET'
// MISSING LINE 3349
// MISSING LINE 3350
  }
);}
// MISSING LINE 3353
// MISSING LINE 3354
// MISSING LINE 3355
// MISSING LINE 3356
// MISSING LINE 3357
export const getChatRoomsControllerGetListChatRoomInfiniteQueryKey = (params?: ChatRoomsControllerGetListChatRoomParams,) => {
    return [
    'infinite', `/chat-rooms`, ...(params ? [params] : [])
// MISSING LINE 3361
// MISSING LINE 3362
// MISSING LINE 3363
// MISSING LINE 3364
// MISSING LINE 3365
// MISSING LINE 3366
// MISSING LINE 3367
// MISSING LINE 3368
// MISSING LINE 3369
// MISSING LINE 3370
// MISSING LINE 3371
// MISSING LINE 3372
// MISSING LINE 3373
// MISSING LINE 3374
// MISSING LINE 3375
// MISSING LINE 3376
// MISSING LINE 3377
// MISSING LINE 3378
// MISSING LINE 3379
// MISSING LINE 3380
// MISSING LINE 3381
// MISSING LINE 3382
// MISSING LINE 3383
// MISSING LINE 3384
// MISSING LINE 3385
// MISSING LINE 3386
// MISSING LINE 3387
// MISSING LINE 3388
// MISSING LINE 3389
// MISSING LINE 3390
// MISSING LINE 3391
// MISSING LINE 3392
// MISSING LINE 3393
// MISSING LINE 3394
// MISSING LINE 3395
// MISSING LINE 3396
// MISSING LINE 3397
// MISSING LINE 3398
// MISSING LINE 3399
// MISSING LINE 3400
// MISSING LINE 3401
// MISSING LINE 3402
// MISSING LINE 3403
// MISSING LINE 3404
// MISSING LINE 3405
// MISSING LINE 3406
// MISSING LINE 3407
// MISSING LINE 3408
// MISSING LINE 3409
// MISSING LINE 3410
// MISSING LINE 3411
// MISSING LINE 3412
// MISSING LINE 3413
// MISSING LINE 3414
// MISSING LINE 3415
// MISSING LINE 3416
// MISSING LINE 3417
// MISSING LINE 3418
// MISSING LINE 3419
// MISSING LINE 3420
// MISSING LINE 3421
// MISSING LINE 3422
// MISSING LINE 3423
// MISSING LINE 3424
// MISSING LINE 3425
// MISSING LINE 3426
// MISSING LINE 3427
// MISSING LINE 3428
// MISSING LINE 3429
// MISSING LINE 3430
// MISSING LINE 3431
// MISSING LINE 3432
// MISSING LINE 3433
// MISSING LINE 3434
// MISSING LINE 3435
// MISSING LINE 3436
// MISSING LINE 3437
// MISSING LINE 3438
// MISSING LINE 3439
        Awaited<ReturnType<typeof notificationUsersControllerDeleteAllNoti>>,
        TError,
        void,
        TContext
      > => {
      return useMutation(getNotificationUsersControllerDeleteAllNotiMutationOptions(options), queryClient);
    }
// MISSING LINE 3447
export type chatRoomsControllerGetListChatRoomResponse200 = {
  data: void
  status: 200
}
// MISSING LINE 3452
export type chatRoomsControllerGetListChatRoomResponseSuccess = (chatRoomsControllerGetListChatRoomResponse200) & {
  headers: Headers;
};
;
// MISSING LINE 3457
export type chatRoomsControllerGetListChatRoomResponse = (chatRoomsControllerGetListChatRoomResponseSuccess)
// MISSING LINE 3459
export const getChatRoomsControllerGetListChatRoomUrl = (params?: ChatRoomsControllerGetListChatRoomParams,) => {
  const normalizedParams = new URLSearchParams();
// MISSING LINE 3462
  Object.entries(params || {}).forEach(([key, value]) => {
// MISSING LINE 3464
    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });
// MISSING LINE 3469
  const stringifiedParams = normalizedParams.toString();
// MISSING LINE 3471
  return stringifiedParams.length > 0 ? `/chat-rooms?${stringifiedParams}` : `/chat-rooms`
}
// MISSING LINE 3474
/**
 * @summary Get list chat room
 */
export const chatRoomsControllerGetListChatRoom = async (params?: ChatRoomsControllerGetListChatRoomParams, options?: RequestInit): Promise<chatRoomsControllerGetListChatRoomResponse> => {
// MISSING LINE 3479
  return orvalClient<chatRoomsControllerGetListChatRoomResponse>(getChatRoomsControllerGetListChatRoomUrl(params),
  {
    ...options,
    method: 'GET'
// MISSING LINE 3484
// MISSING LINE 3485
  }
);}
// MISSING LINE 3488
// MISSING LINE 3489
// MISSING LINE 3490
// MISSING LINE 3491
// MISSING LINE 3492
export const getChatRoomsControllerGetListChatRoomInfiniteQueryKey = (params?: ChatRoomsControllerGetListChatRoomParams,) => {
    return [
    'infinite', `/chat-rooms`, ...(params ? [params] : [])
    ] as const;
    }
// MISSING LINE 3498
export const getChatRoomsControllerGetListChatRoomQueryKey = (params?: ChatRoomsControllerGetListChatRoomParams,) => {
    return [
// MISSING LINE 3501
// MISSING LINE 3502
// MISSING LINE 3503
// MISSING LINE 3504
// MISSING LINE 3505
// MISSING LINE 3506
// MISSING LINE 3507
// MISSING LINE 3508
// MISSING LINE 3509
// MISSING LINE 3510
// MISSING LINE 3511
// MISSING LINE 3512
// MISSING LINE 3513
// MISSING LINE 3514
// MISSING LINE 3515
// MISSING LINE 3516
// MISSING LINE 3517
// MISSING LINE 3518
// MISSING LINE 3519
// MISSING LINE 3520
// MISSING LINE 3521
// MISSING LINE 3522
// MISSING LINE 3523
// MISSING LINE 3524
// MISSING LINE 3525
// MISSING LINE 3526
// MISSING LINE 3527
// MISSING LINE 3528
// MISSING LINE 3529
// MISSING LINE 3530
// MISSING LINE 3531
// MISSING LINE 3532
// MISSING LINE 3533
// MISSING LINE 3534
// MISSING LINE 3535
// MISSING LINE 3536
// MISSING LINE 3537
// MISSING LINE 3538
// MISSING LINE 3539
// MISSING LINE 3540
// MISSING LINE 3541
// MISSING LINE 3542
// MISSING LINE 3543
// MISSING LINE 3544
// MISSING LINE 3545
// MISSING LINE 3546
// MISSING LINE 3547
// MISSING LINE 3548
// MISSING LINE 3549
// MISSING LINE 3550
// MISSING LINE 3551
// MISSING LINE 3552
// MISSING LINE 3553
// MISSING LINE 3554
// MISSING LINE 3555
// MISSING LINE 3556
// MISSING LINE 3557
// MISSING LINE 3558
// MISSING LINE 3559
// MISSING LINE 3560
// MISSING LINE 3561
// MISSING LINE 3562
// MISSING LINE 3563
// MISSING LINE 3564
// MISSING LINE 3565
// MISSING LINE 3566
// MISSING LINE 3567
// MISSING LINE 3568
// MISSING LINE 3569
// MISSING LINE 3570
// MISSING LINE 3571
// MISSING LINE 3572
// MISSING LINE 3573
// MISSING LINE 3574
// MISSING LINE 3575
// MISSING LINE 3576
// MISSING LINE 3577
// MISSING LINE 3578
// MISSING LINE 3579
// MISSING LINE 3580
// MISSING LINE 3581
// MISSING LINE 3582
// MISSING LINE 3583
// MISSING LINE 3584
// MISSING LINE 3585
// MISSING LINE 3586
// MISSING LINE 3587
   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, TError, TData> & { queryKey: DataTag<QueryKey, TData, TError> }
}
// MISSING LINE 3590
export type ChatRoomsControllerGetListChatRoomQueryResult = NonNullable<Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>>
export type ChatRoomsControllerGetListChatRoomQueryError = unknown
// MISSING LINE 3593
// MISSING LINE 3594
export function useChatRoomsControllerGetListChatRoom<TData = Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, TError = unknown>(
 params: undefined |  ChatRoomsControllerGetListChatRoomParams, options: { query:Partial<UseQueryOptions<Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, TError, TData>> & Pick<
        DefinedInitialDataOptions<
          Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>,
          TError,
          Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>
        > , 'initialData'
      >, request?: SecondParameter<typeof orvalClient>}
 , queryClient?: QueryClient
  ):  DefinedUseQueryResult<TData, TError> & { queryKey: DataTag<QueryKey, TData, TError> }
export function useChatRoomsControllerGetListChatRoom<TData = Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, TError = unknown>(
 params?: ChatRoomsControllerGetListChatRoomParams, options?: { query?:Partial<UseQueryOptions<Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, TError, TData>> & Pick<
        UndefinedInitialDataOptions<
          Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>,
          TError,
          Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>
        > , 'initialData'
      >, request?: SecondParameter<typeof orvalClient>}
 , queryClient?: QueryClient
  ):  UseQueryResult<TData, TError> & { queryKey: DataTag<QueryKey, TData, TError> }
export function useChatRoomsControllerGetListChatRoom<TData = Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, TError = unknown>(
 params?: ChatRoomsControllerGetListChatRoomParams, options?: { query?:Partial<UseQueryOptions<Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, TError, TData>>, request?: SecondParameter<typeof orvalClient>}
 , queryClient?: QueryClient
  ):  UseQueryResult<TData, TError> & { queryKey: DataTag<QueryKey, TData, TError> }
/**
 * @summary Get list chat room
 */
// MISSING LINE 3622
export function useChatRoomsControllerGetListChatRoom<TData = Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, TError = unknown>(
 params?: ChatRoomsControllerGetListChatRoomParams, options?: { query?:Partial<UseQueryOptions<Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, TError, TData>>, request?: SecondParameter<typeof orvalClient>}
 , queryClient?: QueryClient
 ):  UseQueryResult<TData, TError> & { queryKey: DataTag<QueryKey, TData, TError> } {
// MISSING LINE 3627
  const queryOptions = getChatRoomsControllerGetListChatRoomQueryOptions(params,options)
// MISSING LINE 3629
  const query = useQuery(queryOptions, queryClient) as  UseQueryResult<TData, TError> & { queryKey: DataTag<QueryKey, TData, TError> };
// MISSING LINE 3631
// MISSING LINE 3632
// MISSING LINE 3633
// MISSING LINE 3634
// MISSING LINE 3635
// MISSING LINE 3636
// MISSING LINE 3637
// MISSING LINE 3638
// MISSING LINE 3639
// MISSING LINE 3640
// MISSING LINE 3641
// MISSING LINE 3642
// MISSING LINE 3643
// MISSING LINE 3644
// MISSING LINE 3645
export const getChatRoomsControllerGetListChatRoomQueryKey = (params?: ChatRoomsControllerGetListChatRoomParams,) => {
    return [
    `/chat-rooms`, ...(params ? [params] : [])
    ] as const;
    }
// MISSING LINE 3651
// MISSING LINE 3652
export const getChatRoomsControllerGetListChatRoomInfiniteQueryOptions = <TData = InfiniteData<Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, ChatRoomsControllerGetListChatRoomParams['page']>, TError = unknown>(params?: ChatRoomsControllerGetListChatRoomParams, options?: { query?:Partial<UseInfiniteQueryOptions<Awaited<ReturnType<typeof chatRoomsControllerGetListChatRoom>>, TError, TData, QueryKey, ChatRoomsControllerGetListChatRoomParams['page']>>, request?: SecondParameter<typeof orvalClient>}
// MISSING LINE 3654
// MISSING LINE 3655
// MISSING LINE 3656
// MISSING LINE 3657
// MISSING LINE 3658
// MISSING LINE 3659
// MISSING LINE 3660
// MISSING LINE 3661
// MISSING LINE 3662
// MISSING LINE 3663
// MISSING LINE 3664
// MISSING LINE 3665
// MISSING LINE 3666
// MISSING LINE 3667
// MISSING LINE 3668
// MISSING LINE 3669
// MISSING LINE 3670
// MISSING LINE 3671
// MISSING LINE 3672
// MISSING LINE 3673
// MISSING LINE 3674
// MISSING LINE 3675
// MISSING LINE 3676
// MISSING LINE 3677
// MISSING LINE 3678
// MISSING LINE 3679
// MISSING LINE 3680
// MISSING LINE 3681
// MISSING LINE 3682
// MISSING LINE 3683
// MISSING LINE 3684
// MISSING LINE 3685
// MISSING LINE 3686
// MISSING LINE 3687
// MISSING LINE 3688
// MISSING LINE 3689
// MISSING LINE 3690
// MISSING LINE 3691
// MISSING LINE 3692
// MISSING LINE 3693
// MISSING LINE 3694
// MISSING LINE 3695
// MISSING LINE 3696
// MISSING LINE 3697
// MISSING LINE 3698
// MISSING LINE 3699
// MISSING LINE 3700
// MISSING LINE 3701
// MISSING LINE 3702
// MISSING LINE 3703
// MISSING LINE 3704
// MISSING LINE 3705
// MISSING LINE 3706
// MISSING LINE 3707
// MISSING LINE 3708
// MISSING LINE 3709
// MISSING LINE 3710
// MISSING LINE 3711
// MISSING LINE 3712
// MISSING LINE 3713
// MISSING LINE 3714
// MISSING LINE 3715
// MISSING LINE 3716
// MISSING LINE 3717
// MISSING LINE 3718
// MISSING LINE 3719
// MISSING LINE 3720
// MISSING LINE 3721
// MISSING LINE 3722
// MISSING LINE 3723
// MISSING LINE 3724
// MISSING LINE 3725
// MISSING LINE 3726
// MISSING LINE 3727
// MISSING LINE 3728
// MISSING LINE 3729
// MISSING LINE 3730
// MISSING LINE 3731
// MISSING LINE 3732
// MISSING LINE 3733
// MISSING LINE 3734
// MISSING LINE 3735
// MISSING LINE 3736
// MISSING LINE 3737
// MISSING LINE 3738
// MISSING LINE 3739
// MISSING LINE 3740
// MISSING LINE 3741
// MISSING LINE 3742
// MISSING LINE 3743
// MISSING LINE 3744
// MISSING LINE 3745
// MISSING LINE 3746
// MISSING LINE 3747
// MISSING LINE 3748
// MISSING LINE 3749
// MISSING LINE 3750
// MISSING LINE 3751
// MISSING LINE 3752
// MISSING LINE 3753
// MISSING LINE 3754
// MISSING LINE 3755
// MISSING LINE 3756
// MISSING LINE 3757
// MISSING LINE 3758
// MISSING LINE 3759
// MISSING LINE 3760
// MISSING LINE 3761
// MISSING LINE 3762
// MISSING LINE 3763
// MISSING LINE 3764
// MISSING LINE 3765
// MISSING LINE 3766
// MISSING LINE 3767
// MISSING LINE 3768
// MISSING LINE 3769
// MISSING LINE 3770
// MISSING LINE 3771
// MISSING LINE 3772
// MISSING LINE 3773
// MISSING LINE 3774
// MISSING LINE 3775
// MISSING LINE 3776
// MISSING LINE 3777
// MISSING LINE 3778
// MISSING LINE 3779
// MISSING LINE 3780
// MISSING LINE 3781
// MISSING LINE 3782
// MISSING LINE 3783
// MISSING LINE 3784
// MISSING LINE 3785
// MISSING LINE 3786
// MISSING LINE 3787
// MISSING LINE 3788
// MISSING LINE 3789
// MISSING LINE 3790
// MISSING LINE 3791
// MISSING LINE 3792
// MISSING LINE 3793
// MISSING LINE 3794
// MISSING LINE 3795
// MISSING LINE 3796
// MISSING LINE 3797
// MISSING LINE 3798
// MISSING LINE 3799
// MISSING LINE 3800
// MISSING LINE 3801
// MISSING LINE 3802
// MISSING LINE 3803
// MISSING LINE 3804
// MISSING LINE 3805
// MISSING LINE 3806
// MISSING LINE 3807
// MISSING LINE 3808
// MISSING LINE 3809
// MISSING LINE 3810
// MISSING LINE 3811
// MISSING LINE 3812
// MISSING LINE 3813
// MISSING LINE 3814
// MISSING LINE 3815
// MISSING LINE 3816
// MISSING LINE 3817
// MISSING LINE 3818
// MISSING LINE 3819
// MISSING LINE 3820
// MISSING LINE 3821
// MISSING LINE 3822
// MISSING LINE 3823
// MISSING LINE 3824
// MISSING LINE 3825
// MISSING LINE 3826
// MISSING LINE 3827
// MISSING LINE 3828
// MISSING LINE 3829
// MISSING LINE 3830
// MISSING LINE 3831
// MISSING LINE 3832
// MISSING LINE 3833
// MISSING LINE 3834
// MISSING LINE 3835
// MISSING LINE 3836
// MISSING LINE 3837
// MISSING LINE 3838
// MISSING LINE 3839
// MISSING LINE 3840
// MISSING LINE 3841
// MISSING LINE 3842
// MISSING LINE 3843
// MISSING LINE 3844
// MISSING LINE 3845
// MISSING LINE 3846
// MISSING LINE 3847
// MISSING LINE 3848
// MISSING LINE 3849
// MISSING LINE 3850
// MISSING LINE 3851
// MISSING LINE 3852
// MISSING LINE 3853
// MISSING LINE 3854
// MISSING LINE 3855
// MISSING LINE 3856
// MISSING LINE 3857
// MISSING LINE 3858
// MISSING LINE 3859
// MISSING LINE 3860
// MISSING LINE 3861
// MISSING LINE 3862
// MISSING LINE 3863
// MISSING LINE 3864
// MISSING LINE 3865
// MISSING LINE 3866
// MISSING LINE 3867
// MISSING LINE 3868
// MISSING LINE 3869
// MISSING LINE 3870
// MISSING LINE 3871
// MISSING LINE 3872
// MISSING LINE 3873
// MISSING LINE 3874
// MISSING LINE 3875
// MISSING LINE 3876
// MISSING LINE 3877
// MISSING LINE 3878
// MISSING LINE 3879
// MISSING LINE 3880
// MISSING LINE 3881
// MISSING LINE 3882
// MISSING LINE 3883
// MISSING LINE 3884
// MISSING LINE 3885
// MISSING LINE 3886
// MISSING LINE 3887
// MISSING LINE 3888
// MISSING LINE 3889
// MISSING LINE 3890
// MISSING LINE 3891
// MISSING LINE 3892
// MISSING LINE 3893
// MISSING LINE 3894
// MISSING LINE 3895
// MISSING LINE 3896
// MISSING LINE 3897
// MISSING LINE 3898
// MISSING LINE 3899
// MISSING LINE 3900
// MISSING LINE 3901
// MISSING LINE 3902
// MISSING LINE 3903
// MISSING LINE 3904
// MISSING LINE 3905
// MISSING LINE 3906
// MISSING LINE 3907
// MISSING LINE 3908
// MISSING LINE 3909
// MISSING LINE 3910
// MISSING LINE 3911
// MISSING LINE 3912
// MISSING LINE 3913
// MISSING LINE 3914
// MISSING LINE 3915
// MISSING LINE 3916
// MISSING LINE 3917
// MISSING LINE 3918
// MISSING LINE 3919
// MISSING LINE 3920
// MISSING LINE 3921
// MISSING LINE 3922
// MISSING LINE 3923
// MISSING LINE 3924
// MISSING LINE 3925
// MISSING LINE 3926
// MISSING LINE 3927
// MISSING LINE 3928
// MISSING LINE 3929
// MISSING LINE 3930
// MISSING LINE 3931
// MISSING LINE 3932
// MISSING LINE 3933
// MISSING LINE 3934
// MISSING LINE 3935
// MISSING LINE 3936
// MISSING LINE 3937
// MISSING LINE 3938
// MISSING LINE 3939
// MISSING LINE 3940
// MISSING LINE 3941
// MISSING LINE 3942
// MISSING LINE 3943
// MISSING LINE 3944
// MISSING LINE 3945
// MISSING LINE 3946
// MISSING LINE 3947
// MISSING LINE 3948
// MISSING LINE 3949
// MISSING LINE 3950
// MISSING LINE 3951
// MISSING LINE 3952
// MISSING LINE 3953
// MISSING LINE 3954
// MISSING LINE 3955
// MISSING LINE 3956
// MISSING LINE 3957
// MISSING LINE 3958
// MISSING LINE 3959
// MISSING LINE 3960
// MISSING LINE 3961
// MISSING LINE 3962
// MISSING LINE 3963
// MISSING LINE 3964
// MISSING LINE 3965
// MISSING LINE 3966
// MISSING LINE 3967
// MISSING LINE 3968
// MISSING LINE 3969
// MISSING LINE 3970
// MISSING LINE 3971
// MISSING LINE 3972
// MISSING LINE 3973
// MISSING LINE 3974
// MISSING LINE 3975
// MISSING LINE 3976
// MISSING LINE 3977
// MISSING LINE 3978
// MISSING LINE 3979
// MISSING LINE 3980
// MISSING LINE 3981
// MISSING LINE 3982
// MISSING LINE 3983
// MISSING LINE 3984
// MISSING LINE 3985
// MISSING LINE 3986
// MISSING LINE 3987
// MISSING LINE 3988
// MISSING LINE 3989
// MISSING LINE 3990
// MISSING LINE 3991
// MISSING LINE 3992
// MISSING LINE 3993
// MISSING LINE 3994
// MISSING LINE 3995
// MISSING LINE 3996
// MISSING LINE 3997
// MISSING LINE 3998
// MISSING LINE 3999
export type chatRoomsControllerGetOrCreateDirectChatResponse201 = {
  data: void
  status: 201
}
// MISSING LINE 4004
export type chatRoomsControllerGetOrCreateDirectChatResponseSuccess = (chatRoomsControllerGetOrCreateDirectChatResponse201) & {
  headers: Headers;
};
;
// MISSING LINE 4009
export type chatRoomsControllerGetOrCreateDirectChatResponse = (chatRoomsControllerGetOrCreateDirectChatResponseSuccess)
// MISSING LINE 4011
export const getChatRoomsControllerGetOrCreateDirectChatUrl = (targetUserId: string,) => {
// MISSING LINE 4013
// MISSING LINE 4014
// MISSING LINE 4015
// MISSING LINE 4016
  return `/chat-rooms/direct/${targetUserId}`
}
// MISSING LINE 4019
/**
 * @summary Get or create a direct (1-on-1) chat
 */
export const chatRoomsControllerGetOrCreateDirectChat = async (targetUserId: string, options?: RequestInit): Promise<chatRoomsControllerGetOrCreateDirectChatResponse> => {
// MISSING LINE 4024
  return orvalClient<chatRoomsControllerGetOrCreateDirectChatResponse>(getChatRoomsControllerGetOrCreateDirectChatUrl(targetUserId),
  {
    ...options,
    method: 'POST'
// MISSING LINE 4029
// MISSING LINE 4030
  }
);}
// MISSING LINE 4033
// MISSING LINE 4034
// MISSING LINE 4035
// MISSING LINE 4036
export const getChatRoomsControllerGetOrCreateDirectChatMutationOptions = <TError = unknown,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof chatRoomsControllerGetOrCreateDirectChat>>, TError,{targetUserId: string}, TContext>, request?: SecondParameter<typeof orvalClient>}
): UseMutationOptions<Awaited<ReturnType<typeof chatRoomsControllerGetOrCreateDirectChat>>, TError,{targetUserId: string}, TContext> => {
// MISSING LINE 4040
const mutationKey = ['chatRoomsControllerGetOrCreateDirectChat'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};
// MISSING LINE 4047
// MISSING LINE 4048
// MISSING LINE 4049
// MISSING LINE 4050
      const mutationFn: MutationFunction<Awaited<ReturnType<typeof chatRoomsControllerGetOrCreateDirectChat>>, {targetUserId: string}> = (props) => {
          const {targetUserId} = props ?? {};
// MISSING LINE 4053
          return  chatRoomsControllerGetOrCreateDirectChat(targetUserId,requestOptions)
        }
// MISSING LINE 4056
// MISSING LINE 4057
// MISSING LINE 4058
// MISSING LINE 4059
// MISSING LINE 4060
// MISSING LINE 4061
  return  { mutationFn, ...mutationOptions }}
// MISSING LINE 4063
    export type ChatRoomsControllerGetOrCreateDirectChatMutationResult = NonNullable<Awaited<ReturnType<typeof chatRoomsControllerGetOrCreateDirectChat>>>
// MISSING LINE 4065
    export type ChatRoomsControllerGetOrCreateDirectChatMutationError = unknown
// MISSING LINE 4067
    /**
 * @summary Get or create a direct (1-on-1) chat
 */
export const useChatRoomsControllerGetOrCreateDirectChat = <TError = unknown,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof chatRoomsControllerGetOrCreateDirectChat>>, TError,{targetUserId: string}, TContext>, request?: SecondParameter<typeof orvalClient>}
 , queryClient?: QueryClient): UseMutationResult<
        Awaited<ReturnType<typeof chatRoomsControllerGetOrCreateDirectChat>>,
        TError,
        {targetUserId: string},
        TContext
      > => {
      return useMutation(getChatRoomsControllerGetOrCreateDirectChatMutationOptions(options), queryClient);
    }
// MISSING LINE 4081
export type chatRoomsControllerUpdatePermissionAddMemberResponse200 = {
  data: void
  status: 200
}
// MISSING LINE 4086
export type chatRoomsControllerUpdatePermissionAddMemberResponseSuccess = (chatRoomsControllerUpdatePermissionAddMemberResponse200) & {
  headers: Headers;
};
;
// MISSING LINE 4091
export type chatRoomsControllerUpdatePermissionAddMemberResponse = (chatRoomsControllerUpdatePermissionAddMemberResponseSuccess)
// MISSING LINE 4093
export const getChatRoomsControllerUpdatePermissionAddMemberUrl = () => {
// MISSING LINE 4095
// MISSING LINE 4096
// MISSING LINE 4097
// MISSING LINE 4098
  return `/chat-rooms/permission-add-member`
}
// MISSING LINE 4101
/**
 * @summary Update permission add member
 */
export const chatRoomsControllerUpdatePermissionAddMember = async (updatePermissionAddMemberDto: UpdatePermissionAddMemberDto, options?: RequestInit): Promise<chatRoomsControllerUpdatePermissionAddMemberResponse> => {
// MISSING LINE 4106
  return orvalClient<chatRoomsControllerUpdatePermissionAddMemberResponse>(getChatRoomsControllerUpdatePermissionAddMemberUrl(),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(updatePermissionAddMemberDto)
  }
);}
// MISSING LINE 4115
// MISSING LINE 4116
// MISSING LINE 4117
// MISSING LINE 4118
export const getChatRoomsControllerUpdatePermissionAddMemberMutationOptions = <TError = unknown,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof chatRoomsControllerUpdatePermissionAddMember>>, TError,{data: UpdatePermissionAddMemberDto}, TContext>, request?: SecondParameter<typeof orvalClient>}
// MISSING LINE 4121
// MISSING LINE 4122
// MISSING LINE 4123
// MISSING LINE 4124
// MISSING LINE 4125
// MISSING LINE 4126
// MISSING LINE 4127
// MISSING LINE 4128
// MISSING LINE 4129
// MISSING LINE 4130
// MISSING LINE 4131
// MISSING LINE 4132
// MISSING LINE 4133
// MISSING LINE 4134
// MISSING LINE 4135
// MISSING LINE 4136
// MISSING LINE 4137
// MISSING LINE 4138
// MISSING LINE 4139
// MISSING LINE 4140
// MISSING LINE 4141
// MISSING LINE 4142
// MISSING LINE 4143
// MISSING LINE 4144
// MISSING LINE 4145
// MISSING LINE 4146
// MISSING LINE 4147
// MISSING LINE 4148
// MISSING LINE 4149
// MISSING LINE 4150
// MISSING LINE 4151
// MISSING LINE 4152
// MISSING LINE 4153
// MISSING LINE 4154
// MISSING LINE 4155
// MISSING LINE 4156
// MISSING LINE 4157
// MISSING LINE 4158
// MISSING LINE 4159
// MISSING LINE 4160
// MISSING LINE 4161
// MISSING LINE 4162
// MISSING LINE 4163
// MISSING LINE 4164
// MISSING LINE 4165
// MISSING LINE 4166
// MISSING LINE 4167
// MISSING LINE 4168
// MISSING LINE 4169
// MISSING LINE 4170
// MISSING LINE 4171
// MISSING LINE 4172
// MISSING LINE 4173
// MISSING LINE 4174
// MISSING LINE 4175
// MISSING LINE 4176
// MISSING LINE 4177
// MISSING LINE 4178
// MISSING LINE 4179
// MISSING LINE 4180
// MISSING LINE 4181
// MISSING LINE 4182
// MISSING LINE 4183
// MISSING LINE 4184
// MISSING LINE 4185
// MISSING LINE 4186
// MISSING LINE 4187
// MISSING LINE 4188
// MISSING LINE 4189
// MISSING LINE 4190
// MISSING LINE 4191
// MISSING LINE 4192
// MISSING LINE 4193
// MISSING LINE 4194
// MISSING LINE 4195
// MISSING LINE 4196
// MISSING LINE 4197
// MISSING LINE 4198
// MISSING LINE 4199
// MISSING LINE 4200
// MISSING LINE 4201
// MISSING LINE 4202
// MISSING LINE 4203
// MISSING LINE 4204
// MISSING LINE 4205
// MISSING LINE 4206
// MISSING LINE 4207
// MISSING LINE 4208
// MISSING LINE 4209
// MISSING LINE 4210
// MISSING LINE 4211
// MISSING LINE 4212
// MISSING LINE 4213
// MISSING LINE 4214
  return  { mutationFn, ...mutationOptions }}
// MISSING LINE 4216
    export type ChatRoomsControllerGetOrCreateDirectChatMutationResult = NonNullable<Awaited<ReturnType<typeof chatRoomsControllerGetOrCreateDirectChat>>>
// MISSING LINE 4218
    export type ChatRoomsControllerGetOrCreateDirectChatMutationError = unknown
// MISSING LINE 4220
    /**
 * @summary Get or create a direct (1-on-1) chat
 */
export const useChatRoomsControllerGetOrCreateDirectChat = <TError = unknown,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof chatRoomsControllerGetOrCreateDirectChat>>, TError,{targetUserId: string}, TContext>, request?: SecondParameter<typeof orvalClient>}
 , queryClient?: QueryClient): UseMutationResult<
        Awaited<ReturnType<typeof chatRoomsControllerGetOrCreateDirectChat>>,
        TError,
        {targetUserId: string},
        TContext
      > => {
      return useMutation(getChatRoomsControllerGetOrCreateDirectChatMutationOptions(options), queryClient);
    }
// MISSING LINE 4234
export type chatRoomsControllerUpdatePermissionAddMemberResponse200 = {
  data: void
  status: 200
}
// MISSING LINE 4239
export type chatRoomsControllerUpdatePermissionAddMemberResponseSuccess = (chatRoomsControllerUpdatePermissionAddMemberResponse200) & {
  headers: Headers;
};
;
// MISSING LINE 4244
export type chatRoomsControllerUpdatePermissionAddMemberResponse = (chatRoomsControllerUpdatePermissionAddMemberResponseSuccess)
// MISSING LINE 4246
export const getChatRoomsControllerUpdatePermissionAddMemberUrl = () => {
// MISSING LINE 4248
// MISSING LINE 4249
// MISSING LINE 4250
// MISSING LINE 4251
// MISSING LINE 4252
// MISSING LINE 4253
// MISSING LINE 4254
// MISSING LINE 4255
// MISSING LINE 4256
// MISSING LINE 4257
// MISSING LINE 4258
// MISSING LINE 4259
// MISSING LINE 4260
// MISSING LINE 4261
// MISSING LINE 4262
// MISSING LINE 4263
// MISSING LINE 4264
// MISSING LINE 4265
// MISSING LINE 4266
// MISSING LINE 4267
// MISSING LINE 4268
// MISSING LINE 4269
// MISSING LINE 4270
// MISSING LINE 4271
// MISSING LINE 4272
// MISSING LINE 4273
// MISSING LINE 4274
// MISSING LINE 4275
// MISSING LINE 4276
// MISSING LINE 4277
// MISSING LINE 4278
// MISSING LINE 4279
// MISSING LINE 4280
// MISSING LINE 4281
// MISSING LINE 4282
// MISSING LINE 4283
// MISSING LINE 4284
// MISSING LINE 4285
// MISSING LINE 4286
// MISSING LINE 4287
// MISSING LINE 4288
// MISSING LINE 4289
// MISSING LINE 4290
// MISSING LINE 4291
// MISSING LINE 4292
// MISSING LINE 4293
// MISSING LINE 4294
// MISSING LINE 4295
// MISSING LINE 4296
// MISSING LINE 4297
// MISSING LINE 4298
// MISSING LINE 4299
// MISSING LINE 4300
// MISSING LINE 4301
// MISSING LINE 4302
// MISSING LINE 4303
// MISSING LINE 4304
// MISSING LINE 4305
// MISSING LINE 4306
// MISSING LINE 4307
// MISSING LINE 4308
// MISSING LINE 4309
// MISSING LINE 4310
// MISSING LINE 4311
// MISSING LINE 4312
// MISSING LINE 4313
// MISSING LINE 4314
// MISSING LINE 4315
// MISSING LINE 4316
// MISSING LINE 4317
// MISSING LINE 4318
// MISSING LINE 4319
// MISSING LINE 4320
// MISSING LINE 4321
// MISSING LINE 4322
// MISSING LINE 4323
// MISSING LINE 4324
// MISSING LINE 4325
// MISSING LINE 4326
// MISSING LINE 4327
// MISSING LINE 4328
// MISSING LINE 4329
// MISSING LINE 4330
// MISSING LINE 4331
// MISSING LINE 4332
// MISSING LINE 4333
// MISSING LINE 4334
// MISSING LINE 4335
// MISSING LINE 4336
// MISSING LINE 4337
// MISSING LINE 4338
// MISSING LINE 4339
// MISSING LINE 4340
// MISSING LINE 4341
// MISSING LINE 4342
// MISSING LINE 4343
// MISSING LINE 4344
// MISSING LINE 4345
// MISSING LINE 4346
// MISSING LINE 4347
// MISSING LINE 4348
// MISSING LINE 4349
// MISSING LINE 4350
// MISSING LINE 4351
// MISSING LINE 4352
// MISSING LINE 4353
// MISSING LINE 4354
// MISSING LINE 4355
// MISSING LINE 4356
// MISSING LINE 4357
    chatMessagesControllerEditMessageBody: ChatMessagesControllerEditMessageBody, options?: RequestInit): Promise<chatMessagesControllerEditMessageResponse> => {
// MISSING LINE 4359
  return orvalClient<chatMessagesControllerEditMessageResponse>(getChatMessagesControllerEditMessageUrl(id),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(chatMessagesControllerEditMessageBody)
  }
);}
// MISSING LINE 4368
// MISSING LINE 4369
// MISSING LINE 4370
// MISSING LINE 4371
export const getChatMessagesControllerEditMessageMutationOptions = <TError = unknown,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof chatMessagesControllerEditMessage>>, TError,{id: string;data: ChatMessagesControllerEditMessageBody}, TContext>, request?: SecondParameter<typeof orvalClient>}
): UseMutationOptions<Awaited<ReturnType<typeof chatMessagesControllerEditMessage>>, TError,{id: string;data: ChatMessagesControllerEditMessageBody}, TContext> => {
// MISSING LINE 4375
const mutationKey = ['chatMessagesControllerEditMessage'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};
// MISSING LINE 4382
// MISSING LINE 4383
// MISSING LINE 4384
// MISSING LINE 4385
      const mutationFn: MutationFunction<Awaited<R
// MISSING LINE 4387
// MISSING LINE 4388
// MISSING LINE 4389
// MISSING LINE 4390
// MISSING LINE 4391
// MISSING LINE 4392
// MISSING LINE 4393
// MISSING LINE 4394
// MISSING LINE 4395
// MISSING LINE 4396
// MISSING LINE 4397
// MISSING LINE 4398
// MISSING LINE 4399
// MISSING LINE 4400
// MISSING LINE 4401
// MISSING LINE 4402
// MISSING LINE 4403
// MISSING LINE 4404
// MISSING LINE 4405
// MISSING LINE 4406
// MISSING LINE 4407
// MISSING LINE 4408
// MISSING LINE 4409
// MISSING LINE 4410
// MISSING LINE 4411
// MISSING LINE 4412
// MISSING LINE 4413
// MISSING LINE 4414
// MISSING LINE 4415
// MISSING LINE 4416
// MISSING LINE 4417
// MISSING LINE 4418
// MISSING LINE 4419
// MISSING LINE 4420
// MISSING LINE 4421
// MISSING LINE 4422
// MISSING LINE 4423
// MISSING LINE 4424
// MISSING LINE 4425
// MISSING LINE 4426
// MISSING LINE 4427
// MISSING LINE 4428
// MISSING LINE 4429
// MISSING LINE 4430
// MISSING LINE 4431
// MISSING LINE 4432
// MISSING LINE 4433
// MISSING LINE 4434
// MISSING LINE 4435
// MISSING LINE 4436
// MISSING LINE 4437
// MISSING LINE 4438
// MISSING LINE 4439
// MISSING LINE 4440
// MISSING LINE 4441
// MISSING LINE 4442
// MISSING LINE 4443
// MISSING LINE 4444
// MISSING LINE 4445
// MISSING LINE 4446
// MISSING LINE 4447
// MISSING LINE 4448
// MISSING LINE 4449
// MISSING LINE 4450
// MISSING LINE 4451
// MISSING LINE 4452
// MISSING LINE 4453
// MISSING LINE 4454
// MISSING LINE 4455
// MISSING LINE 4456
// MISSING LINE 4457
// MISSING LINE 4458
// MISSING LINE 4459
// MISSING LINE 4460
// MISSING LINE 4461
// MISSING LINE 4462
// MISSING LINE 4463
// MISSING LINE 4464
// MISSING LINE 4465
// MISSING LINE 4466
// MISSING LINE 4467
// MISSING LINE 4468
// MISSING LINE 4469
// MISSING LINE 4470
// MISSING LINE 4471
// MISSING LINE 4472
// MISSING LINE 4473
// MISSING LINE 4474
// MISSING LINE 4475
// MISSING LINE 4476
// MISSING LINE 4477
// MISSING LINE 4478
// MISSING LINE 4479
// MISSING LINE 4480
// MISSING LINE 4481
// MISSING LINE 4482
// MISSING LINE 4483
// MISSING LINE 4484
// MISSING LINE 4485
// MISSING LINE 4486
// MISSING LINE 4487
// MISSING LINE 4488
// MISSING LINE 4489
// MISSING LINE 4490
// MISSING LINE 4491
// MISSING LINE 4492
// MISSING LINE 4493
// MISSING LINE 4494
// MISSING LINE 4495
// MISSING LINE 4496
// MISSING LINE 4497
// MISSING LINE 4498
// MISSING LINE 4499
// MISSING LINE 4500
// MISSING LINE 4501
// MISSING LINE 4502
// MISSING LINE 4503
// MISSING LINE 4504
// MISSING LINE 4505
// MISSING LINE 4506
// MISSING LINE 4507
// MISSING LINE 4508
// MISSING LINE 4509
// MISSING LINE 4510
// MISSING LINE 4511
// MISSING LINE 4512
// MISSING LINE 4513
// MISSING LINE 4514
// MISSING LINE 4515
// MISSING LINE 4516
// MISSING LINE 4517
// MISSING LINE 4518
// MISSING LINE 4519
// MISSING LINE 4520
// MISSING LINE 4521
// MISSING LINE 4522
// MISSING LINE 4523
// MISSING LINE 4524
// MISSING LINE 4525
// MISSING LINE 4526
// MISSING LINE 4527
// MISSING LINE 4528
// MISSING LINE 4529
// MISSING LINE 4530
// MISSING LINE 4531
// MISSING LINE 4532
// MISSING LINE 4533
// MISSING LINE 4534
// MISSING LINE 4535
// MISSING LINE 4536
// MISSING LINE 4537
// MISSING LINE 4538
// MISSING LINE 4539
// MISSING LINE 4540
// MISSING LINE 4541
// MISSING LINE 4542
// MISSING LINE 4543
// MISSING LINE 4544
// MISSING LINE 4545
// MISSING LINE 4546
// MISSING LINE 4547
// MISSING LINE 4548
// MISSING LINE 4549
// MISSING LINE 4550
// MISSING LINE 4551
// MISSING LINE 4552
// MISSING LINE 4553
// MISSING LINE 4554
// MISSING LINE 4555
// MISSING LINE 4556
// MISSING LINE 4557
// MISSING LINE 4558
// MISSING LINE 4559
// MISSING LINE 4560
// MISSING LINE 4561
// MISSING LINE 4562
// MISSING LINE 4563
// MISSING LINE 4564
// MISSING LINE 4565
// MISSING LINE 4566
// MISSING LINE 4567
// MISSING LINE 4568
// MISSING LINE 4569
// MISSING LINE 4570
// MISSING LINE 4571
// MISSING LINE 4572
// MISSING LINE 4573
// MISSING LINE 4574
// MISSING LINE 4575
// MISSING LINE 4576
// MISSING LINE 4577
// MISSING LINE 4578
// MISSING LINE 4579
// MISSING LINE 4580
// MISSING LINE 4581
// MISSING LINE 4582
// MISSING LINE 4583
// MISSING LINE 4584
// MISSING LINE 4585
// MISSING LINE 4586
// MISSING LINE 4587
// MISSING LINE 4588
// MISSING LINE 4589
// MISSING LINE 4590
// MISSING LINE 4591
// MISSING LINE 4592
// MISSING LINE 4593
// MISSING LINE 4594
// MISSING LINE 4595
// MISSING LINE 4596
// MISSING LINE 4597
// MISSING LINE 4598
// MISSING LINE 4599
// MISSING LINE 4600
// MISSING LINE 4601
// MISSING LINE 4602
// MISSING LINE 4603
// MISSING LINE 4604
// MISSING LINE 4605
// MISSING LINE 4606
// MISSING LINE 4607
// MISSING LINE 4608
// MISSING LINE 4609
// MISSING LINE 4610
// MISSING LINE 4611
// MISSING LINE 4612
// MISSING LINE 4613
// MISSING LINE 4614
// MISSING LINE 4615
// MISSING LINE 4616
// MISSING LINE 4617
// MISSING LINE 4618
// MISSING LINE 4619
// MISSING LINE 4620
// MISSING LINE 4621
// MISSING LINE 4622
// MISSING LINE 4623
// MISSING LINE 4624
// MISSING LINE 4625
// MISSING LINE 4626
// MISSING LINE 4627
// MISSING LINE 4628
// MISSING LINE 4629
// MISSING LINE 4630
// MISSING LINE 4631
// MISSING LINE 4632
// MISSING LINE 4633
// MISSING LINE 4634
// MISSING LINE 4635
// MISSING LINE 4636
// MISSING LINE 4637
// MISSING LINE 4638
// MISSING LINE 4639
// MISSING LINE 4640
// MISSING LINE 4641
// MISSING LINE 4642
// MISSING LINE 4643
// MISSING LINE 4644
// MISSING LINE 4645
// MISSING LINE 4646
// MISSING LINE 4647
// MISSING LINE 4648
// MISSING LINE 4649
// MISSING LINE 4650
// MISSING LINE 4651
// MISSING LINE 4652
// MISSING LINE 4653
// MISSING LINE 4654
// MISSING LINE 4655
// MISSING LINE 4656
// MISSING LINE 4657
// MISSING LINE 4658
// MISSING LINE 4659
// MISSING LINE 4660
// MISSING LINE 4661
// MISSING LINE 4662
// MISSING LINE 4663
// MISSING LINE 4664
// MISSING LINE 4665
// MISSING LINE 4666
// MISSING LINE 4667
// MISSING LINE 4668
// MISSING LINE 4669
// MISSING LINE 4670
// MISSING LINE 4671
// MISSING LINE 4672
// MISSING LINE 4673
// MISSING LINE 4674
// MISSING LINE 4675
// MISSING LINE 4676
// MISSING LINE 4677
// MISSING LINE 4678
// MISSING LINE 4679
// MISSING LINE 4680
// MISSING LINE 4681
// MISSING LINE 4682
// MISSING LINE 4683
// MISSING LINE 4684
// MISSING LINE 4685
// MISSING LINE 4686
// MISSING LINE 4687
// MISSING LINE 4688
// MISSING LINE 4689
// MISSING LINE 4690
// MISSING LINE 4691
// MISSING LINE 4692
// MISSING LINE 4693
// MISSING LINE 4694
// MISSING LINE 4695
// MISSING LINE 4696
// MISSING LINE 4697
// MISSING LINE 4698
// MISSING LINE 4699
// MISSING LINE 4700
// MISSING LINE 4701
// MISSING LINE 4702
// MISSING LINE 4703
// MISSING LINE 4704
// MISSING LINE 4705
// MISSING LINE 4706
// MISSING LINE 4707
// MISSING LINE 4708
// MISSING LINE 4709
// MISSING LINE 4710
// MISSING LINE 4711
// MISSING LINE 4712
// MISSING LINE 4713
// MISSING LINE 4714
// MISSING LINE 4715
// MISSING LINE 4716
// MISSING LINE 4717
// MISSING LINE 4718
// MISSING LINE 4719
// MISSING LINE 4720
// MISSING LINE 4721
// MISSING LINE 4722
// MISSING LINE 4723
// MISSING LINE 4724
// MISSING LINE 4725
// MISSING LINE 4726
// MISSING LINE 4727
// MISSING LINE 4728
// MISSING LINE 4729
        TError,
        {data: ChatMessagesControllerCreateMessageBody},
        TContext
      > => {
      return useMutation(getChatMessagesControllerCreateMessageMutationOptions(options), queryClient);
    }
// MISSING LINE 4736
export type chatMessagesControllerGetMessageHistoryResponse200 = {
  data: void
  status: 200
}
// MISSING LINE 4741
export type chatMessagesControllerGetMessageHistoryResponseSuccess = (chatMessagesControllerGetMessageHistoryResponse200) & {
  headers: Headers;
};
;
// MISSING LINE 4746
    }
// MISSING LINE 4748
// MISSING LINE 4749
export const getFeedControllerGetFollowingFeedInfiniteQueryOptions = <TData = InfiniteData<Awaited<ReturnType<typeof feedControllerGetFollowingFeed>>, FeedControllerGetFollowingFeedParams['cursor']>, TError = unknown>(params?: FeedControllerGetFollowingFeedParams, options?: { query?:Partial<UseInfiniteQueryOptions<Awaited<ReturnType<typeof feedControllerGetFollowingFeed>>, TError, TData, QueryKey, FeedControllerGetFollowingFeedParams['cursor']>>, request?: SecondParameter<typeof orvalClient>}
) => {
// MISSING LINE 4752
const {query: queryOptions, request: requestOptions} = options ?? {};
// MISSING LINE 4754
  const queryKey =  queryOptions?.queryKey ?? getFeedControllerGetFollowingFeedInfiniteQueryKey(params);
// MISSING LINE 4756
// MISSING LINE 4757
// MISSING LINE 4758
    const queryFn: QueryFunction<Awaited<ReturnType<typeof feedControllerGetFollowingFeed>>, QueryKey, FeedControllerGetFollowingFeedParams['cursor']> = ({ signal, pageParam }) => feedControllerGetFollowingFeed({...params, 'cursor': pageParam ?? params?.['cursor']}, { signal, ...requestOptions });
// MISSING LINE 4760
// MISSING LINE 4761
// MISSING LINE 4762
// MISSING LINE 4763
// MISSING LINE 4764
// MISSING LINE 4765
// MISSING LINE 4766
// MISSING LINE 4767
// MISSING LINE 4768
// MISSING LINE 4769
// MISSING LINE 4770
  return orvalClient<chatMessagesControllerGetMessageHistoryResponse>(getChatMessagesControllerGetMessageHistoryUrl(roomId,params),
  {
    ...options,
    method: 'GET'
// MISSING LINE 4775
// MISSING LINE 4776
  }
);}
// MISSING LINE 4779
// MISSING LINE 4780
// MISSING LINE 4781
// MISSING LINE 4782
// MISSING LINE 4783
export const getChatMessagesControllerGetMessageHistoryInfiniteQueryKey = (roomId: string,
    params?: ChatMessagesControllerGetMessageHistoryParams,) => {
    return [
    'infinite', `/chat-messages/${roomId}`, ...(params ? [params] : [])
    ] as const;
    }
// MISSING LINE 4790
export const getChatMessagesControllerGetMessageHistoryQueryKey = (roomId: string,
    params?: ChatMessagesControllerGetMessageHistoryParams,) => {
    return [
    `/chat-messages/${roomId}`, ...(params ? [params] : [])
    ] as const;
    }
// MISSING LINE 4797
// MISSING LINE 4798
export const getChatMessagesControllerGetMessageHistoryInfiniteQueryOptions = <TData = InfiniteData<Awaited<ReturnType<typeof chatMessagesControllerGetMessageHistory>>, ChatMessagesControllerGetMessageHistoryParams['cursor']>, TError = unknown>(roomId: string,
    params?: ChatMessagesControllerGetMessageHistoryParams, options?: { query?:Partial<UseInfiniteQueryOptions<Awaited<ReturnType<typeof chatMessagesControllerGetMessageHistory>>, TError, TData, QueryKey, ChatMessagesControllerGetMessageHistoryParams['cursor']>>, request?: SecondParameter<typeof orvalClient>}
// MISSING LINE 4801
// MISSING LINE 4802
// MISSING LINE 4803
// MISSING LINE 4804
// MISSING LINE 4805
// MISSING LINE 4806
// MISSING LINE 4807
// MISSING LINE 4808
// MISSING LINE 4809
// MISSING LINE 4810
// MISSING LINE 4811
// MISSING LINE 4812
// MISSING LINE 4813
// MISSING LINE 4814
// MISSING LINE 4815
// MISSING LINE 4816
// MISSING LINE 4817
// MISSING LINE 4818
// MISSING LINE 4819
// MISSING LINE 4820
// MISSING LINE 4821
// MISSING LINE 4822
// MISSING LINE 4823
// MISSING LINE 4824
// MISSING LINE 4825
// MISSING LINE 4826
// MISSING LINE 4827
// MISSING LINE 4828
// MISSING LINE 4829
// MISSING LINE 4830
// MISSING LINE 4831
// MISSING LINE 4832
// MISSING LINE 4833
// MISSING LINE 4834
// MISSING LINE 4835
// MISSING LINE 4836
// MISSING LINE 4837
// MISSING LINE 4838
// MISSING LINE 4839
// MISSING LINE 4840
// MISSING LINE 4841
// MISSING LINE 4842
// MISSING LINE 4843
// MISSING LINE 4844
// MISSING LINE 4845
// MISSING LINE 4846
// MISSING LINE 4847
// MISSING LINE 4848
// MISSING LINE 4849
// MISSING LINE 4850
// MISSING LINE 4851
// MISSING LINE 4852
// MISSING LINE 4853
// MISSING LINE 4854
// MISSING LINE 4855
// MISSING LINE 4856
// MISSING LINE 4857
// MISSING LINE 4858
// MISSING LINE 4859
// MISSING LINE 4860
// MISSING LINE 4861
// MISSING LINE 4862
// MISSING LINE 4863
// MISSING LINE 4864
// MISSING LINE 4865
// MISSING LINE 4866
// MISSING LINE 4867
// MISSING LINE 4868
// MISSING LINE 4869
// MISSING LINE 4870
// MISSING LINE 4871
// MISSING LINE 4872
// MISSING LINE 4873
// MISSING LINE 4874
// MISSING LINE 4875
// MISSING LINE 4876
// MISSING LINE 4877
// MISSING LINE 4878
// MISSING LINE 4879
// MISSING LINE 4880
// MISSING LINE 4881
// MISSING LINE 4882
// MISSING LINE 4883
// MISSING LINE 4884
// MISSING LINE 4885
// MISSING LINE 4886
// MISSING LINE 4887
// MISSING LINE 4888
// MISSING LINE 4889
// MISSING LINE 4890
// MISSING LINE 4891
// MISSING LINE 4892
// MISSING LINE 4893
// MISSING LINE 4894
// MISSING LINE 4895
// MISSING LINE 4896
// MISSING LINE 4897
// MISSING LINE 4898
// MISSING LINE 4899
// MISSING LINE 4900
// MISSING LINE 4901
// MISSING LINE 4902
// MISSING LINE 4903
// MISSING LINE 4904
// MISSING LINE 4905
// MISSING LINE 4906
// MISSING LINE 4907
// MISSING LINE 4908
// MISSING LINE 4909
// MISSING LINE 4910
// MISSING LINE 4911
// MISSING LINE 4912
// MISSING LINE 4913
// MISSING LINE 4914
// MISSING LINE 4915
// MISSING LINE 4916
// MISSING LINE 4917
// MISSING LINE 4918
// MISSING LINE 4919
// MISSING LINE 4920
// MISSING LINE 4921
// MISSING LINE 4922
// MISSING LINE 4923
// MISSING LINE 4924
// MISSING LINE 4925
// MISSING LINE 4926
// MISSING LINE 4927
// MISSING LINE 4928
// MISSING LINE 4929
// MISSING LINE 4930
// MISSING LINE 4931
// MISSING LINE 4932
// MISSING LINE 4933
// MISSING LINE 4934
// MISSING LINE 4935
// MISSING LINE 4936
// MISSING LINE 4937
// MISSING LINE 4938
// MISSING LINE 4939
// MISSING LINE 4940
// MISSING LINE 4941
// MISSING LINE 4942
// MISSING LINE 4943
// MISSING LINE 4944
// MISSING LINE 4945
// MISSING LINE 4946
// MISSING LINE 4947
// MISSING LINE 4948
// MISSING LINE 4949
// MISSING LINE 4950
// MISSING LINE 4951
// MISSING LINE 4952
// MISSING LINE 4953
// MISSING LINE 4954
// MISSING LINE 4955
// MISSING LINE 4956
// MISSING LINE 4957
// MISSING LINE 4958
// MISSING LINE 4959
// MISSING LINE 4960
// MISSING LINE 4961
// MISSING LINE 4962
// MISSING LINE 4963
// MISSING LINE 4964
// MISSING LINE 4965
// MISSING LINE 4966
// MISSING LINE 4967
// MISSING LINE 4968
// MISSING LINE 4969
// MISSING LINE 4970
// MISSING LINE 4971
// MISSING LINE 4972
// MISSING LINE 4973
// MISSING LINE 4974
// MISSING LINE 4975
// MISSING LINE 4976
// MISSING LINE 4977
// MISSING LINE 4978
// MISSING LINE 4979
// MISSING LINE 4980
// MISSING LINE 4981
// MISSING LINE 4982
// MISSING LINE 4983
// MISSING LINE 4984
// MISSING LINE 4985
// MISSING LINE 4986
// MISSING LINE 4987
// MISSING LINE 4988
// MISSING LINE 4989
// MISSING LINE 4990
// MISSING LINE 4991
// MISSING LINE 4992
// MISSING LINE 4993
// MISSING LINE 4994
// MISSING LINE 4995
// MISSING LINE 4996
// MISSING LINE 4997
// MISSING LINE 4998
// MISSING LINE 4999
// MISSING LINE 5000
// MISSING LINE 5001
// MISSING LINE 5002
// MISSING LINE 5003
// MISSING LINE 5004
// MISSING LINE 5005
// MISSING LINE 5006
// MISSING LINE 5007
// MISSING LINE 5008
// MISSING LINE 5009
// MISSING LINE 5010
// MISSING LINE 5011
// MISSING LINE 5012
// MISSING LINE 5013
// MISSING LINE 5014
// MISSING LINE 5015
// MISSING LINE 5016
// MISSING LINE 5017
// MISSING LINE 5018
// MISSING LINE 5019
// MISSING LINE 5020
// MISSING LINE 5021
// MISSING LINE 5022
// MISSING LINE 5023
// MISSING LINE 5024
// MISSING LINE 5025
// MISSING LINE 5026
// MISSING LINE 5027
// MISSING LINE 5028
// MISSING LINE 5029
// MISSING LINE 5030
// MISSING LINE 5031
// MISSING LINE 5032
// MISSING LINE 5033
// MISSING LINE 5034
// MISSING LINE 5035
// MISSING LINE 5036
// MISSING LINE 5037
// MISSING LINE 5038
// MISSING LINE 5039
// MISSING LINE 5040
// MISSING LINE 5041
// MISSING LINE 5042
// MISSING LINE 5043
// MISSING LINE 5044
// MISSING LINE 5045
// MISSING LINE 5046
// MISSING LINE 5047
// MISSING LINE 5048
// MISSING LINE 5049
// MISSING LINE 5050
// MISSING LINE 5051
// MISSING LINE 5052
// MISSING LINE 5053
// MISSING LINE 5054
// MISSING LINE 5055
// MISSING LINE 5056
// MISSING LINE 5057
// MISSING LINE 5058
// MISSING LINE 5059
// MISSING LINE 5060
// MISSING LINE 5061
// MISSING LINE 5062
// MISSING LINE 5063
// MISSING LINE 5064
// MISSING LINE 5065
// MISSING LINE 5066
// MISSING LINE 5067
// MISSING LINE 5068
// MISSING LINE 5069
// MISSING LINE 5070
// MISSING LINE 5071
// MISSING LINE 5072
// MISSING LINE 5073
// MISSING LINE 5074
// MISSING LINE 5075
// MISSING LINE 5076
// MISSING LINE 5077
// MISSING LINE 5078
// MISSING LINE 5079
// MISSING LINE 5080
// MISSING LINE 5081
// MISSING LINE 5082
// MISSING LINE 5083
// MISSING LINE 5084
// MISSING LINE 5085
// MISSING LINE 5086
// MISSING LINE 5087
// MISSING LINE 5088
// MISSING LINE 5089
// MISSING LINE 5090
// MISSING LINE 5091
// MISSING LINE 5092
// MISSING LINE 5093
// MISSING LINE 5094
// MISSING LINE 5095
// MISSING LINE 5096
// MISSING LINE 5097
// MISSING LINE 5098
// MISSING LINE 5099
// MISSING LINE 5100
    export type PostsControllerUpdateMutationError = unknown
// MISSING LINE 5102
    /**
 * @summary Cập nhật bài viết
 */
export const usePostsControllerUpdate = <TError = unknown,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof postsControllerUpdate>>, TError,{data: UpdatePostDto}, TContext>, request?: SecondParameter<typeof orvalClient>}
 , queryClient?: QueryClient): UseMutationResult<
        Awaited<ReturnType<typeof postsControllerUpdate>>,
        TError,
        {data: UpdatePostDto},
        TContext
      > => {
      return useMutation(getPostsControllerUpdateMutationOptions(options), queryClient);
    }
// MISSING LINE 5116
export type postsControllerFindOneResponse200 = {
  data: PostsControllerFindOne200
  status: 200
}
// MISSING LINE 5121
export type postsControllerFindOneResponseSuccess = (postsControllerFindOneResponse200) & {
  headers: Headers;
};
;
// MISSING LINE 5126
export type postsControllerFindOneResponse = (postsControllerFindOneResponseSuccess)
// MISSING LINE 5128
export const getPostsControllerFindOneUrl = (id: string,) => {
// MISSING LINE 5130
// MISSING LINE 5131
// MISSING LINE 5132
// MISSING LINE 5133
  return `/posts/${id}`
}
// MISSING LINE 5136
/**
 * @summary Find post by id
 */
export const postsControllerFindOne = async (id: string, options?: RequestInit): Promise<postsControllerFindOneResponse> => {
// MISSING LINE 5141
  return orvalClient<postsControllerFindOneResponse>(getPostsControllerFindOneUrl(id),
  {
    ...options,
    method: 'GET'
// MISSING LINE 5146
// MISSING LINE 5147
  }
);}
// MISSING LINE 5150
// MISSING LINE 5151
// MISSING LINE 5152
// MISSING LINE 5153
// MISSING LINE 5154
export const getPostsControllerFindOneQueryKey = (id: string,) => {
    return [
    `/posts/${id}`