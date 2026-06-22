-- Backfill direct message requests without changing schema.
-- Rule:
-- - Keep direct rooms in primary if both users mutually follow each other.
-- - Keep direct rooms in primary if the receiver has already replied.
-- - Move the receiver to pending when the room is one-way/no-reply and users are not mutual followers.

BEGIN;

WITH candidate_rooms AS (
  SELECT
    room.id AS room_id,
    room.created_by AS sender_id,
    receiver.user_id AS receiver_id
  FROM chat_room room
  JOIN chat_member sender
    ON sender.chat_room_id = room.id
   AND sender.user_id = room.created_by
  JOIN chat_member receiver
    ON receiver.chat_room_id = room.id
   AND receiver.user_id <> room.created_by
  WHERE room.type = 'direct'
    AND sender.status = 'accepted'
    AND receiver.status = 'accepted'
    AND NOT EXISTS (
      SELECT 1
      FROM relation r1
      JOIN relation r2
        ON r2.request_side_id = receiver.user_id
       AND r2.accept_side_id = room.created_by
       AND r2.relation_type = 'following'
      WHERE r1.request_side_id = room.created_by
        AND r1.accept_side_id = receiver.user_id
        AND r1.relation_type = 'following'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM chat_message msg
      WHERE msg.chat_room_id = room.id
        AND msg.created_by = receiver.user_id
        AND msg.message_status NOT IN ('system', 'SYSTEM')
    )
),
updated_members AS (
  UPDATE chat_member member
  SET status = 'pending'
  FROM candidate_rooms candidate
  WHERE member.chat_room_id = candidate.room_id
    AND member.user_id = candidate.receiver_id
  RETURNING member.chat_room_id, member.user_id
)
SELECT COUNT(*) AS moved_receivers_to_pending
FROM updated_members;

COMMIT;
