import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import styles from './ChatDropdown.module.css';
import {
  getChatUsers,
  createOrGetDM,
  sendMessage as sendMessageApi,
} from '../../api/chat_api';
import type { Message, ChatUser } from '../../api/chat_api';
import { useChatContext } from '../../context/ChatContext';

type DepartmentType = '소화기내과' | '원무과' | '영상의학과';

interface ChatDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEPARTMENTS: DepartmentType[] = ['소화기내과', '원무과', '영상의학과'];

const ROLE_TO_DEPARTMENT: Record<string, DepartmentType> = {
  'DOCTOR': '소화기내과',
  'RADIOLOGIST': '영상의학과',
  'CLERK': '원무과',
};

// 전역 캐시 - 컴포넌트 외부에서 유지 (리마운트 시에도 캐시 유지)
let globalUsersCache: Map<DepartmentType, ChatUser[]> = new Map();
let globalPreloadStarted = false;

export default function ChatDropdown({ isOpen, onClose }: ChatDropdownProps) {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [selectedConversationName, setSelectedConversationName] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType>('소화기내과');
  const [messageInput, setMessageInput] = useState('');

  // ChatContext에서 대화방 목록 및 기능 가져오기
  const {
    conversations,
    isConnected,
    loadConversations,
    markConversationAsRead,
    getMessagesForConversation,
    sendMessage: wsSendMessage,
    editMessage: wsEditMessage,
    deleteMessage: wsDeleteMessage,
    addMessageListener,
    removeMessageListener,
  } = useChatContext();

  // Local states
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  // 수정/삭제 상태
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true); // 초기 로드 여부 추적
  const hasLoadedInitial = useRef(false); // 최초 로드 여부

  // localStorage의 user 객체에서 user_id 가져오기
  const getCurrentUserId = (): number => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        // 서버 응답에서 'id'로 저장됨 (user_id가 아님)
        return user.id || user.user_id || 0;
      }
    } catch {
      // JSON 파싱 실패 시
    }
    return 0;
  };
  const currentUserId = getCurrentUserId();

  // 메시지 리스너 설정 - 선택된 대화방의 실시간 메시지/수정/삭제 수신
  useEffect(() => {
    if (selectedConversation) {
      const handleMessageEvent = (event: any) => {
        console.log('[ChatDropdown] handleMessageEvent:', event.type, event);

        // 메시지 수정 이벤트
        if (event.type === 'message_edited') {
          console.log('[ChatDropdown] Processing message_edited:', event.message_id);
          setMessages(prev => prev.map(m =>
            m.message_id === event.message_id
              ? { ...m, body: event.body, edited_at: event.edited_at }
              : m
          ));
          return;
        }

        // 메시지 삭제 이벤트
        if (event.type === 'message_deleted') {
          console.log('[ChatDropdown] Processing message_deleted:', event.message_id);
          setMessages(prev => prev.filter(m => m.message_id !== event.message_id));
          return;
        }

        // 새 메시지 이벤트
        const message = event;
        console.log('[ChatDropdown] handleNewMessage:', {
          message_sender_id: message.sender_id,
          currentUserId,
          isEqualWithConversion: Number(message.sender_id) === Number(currentUserId)
        });

        setMessages(prev => {
          // 낙관적 업데이트로 이미 추가된 임시 메시지가 있으면 교체
          const tempIndex = prev.findIndex(m =>
            m.message_id < 0 &&
            m.body === message.body &&
            Number(m.sender.user_id) === Number(message.sender_id)
          );

          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = {
              message_id: message.message_id,
              conversation: message.conversation_id,
              sender: {
                user_id: message.sender_id,
                username: '',
                role: '',
                name: message.sender_name
              },
              body: message.body,
              message_type: message.message_type,
              created_at: message.created_at,
              edited_at: null,
              is_deleted: false,
              is_mine: Number(message.sender_id) === Number(currentUserId)
            };
            return updated;
          }

          // 중복 메시지 방지
          if (prev.some(m => m.message_id === message.message_id)) {
            return prev;
          }

          // 자신이 보낸 메시지 - 임시 메시지 교체
          const isMine = Number(message.sender_id) === Number(currentUserId);
          if (isMine) {
            const hasSimilarTemp = prev.some(m => m.message_id < 0 && m.body === message.body);
            if (hasSimilarTemp) {
              return prev.map(m => {
                if (m.message_id < 0 && m.body === message.body) {
                  return {
                    message_id: message.message_id,
                    conversation: message.conversation_id,
                    sender: {
                      user_id: message.sender_id,
                      username: '',
                      role: '',
                      name: message.sender_name
                    },
                    body: message.body,
                    message_type: message.message_type,
                    created_at: message.created_at,
                    edited_at: null,
                    is_deleted: false,
                    is_mine: true
                  };
                }
                return m;
              });
            }
          }

          // 새 메시지 추가
          return [...prev, {
            message_id: message.message_id,
            conversation: message.conversation_id,
            sender: {
              user_id: message.sender_id,
              username: '',
              role: '',
              name: message.sender_name
            },
            body: message.body,
            message_type: message.message_type,
            created_at: message.created_at,
            edited_at: null,
            is_deleted: false,
            is_mine: isMine
          }];
        });

        // 읽음 처리
        markConversationAsRead(message.conversation_id, message.message_id).catch(console.error);
      };

      addMessageListener(selectedConversation, handleMessageEvent);

      return () => {
        removeMessageListener(selectedConversation);
      };
    }
  }, [selectedConversation, currentUserId, addMessageListener, removeMessageListener, markConversationAsRead]);

  // 사용자 목록 로드 (전역 캐시 사용 - 즉시 반환)
  const loadUsers = useCallback(async (department: DepartmentType) => {
    // 전역 캐시에 있으면 즉시 반환 (로딩 표시 없음)
    const cached = globalUsersCache.get(department);
    if (cached) {
      setUsers(cached);
      return;
    }

    try {
      setUsersLoading(true);
      const data = await getChatUsers(department);
      globalUsersCache.set(department, data); // 전역 캐시에 저장
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // 모든 부서 사용자 미리 로딩 (백그라운드)
  const preloadAllDepartments = useCallback(async () => {
    if (globalPreloadStarted) return;
    globalPreloadStarted = true;

    // 모든 부서 병렬 로딩
    await Promise.all(
      DEPARTMENTS.map(async (dept) => {
        if (!globalUsersCache.has(dept)) {
          try {
            const data = await getChatUsers(dept);
            globalUsersCache.set(dept, data);
          } catch (error) {
            console.error(`Failed to preload ${dept}:`, error);
          }
        }
      })
    );
  }, []);

  // 메시지 목록 로드 (읽음 처리는 백그라운드에서)
  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      setLoading(true);
      const data = await getMessagesForConversation(conversationId);
      setMessages(data);
      setLoading(false); // 메시지 표시 먼저

      // 마지막 메시지 읽음 처리 (백그라운드, UI 블로킹 없음)
      if (data.length > 0) {
        const lastMessage = data[data.length - 1];
        markConversationAsRead(conversationId, lastMessage.message_id).catch(console.error);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      setLoading(false);
    }
  }, [getMessagesForConversation, markConversationAsRead]);

  // 초기 로드 - 드롭다운 열릴 때 대화방 목록 + 사용자 목록 병렬 로드
  useEffect(() => {
    if (isOpen) {
      if (!hasLoadedInitial.current) {
        // 최초 로드: 대화방 + 현재 부서 로드 + 다른 부서들 백그라운드 프리로드
        hasLoadedInitial.current = true;
        loadConversations();
        loadUsers(selectedDepartment);
        // 다른 부서들은 백그라운드에서 프리로드 (UI 블로킹 없음)
        preloadAllDepartments();
      } else {
        // 이후 열기: 대화방만 새로고침 (사용자는 캐시에서 즉시 반환)
        loadConversations();
        loadUsers(selectedDepartment);
      }
    }
  }, [isOpen, loadConversations, loadUsers, selectedDepartment, preloadAllDepartments]);

  // 부서 변경 시 사용자 로드 (캐시 사용으로 빠름)
  useEffect(() => {
    if (isOpen && hasLoadedInitial.current) {
      loadUsers(selectedDepartment);
    }
  }, [selectedDepartment, loadUsers, isOpen]);

  // 대화방 선택 시 메시지 로드
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation, loadMessages]);

  // 메시지 로드/추가 시 스크롤 (채팅 컨테이너 내에서만)
  useEffect(() => {
    if (messages.length === 0 || loading) return;

    // DOM 렌더링 완료 후 스크롤 실행
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        if (isInitialLoadRef.current) {
          // 초기 로드 시 즉시 스크롤
          container.scrollTop = container.scrollHeight;
          isInitialLoadRef.current = false;
        } else {
          // 새 메시지 추가 시 부드럽게 스크롤
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        }
      }
    };

    // requestAnimationFrame으로 DOM 렌더링 후 스크롤 보장
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });
  }, [messages, loading]);

  // 대화방 변경 시 초기 로드 플래그 리셋
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [selectedConversation]);

  // 메시지 전송 - 낙관적 업데이트 적용
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return;

    const body = messageInput.trim();
    setMessageInput('');

    // 낙관적 업데이트: 즉시 메시지를 화면에 표시 (임시 ID 사용)
    const tempMessage: Message = {
      message_id: -Date.now(), // 임시 음수 ID
      conversation: selectedConversation,
      sender: {
        user_id: currentUserId,
        username: '',
        role: '',
        name: ''
      },
      body: body,
      message_type: 'TEXT',
      created_at: new Date().toISOString(),
      edited_at: null,
      is_deleted: false,
      is_mine: true
    };

    setMessages(prev => [...prev, tempMessage]);

    try {
      if (isConnected) {
        // WebSocket으로 전송 (실시간) - 서버 응답으로 실제 메시지가 오면 임시 메시지 교체됨
        wsSendMessage(selectedConversation, body);
      } else {
        // WebSocket이 연결되지 않은 경우 REST API로 전송
        const sentMessage = await sendMessageApi(selectedConversation, body);
        // 임시 메시지를 실제 메시지로 교체
        setMessages(prev => prev.map(m =>
          m.message_id === tempMessage.message_id
            ? { ...sentMessage, is_mine: true }
            : m
        ));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // 실패 시 임시 메시지 제거하고 입력 복구
      setMessages(prev => prev.filter(m => m.message_id !== tempMessage.message_id));
      setMessageInput(body);
    }
  };

  // 메시지 수정 시작
  const handleStartEdit = (msg: Message) => {
    setEditingMessageId(msg.message_id);
    setEditingText(msg.body);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  // 메시지 수정 완료
  const handleConfirmEdit = () => {
    if (editingMessageId && editingText.trim()) {
      wsEditMessage(editingMessageId, editingText.trim());
      // 낙관적 업데이트
      setMessages(prev => prev.map(m =>
        m.message_id === editingMessageId
          ? { ...m, body: editingText.trim(), edited_at: new Date().toISOString() }
          : m
      ));
    }
    setEditingMessageId(null);
    setEditingText('');
  };

  // 메시지 수정 취소
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  // 메시지 삭제
  const handleDeleteMessage = (messageId: number) => {
    if (confirm('메시지를 삭제하시겠습니까?')) {
      wsDeleteMessage(messageId);
      // 낙관적 업데이트
      setMessages(prev => prev.filter(m => m.message_id !== messageId));
    }
  };

  // 수정 입력 키 핸들러
  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // 사용자 선택하여 DM 시작
  const handleStartDM = async (user: ChatUser) => {
    try {
      setLoading(true);
      const conversation = await createOrGetDM(user.user_id);
      setSelectedConversation(conversation.conversation_id);
      setSelectedConversationName(user.name);
      await loadConversations(); // 목록 새로고침
    } catch (error) {
      console.error('Failed to create DM:', error);
    } finally {
      setLoading(false);
    }
  };

  // 대화방 선택
  const handleSelectConversation = (conversationId: number, name: string) => {
    setSelectedConversation(conversationId);
    setSelectedConversationName(name);
  };

  // 목록으로 돌아가기
  const handleBackToList = () => {
    setSelectedConversation(null);
    setSelectedConversationName('');
    setMessages([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 시간 포맷
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const dayDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } else if (dayDiff === 1) {
      return '어제';
    } else if (dayDiff < 7) {
      return `${dayDiff}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
  };

  // 대화방을 부서별로 필터링 (메모이제이션)
  const filteredConversations = useMemo(() =>
    conversations.filter(conv => {
      if (conv.type === 'DM' && conv.other_user) {
        const otherDepartment = ROLE_TO_DEPARTMENT[conv.other_user.role];
        return otherDepartment === selectedDepartment;
      }
      return false;
    }), [conversations, selectedDepartment]);

  // 대화 중이 아닌 사용자 목록 (메모이제이션)
  const availableUsers = useMemo(() =>
    users.filter(user => !filteredConversations.some(conv => conv.other_user?.user_id === user.user_id)),
    [users, filteredConversations]);

  if (!isOpen) return null;

  return (
    <div className={styles.chatDropdown}>
      <div className={styles.chatHeader}>
        <span className={styles.chatTitle}>
          {selectedConversation
            ? selectedConversationName || '채팅'
            : '메시지'}
        </span>
        {selectedConversation ? (
          <button className={styles.backButton} onClick={handleBackToList}>
            ← 목록
          </button>
        ) : (
          <button className={styles.closeButton} onClick={onClose}>×</button>
        )}
      </div>

      {!selectedConversation ? (
        <>
          {/* 부서 선택 탭 */}
          <div className={styles.departmentTabs}>
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                className={`${styles.departmentTab} ${selectedDepartment === dept ? styles.activeTab : ''}`}
                onClick={() => setSelectedDepartment(dept)}
              >
                {dept}
              </button>
            ))}
          </div>

          <div className={styles.chatList}>
            {/* 대화방 목록은 항상 표시 (있으면) */}
            {filteredConversations.length > 0 && (
              <>
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.conversation_id}
                    className={styles.chatRoomItem}
                    onClick={() => handleSelectConversation(conv.conversation_id, conv.other_user?.name || '알 수 없음')}
                  >
                    <div className={styles.roomAvatar}>
                      {conv.other_user?.name.charAt(0) || '?'}
                    </div>
                    <div className={styles.roomInfo}>
                      <div className={styles.roomHeader}>
                        <span className={styles.roomName}>
                          {conv.other_user?.name || '알 수 없음'}
                        </span>
                        <span className={styles.roomRole}>
                          {conv.other_user?.role || ''}
                        </span>
                      </div>
                      <div className={styles.roomPreview}>
                        <span className={styles.lastMessage}>
                          {conv.last_message?.body || '대화를 시작하세요'}
                        </span>
                        {conv.last_message && (
                          <span className={styles.lastTime}>
                            {formatTime(conv.last_message.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className={styles.unreadBadge}>{conv.unread_count}</span>
                    )}
                  </div>
                ))}
              </>
            )}
            {/* 대화 중이 아닌 사용자 목록 */}
            {usersLoading ? (
              <div className={styles.emptyState}>사용자 로딩 중...</div>
            ) : (
              availableUsers.map((user) => (
                <div
                  key={user.user_id}
                  className={styles.chatRoomItem}
                  onClick={() => handleStartDM(user)}
                >
                  <div className={styles.roomAvatar}>
                    {user.name.charAt(0)}
                  </div>
                  <div className={styles.roomInfo}>
                    <div className={styles.roomHeader}>
                      <span className={styles.roomName}>{user.name}</span>
                      <span className={styles.roomRole}>{user.role}</span>
                    </div>
                    <div className={styles.roomPreview}>
                      <span className={styles.lastMessage}>대화를 시작하세요</span>
                    </div>
                  </div>
                </div>
              ))
            )}
            {/* 데이터가 없을 때 */}
            {filteredConversations.length === 0 && availableUsers.length === 0 && !usersLoading && (
              <div className={styles.emptyState}>해당 부서에 사용자가 없습니다</div>
            )}
          </div>
        </>
      ) : (
        // 채팅 화면
        <div className={styles.chatRoom}>
          <div className={styles.messagesContainer} ref={messagesContainerRef}>
            {loading ? (
              <div className={styles.loadingMessages}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`${styles.skeletonMessage} ${i % 2 === 0 ? styles.mine : styles.other}`}>
                    <div className={styles.skeletonBubble} />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className={styles.emptyState}>
                대화를 시작하세요!
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.message_id}
                  className={`${styles.messageWrapper} ${msg.is_mine ? styles.mine : styles.other}`}
                >
                  {editingMessageId === msg.message_id ? (
                    // 수정 모드
                    <div className={styles.editContainer}>
                      <input
                        ref={editInputRef}
                        type="text"
                        className={styles.editInput}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={handleEditKeyPress}
                      />
                      <div className={styles.editActions}>
                        <button className={styles.editConfirm} onClick={handleConfirmEdit}>✓</button>
                        <button className={styles.editCancel} onClick={handleCancelEdit}>✕</button>
                      </div>
                    </div>
                  ) : (
                    // 일반 모드
                    <>
                      <div className={styles.messageBubble}>
                        {msg.body}
                        {msg.edited_at && <span className={styles.editedLabel}>(수정됨)</span>}
                      </div>
                      <div className={styles.messageFooter}>
                        <span className={styles.messageTime}>
                          {formatTime(msg.created_at)}
                        </span>
                        {msg.is_mine && msg.message_id > 0 && (
                          <div className={styles.messageActions}>
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleStartEdit(msg)}
                              title="수정"
                            >
                              ✎
                            </button>
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleDeleteMessage(msg.message_id)}
                              title="삭제"
                            >
                              🗑
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className={styles.inputContainer}>
            <input
              type="text"
              className={styles.messageInput}
              placeholder="메시지를 입력하세요..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button className={styles.sendButton} onClick={handleSendMessage}>
              전송
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
