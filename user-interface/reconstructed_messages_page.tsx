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
  } catch (e) {
    // Ignore parse errors
  }
}
// MISSING LINE 30
function cleanLines(text) {
  const result = [];
  const textLines = text.split('\n');
  for (const line of textLines) {
    const match = line.match(/^\s*(\d+):\s(.*)/);
    if (match) {
      result.push(match[2]);
    }
  }
  return result;
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
// MISSING LINE 136
    // Typing: filter active chats first (Local search)
    const term = searchTerm.toLowerCase();
    const localChats = activeChats.filter((room: any) => {
      const otherUser = room.members.find((m: any) => m.id !== user?.id);
      return (
        otherUser?.username?.toLowerCase().includes(term) ||
        otherUser?.full_name?.toLowerCase().includes(term)
      );
    });
// MISSING LINE 146
    // Merge with API search results (Global search), excluding already active chats
    const localUserIds = new Set(
      localChats.map(
        (room: any) => room.members.find((m: any) => m.id !== user?.id)?.id,
      ),
    );
    const globalUsers = searchedUsers.filter(
      (u: any) => !localUserIds.has(u.id),
    );
// MISSING LINE 156
    return {
      active: localChats,
      suggested: globalUsers,
      isSearching: true,
    };
  }, [searchTerm, isSearchFocused, activeChats, searchedUsers, user?.id]);
// MISSING LINE 163
// MISSING LINE 164
  }, [searchTerm, isSearchFocused, chatRooms, searchedUsers, user?.id]);
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
      const savedMsg = data.message;
      const roomId = savedMsg.chat_room_id;
      queryClient.setQueryData(
        getChatMessagesControllerGetMessageHistoryQueryKey(roomId),
        (old: any) => {
          if (!old) return old;
          const currentList = old.data?.data || [];
          return {
            ...old,
            data: {
              ...old.data,
              data: currentList.map((m: any) =>
                m.id === data.tempId ? savedMsg : m,
              ),
            },
          };
        },
      );
      // Refresh room list for last_message preview update
      queryClient.invalidateQueries({
        queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
      });
        }
        socket?.off('newMessage');
        socket?.off('userStatusChanged');
      };
     * Marks the optimistic message as failed.
     */
    const handleMessageError = (data: { tempId: string; error: string }) => {
      // Find which room this temp message belongs to by scanning all caches
      // (tempId is unique across all rooms)
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
              data: {
                ...old.data,
                data: (old.data?.data || []).map((m: any) =>
                  m.id === data.tempId
                    ? { ...m, is_failed: true, is_sending: false }
                    : m,
                ),
              },
            };
          });
      }
    }
  };
// MISSING LINE 274
  // Image Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };
// MISSING LINE 282
  // Send Message Logic
  const handleSendMessage = () => {
    if (!messageInput.trim() && selectedFiles.length === 0) return;
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {filteredSearch.active.map((room: any) => {
                const targetUser = room.members.find(
                  (m: any) => m.id !== user?.id,
                );
       const activeUserIds = new Set(...);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
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
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: (old.data?.data || []).map((m: any) =>
                m.id === data.id
                  ? { ...m, message: data.message, message_status: data.message_status, medias: [] }
                  : m,
          return {
            data: {
              data: [tempMsg],
              meta: { has_more: false, next_cursor: null },
      );
    };
// MISSING LINE 337
    /**
     * userStatusChanged — a user went online or offline.
     */
    const handleUserStatusChanged = ({ user_id, is_online, last_active }: any) => {
      // Update room list cache
      queryClient.setQueriesData(
        { queryKey: getChatRoomsControllerGetListChatRoomQueryKey() },
        (old: any) => {
          if (!old || !old.data) return old;
          const data = old.data?.data || old.data;
          if (!Array.isArray(data)) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: data.map((room: any) => ({
                ...room,
                members: room.members.map((m: any) =>
                  m.id === user_id ? { ...m, is_online, last_active } : m,
                ),
              })),
            },
          };
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
      );
    };
// MISSING LINE 402
    // Register all listeners
    socket.on('newMessage', handleNewMessage);
    socket.on('messageSaved', handleMessageSaved);
    socket.on('messageError', handleMessageError);
    socket.on('messageEdited', handleMessageEdited);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('userStatusChanged', handleUserStatusChanged);
    socket.on('messageReactionUpdated', handleReactionUpdated);
// MISSING LINE 411
    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageSaved', handleMessageSaved);
      socket.off('messageError', handleMessageError);
      socket.off('messageEdited', handleMessageEdited);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('userStatusChanged', handleUserStatusChanged);
      socket.off('messageReactionUpdated', handleReactionUpdated);
    };
  }, [token, queryClient, toast]);
// MISSING LINE 422
  // Scroll to bottom: instant on room change, smooth on new messages
  const prevMessagesLenRef = useRef(0);
  const hasScrolledForRoom = useRef<string | null>(null);
// MISSING LINE 426
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    // Use rAF + timeout to ensure DOM has fully rendered
    requestAnimationFrame(() => {
      setTimeout(() => {
          const res = await chatMessagesControllerGetMessageHistory(
            selectedRoomId,
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
        }
      }
    }
  };
// MISSING LINE 462
  // Image & Video Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };
// MISSING LINE 470
  /**
   * Send Message Logic (Hybrid: WebSocket for text, REST for media).
   *
   * Text-only messages → WebSocket (fast path, ~50ms latency)
   * Media messages → REST multipart/form-data (supports file upload)
   *
   * Both paths use Optimistic Updates for instant UI feedback.
   */
  const handleSendMessage = () => {
    if (!messageInput.trim() && selectedFiles.length === 0) return;
    if (!selectedRoomId) return;
// MISSING LINE 482
    const msg = messageInput.trim();
    const filesToSend = [...selectedFiles];
    const hasMedia = filesToSend.length > 0;
// MISSING LINE 486
    setMessageInput('');
    setSelectedFiles([]);
// MISSING LINE 489
    const tempId = 'temp-' + Date.now();
    const tempMsg = {
      id: tempId,
      chat_room_id: selectedRoomId,
      created_by: user?.id,
      message: msg,
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
// MISSING LINE 668
// MISSING LINE 669
// MISSING LINE 670
// MISSING LINE 671
// MISSING LINE 672
// MISSING LINE 673
// MISSING LINE 674
// MISSING LINE 675
// MISSING LINE 676
// MISSING LINE 677
// MISSING LINE 678
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
// MISSING LINE 794
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
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };
// MISSING LINE 809
  const handleSendHeart = () => {
    if (!selectedRoomId) return;
// MISSING LINE 812
    const tempId = 'temp-' + Date.now();
    const tempMsg = {
      id: tempId,
      chat_room_id: selectedRoomId,
      created_by: user?.id,
      message: '❤️',
      created_at: new Date().toISOString(),
      user: user,
      is_sending: true,
    };
// MISSING LINE 823
    // Optimistically write to query cache
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
// MISSING LINE 851
            return {
              ...msg,
              reactions: newReactions,
            };
          }),
        },
      };
    });
// MISSING LINE 860
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
// MISSING LINE 879
  const handleSendHeart = () => {
    if (!selectedRoomId) return;
// MISSING LINE 882
    const tempId = 'temp-' + Date.now();
    const tempMsg = {
      id: tempId,
      chat_room_id: selectedRoomId,
      created_by: user?.id,
      message: '❤️',
      created_at: new Date().toISOString(),
      user: user,
      is_sending: true,
    };
// MISSING LINE 893
    // Optimistically write to query cache
    queryClient.setQueryData(
      getChatMessagesControllerGetMessageHistoryQueryKey(selectedRoomId),
      (old: any) => {
        if (!old) {
          return {
            data: {
                  {filteredSearch.isSearching ? 'Kết quả khác' : 'Gợi ý'}
                </div>
              )}
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