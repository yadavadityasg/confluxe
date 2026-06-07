import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { useEffect, useRef } from "react";
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Heading1, Heading2, Heading3, Link as LinkIcon, Undo, Redo, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  content: unknown;
  editable?: boolean;
  onChange?: (json: unknown) => void;
  placeholder?: string;
};

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 years

async function uploadImage(file: File): Promise<string> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Not signed in");
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("page-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/png",
  });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage.from("page-images").createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

export function PageEditor({ content, editable = true, onChange, placeholder = "Start writing…" }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "rounded-md max-w-full h-auto" } }),
    ],
    content: (content as object) ?? { type: "doc", content: [] },
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
    editorProps: {
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => insertImage(f));
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => insertImage(f));
        return true;
      },
    },
  });

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  const insertImage = async (file: File) => {
    if (!editor) return;
    const id = toast.loading("Uploading image…");
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
      toast.success("Image inserted", { id });
    } catch (e) {
      toast.error((e as Error).message || "Upload failed", { id });
    }
  };

  if (!editor) return <div className="min-h-[400px]" />;

  return (
    <div>
      {editable && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-card/95 backdrop-blur p-1">
          <TB onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}><Heading1 className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="h-4 w-4" /></TB>
          <Sep />
          <TB onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><Strikethrough className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")}><Code className="h-4 w-4" /></TB>
          <Sep />
          <TB onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-4 w-4" /></TB>
          <TB onClick={() => {
            const url = window.prompt("URL");
            if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            else editor.chain().focus().extendMarkRange("link").unsetLink().run();
          }} active={editor.isActive("link")}><LinkIcon className="h-4 w-4" /></TB>
          <TB onClick={() => fileInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></TB>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) insertImage(f);
              e.target.value = "";
            }}
          />
          <Sep />
          <TB onClick={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></TB>
        </div>
      )}
      <EditorContent editor={editor} className="prose max-w-none" />
    </div>
  );
}

function TB({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
      {children}
    </button>
  );
}
function Sep() { return <div className="mx-1 h-5 w-px bg-border" />; }
