import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import {
  Plus,
  MessageSquare,
  Send,
  Trash2,
  Sparkles,
  Menu,
  Search,
  MoreHorizontal,
  Pencil,
} from "lucide-react";

import { sendChat, generateTitleFn } from "@/lib/chat.functions";
import { deriveTitle, newId } from "@/lib/chat-storage";
import {
  getConversationsFn,
  getMessagesFn,
  createConversationFn,
  addMessageFn,
  deleteConversationFn,
  updateConversationTitleFn,
  deleteMessageFn,
} from "@/lib/db.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sunset Chat — AI Assistant" },
      {
        name: "description",
        content: "A warm sunset-themed AI chatbot powered by Groq.",
      },
    ],
  }),
  component: ChatPage,
});

type Conversation = { id: string; title: string; updatedAt: Date };
type ChatMessage = { id: string; role: string; content: string; createdAt: Date };

function ChatPage() {
  const sendChatFn = useServerFn(sendChat);
  const getConvos = useServerFn(getConversationsFn);
  const getMsgs = useServerFn(getMessagesFn);
  const createConvo = useServerFn(createConversationFn);
  const addMsg = useServerFn(addMessageFn);
  const delConvo = useServerFn(deleteConversationFn);
  const delMsg = useServerFn(deleteMessageFn);
  const updateConvoTitle = useServerFn(updateConversationTitleFn);
  const generateTitle = useServerFn(generateTitleFn);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Rename Dialog State
  const [editingConvo, setEditingConvo] = useState<Conversation | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    getConvos().then(setConversations);
  }, [getConvos]);

  useEffect(() => {
    if (activeId) {
      getMsgs({ data: { conversationId: activeId } }).then(setMessages);
    } else {
      setMessages([]);
    }
  }, [activeId, getMsgs]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [conversations, searchQuery]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  function startNewChat() {
    setActiveId(null);
    setInput("");
  }

  function selectChat(id: string) {
    setActiveId(id);
  }

  async function deleteChat(id: string) {
    try {
      await delConvo({ data: { id } });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteMessage(id: string) {
    try {
      await delMsg({ data: { id } });
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== id);
        if (next.length === 0 && activeId) {
          deleteChat(activeId);
        }
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  }

  function openRenameDialog(c: Conversation) {
    setEditingConvo(c);
    setEditTitle(c.title);
  }

  async function handleRename() {
    if (!editingConvo || !editTitle.trim()) return;
    try {
      await updateConvoTitle({ data: { id: editingConvo.id, title: editTitle.trim() } });
      setConversations((prev) =>
        prev.map((c) => (c.id === editingConvo.id ? { ...c, title: editTitle.trim() } : c)),
      );
      setEditingConvo(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    let currentConvoId = activeId;
    let isNewConversation = !currentConvoId;
    const userMsg = {
      id: newId(),
      role: "user",
      content: text,
      createdAt: new Date(),
    };

    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);

    try {
      if (!currentConvoId) {
        currentConvoId = newId();
        const initialTitle = deriveTitle(text);
        await createConvo({ data: { id: currentConvoId, title: initialTitle } });
        setConversations((prev) => [
          { id: currentConvoId as string, title: initialTitle, updatedAt: new Date() },
          ...prev,
        ]);
        setActiveId(currentConvoId);
      } else {
        setConversations((prev) => {
          const arr = [...prev];
          const idx = arr.findIndex((x) => x.id === currentConvoId);
          if (idx >= 0) {
            const item = arr.splice(idx, 1)[0];
            item.updatedAt = new Date();
            arr.unshift(item);
          }
          return arr;
        });
      }

      await addMsg({
        data: {
          id: userMsg.id,
          conversationId: currentConvoId,
          role: "user",
          content: text,
        },
      });

      const currentMessages = [...messages, userMsg].map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      // Generate Title asynchronously if new chat
      if (isNewConversation) {
        generateTitle({ data: { messages: currentMessages.slice(0, 5) } }).then((res) => {
          if (res.ok && res.title && res.title !== "New Chat") {
            updateConvoTitle({ data: { id: currentConvoId as string, title: res.title } });
            setConversations((prev) =>
              prev.map((c) => (c.id === currentConvoId ? { ...c, title: res.title } : c)),
            );
          }
        });
      }

      const res = await sendChatFn({
        data: {
          messages: currentMessages,
        },
      });

      const assistantContent = res.ok
        ? res.content
        : `⚠️ ${res.error || "Failed to get response."}`;

      const assistantMsg = {
        id: newId(),
        role: "assistant",
        content: assistantContent,
        createdAt: new Date(),
      };

      setMessages((m) => [...m, assistantMsg]);
      await addMsg({
        data: {
          id: assistantMsg.id,
          conversationId: currentConvoId as string,
          role: "assistant",
          content: assistantContent,
        },
      });
    } catch (err) {
      console.error(err);
      const assistantMsg = {
        id: newId(),
        role: "assistant",
        content: `⚠️ ${err instanceof Error ? err.message : "Network error"}`,
        createdAt: new Date(),
      };
      setMessages((m) => [...m, assistantMsg]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
          sidebarOpen ? "min-w-72 w-auto" : "w-0",
        )}
      >
        <div className={cn("flex h-full flex-col", !sidebarOpen && "hidden")}>
          <div className="flex items-center gap-2 px-4 py-4">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-sunset)" }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Sunset Chat</p>
              <p className="text-xs text-muted-foreground">Powered by Groq</p>
            </div>
          </div>

          <div className="px-3 flex flex-col gap-3">
            <Button
              onClick={startNewChat}
              className="w-full justify-start gap-2 shadow-sm"
              style={{ backgroundImage: "var(--gradient-sunset)" }}
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-background/50"
              />
            </div>
          </div>

          <div className="mt-5 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            History
          </div>

          <ScrollArea className="mt-2 flex-1 px-2">
            {filteredConversations.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {searchQuery ? "No chats found." : "No previous chats yet."}
              </p>
            ) : (
              <ul className="space-y-1 pb-4">
                {filteredConversations.map((c) => (
                  <li key={c.id}>
                    <div
                      onClick={() => selectChat(c.id)}
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                        activeId === c.id
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/60",
                      )}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                      <span className="flex-1 truncate min-w-0">{c.title}</span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 opacity-50 group-hover:opacity-100 data-[state=open]:opacity-100 -mr-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openRenameDialog(c);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteChat(c.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </aside>

      {/* Main */}
      <main className="flex h-full flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border/60 bg-card/60 px-4 py-3 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((s) => !s)}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-sm font-semibold">{active ? active.title : "New Chat"}</h1>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-8">
            {!active || messages.length === 0 ? (
              <EmptyState onPick={(p) => setInput(p)} />
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onDelete={() => handleDeleteMessage(m.id)}
                  />
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    Thinking…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 bg-card/60 px-4 py-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Send a message…"
              rows={1}
              className="min-h-13 max-h-48 resize-none rounded-2xl border-border/80 bg-background/80 px-4 py-3 text-base shadow-sm focus-visible:ring-primary"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="h-13 w-13 shrink-0 rounded-2xl p-0 shadow-md"
              style={{ backgroundImage: "var(--gradient-sunset)" }}
              aria-label="Send"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
            Press Enter to send · Shift + Enter for new line
          </p>
        </div>
      </main>

      {/* Rename Dialog */}
      <Dialog open={!!editingConvo} onOpenChange={(open) => !open && setEditingConvo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
              }}
              placeholder="Chat name"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConvo(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBubble({ message, onDelete }: { message: ChatMessage; onDelete?: () => void }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("group flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-sunset)" }}
        >
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "relative max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-card text-card-foreground border border-border/60",
        )}
      >
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className={cn(
              "absolute -top-3 h-7 w-7 rounded-full bg-background/80 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground",
              isUser ? "-left-3" : "-right-3",
            )}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  const suggestions = [
    "Explain quantum computing in simple terms",
    "Write a haiku about a sunset over the ocean",
    "Give me a 5-day itinerary for Bali",
    "Help me debug a TypeScript error",
  ];
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-primary-foreground shadow-lg"
        style={{ backgroundImage: "var(--gradient-sunset)" }}
      >
        <Sparkles className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">How can I help today?</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Ask anything, brainstorm ideas, or pick one of the suggestions below to get started.
      </p>
      <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-border/70 bg-card/60 p-4 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
